import cron from 'node-cron';
import { pool } from '../config/db.js';
import { lineService } from './lineService.js';
import { emitToRoom } from './socketService.js';

/**
 * ฟังก์ชันช่วยสร้างเลขสลับ 3 ตัวโต๊ด (permutations)
 */
function get3TodPermutations(threeDigits) {
  if (!threeDigits || threeDigits.length !== 3) return [];
  const chars = threeDigits.split('');
  const perms = new Set();
  perms.add(chars[0] + chars[1] + chars[2]);
  perms.add(chars[0] + chars[2] + chars[1]);
  perms.add(chars[1] + chars[0] + chars[2]);
  perms.add(chars[1] + chars[2] + chars[0]);
  perms.add(chars[2] + chars[0] + chars[1]);
  perms.add(chars[2] + chars[1] + chars[0]);
  return Array.from(perms);
}

/**
 * ดึงผลและคำนวณรางวัลของงวดที่ระบุ
 */
export async function scrapeAndProcessPeriod(periodId, customResults = null) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const [periods] = await connection.query(
      `SELECT dp.*, l.name as lottery_name, l.code as lottery_code 
       FROM draw_periods dp
       JOIN lotteries l ON dp.lottery_id = l.id
       WHERE dp.id = ?`,
      [periodId]
    );

    if (!periods.length) {
      throw new Error(`ไม่พบงวด ID: ${periodId}`);
    }

    const period = periods[0];

    // ผลรางวัล (อาจได้จาก Scraper หรือใส่แบบจำลองจากหน้า Admin)
    let result3top = customResults?.result3top;
    let result2top = customResults?.result2top;
    let result2bottom = customResults?.result2bottom;

    if (!result3top || !result2top || !result2bottom) {
      // Mock scrape random or default if not provided
      const rnd3 = Math.floor(100 + Math.random() * 900).toString();
      const rnd2 = Math.floor(10 + Math.random() * 90).toString();
      result3top = result3top || rnd3;
      result2top = result2top || result3top.slice(-2);
      result2bottom = result2bottom || rnd2;
    }

    const todList = get3TodPermutations(result3top);

    // 1. บันทึกผลรางวัลลง draw_periods
    await connection.query(
      `UPDATE draw_periods
       SET status = 'DRAWN',
           result_3top = ?,
           result_2top = ?,
           result_2bottom = ?,
           result_3tod_json = ?,
           drawn_at = NOW()
       WHERE id = ?`,
      [result3top, result2top, result2bottom, JSON.stringify(todList), periodId]
    );

    // 2. ดึงรายการแทงทั้งหมดในงวดนี้
    const [items] = await connection.query(
      `SELECT bi.id as item_id, bi.bill_id, bi.number, bi.bet_type, bi.amount, bi.pay_rate, bi.is_half_pay, b.room_id
       FROM bill_items bi
       JOIN bills b ON bi.bill_id = b.id
       WHERE b.draw_period_id = ? AND b.status = 'ACTIVE'`,
      [periodId]
    );

    let totalPayout = 0;
    const affectedBillIds = new Set();

    for (const item of items) {
      let isWon = false;
      const num = item.number;
      const type = item.bet_type;

      if (type === '3TOP' && num === result3top) {
        isWon = true;
      } else if (type === '3TOD' && todList.includes(num) && num !== result3top) {
        isWon = true;
      } else if (type === '2TOP' && num === result2top) {
        isWon = true;
      } else if (type === '2BOTTOM' && num === result2bottom) {
        isWon = true;
      } else if (type === 'RUN_TOP' && result3top.includes(num)) {
        isWon = true;
      } else if (type === 'RUN_BOTTOM' && result2bottom.includes(num)) {
        isWon = true;
      }

      const effectiveRate = item.is_half_pay ? item.pay_rate / 2 : item.pay_rate;
      const winAmount = isWon ? Number(item.amount) * Number(effectiveRate) : 0;

      if (isWon) {
        totalPayout += winAmount;
      }

      affectedBillIds.add(item.bill_id);

      await connection.query(
        `UPDATE bill_items
         SET win_status = ?, win_amount = ?
         WHERE id = ?`,
        [isWon ? 'WON' : 'LOST', winAmount, item.item_id]
      );
    }

    // 3. อัปเดตยอดรวมรางวัลในแต่ละบิล
    for (const billId of affectedBillIds) {
      const [sumRow] = await connection.query(
        `SELECT COALESCE(SUM(win_amount), 0) as total_win FROM bill_items WHERE bill_id = ? AND win_status = 'WON'`,
        [billId]
      );
      const totalWin = Number(sumRow[0]?.total_win || 0);
      const prizeStatus = totalWin > 0 ? 'PENDING' : 'NOT_WON';

      await connection.query(
        `UPDATE bills
         SET total_win_amount = ?, prize_payout_status = ?
         WHERE id = ?`,
        [totalWin, prizeStatus, billId]
      );
    }

    // 4. บันทึก Scraper Log
    await connection.query(
      `INSERT INTO system_scraper_logs (lottery_id, draw_period_id, source_url, status, raw_data)
       VALUES (?, ?, ?, 'SUCCESS', ?)`,
      [
        period.lottery_id,
        periodId,
        'https://glo.or.th (simulated)',
        JSON.stringify({ result3top, result2top, result2bottom, todList, totalPayout })
      ]
    );

    await connection.commit();

    // 5. แจ้งเตือนผลหวยออกไปยัง LINE OA
    await lineService.notifyDrawResult({
      periodName: period.period_name,
      result3top,
      result2top,
      result2bottom
    });

    // 6. Broadcast Realtime Socket ให้ทุกห้องอัปเดตหน้าสรุปบิล
    const [rooms] = await pool.query('SELECT id FROM rooms WHERE status = "ACTIVE"');
    for (const r of rooms) {
      emitToRoom(r.id, 'draw_settled', {
        periodId,
        result3top,
        result2top,
        result2bottom,
        totalPayout
      });
    }

    return {
      success: true,
      periodId,
      results: { result3top, result2top, result2bottom },
      totalBillsChecked: affectedBillIds.size,
      totalPayout
    };
  } catch (err) {
    await connection.rollback();
    console.error('Error in scrapeAndProcessPeriod:', err);
    throw err;
  } finally {
    connection.release();
  }
}

/**
 * เริ่มต้น Background Cron Schedulers
 */
export function initLotteryScraperScheduler() {
  const cronThai = process.env.SCRAPER_CRON_THAI || '0 16 1,16 * *';
  const cronLao = process.env.SCRAPER_CRON_LAO || '30 20 * * 1,3,5';

  console.log(`⏰ Initializing Lottery Scraper Cron jobs:`);
  console.log(`- Thai Lottery: ${cronThai}`);
  console.log(`- Lao Lottery: ${cronLao}`);

  // Auto scrape for Thai lottery
  cron.schedule(cronThai, async () => {
    console.log('🔄 Triggering scheduled Thai lottery scraper...');
    try {
      const [periods] = await pool.query(
        `SELECT id FROM draw_periods WHERE lottery_id = 1 AND status = 'OPEN' ORDER BY period_date ASC LIMIT 1`
      );
      if (periods.length) {
        await scrapeAndProcessPeriod(periods[0].id);
      }
    } catch (err) {
      console.error('Scheduled Thai scraper error:', err.message);
    }
  });

  // Auto scrape for Lao lottery
  cron.schedule(cronLao, async () => {
    console.log('🔄 Triggering scheduled Lao lottery scraper...');
    try {
      const [periods] = await pool.query(
        `SELECT id FROM draw_periods WHERE lottery_id = 2 AND status = 'OPEN' ORDER BY period_date ASC LIMIT 1`
      );
      if (periods.length) {
        await scrapeAndProcessPeriod(periods[0].id);
      }
    } catch (err) {
      console.error('Scheduled Lao scraper error:', err.message);
    }
  });
}
