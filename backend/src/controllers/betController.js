import { pool } from '../config/db.js';
import { notificationService } from '../services/notificationService.js';
import { broadcastQuotaUpdate, emitToRoom } from '../services/socketService.js';

function getRateForBetType(settings, betType) {
  switch (betType) {
    case '3TOP': return Number(settings.rate_3top);
    case '3TOD': return Number(settings.rate_3tod);
    case '2TOP': return Number(settings.rate_2top);
    case '2BOTTOM': return Number(settings.rate_2bottom);
    case 'RUN_TOP': return Number(settings.rate_run_top);
    case 'RUN_BOTTOM': return Number(settings.rate_run_bottom);
    default: return 0;
  }
}

/**
 * ตรวจสอบโควตาและอัตราจ่ายของรายการตัวเลขแบบ Realtime
 */
export async function checkQuota(req, res) {
  try {
    const { drawPeriodId, items } = req.body;
    const roomId = req.user.room_id;

    if (!roomId) {
      return res.status(400).json({ success: false, message: 'คุณต้องสังกัดห้องคีย์ก่อนดำเนินการ' });
    }

    if (!drawPeriodId || !Array.isArray(items) || !items.length) {
      return res.status(400).json({ success: false, message: 'ข้อมูลไม่ถูกต้อง' });
    }

    // ดึงงวดหวยเพื่อหา lottery_id
    const [periods] = await pool.query('SELECT lottery_id, status, close_time FROM draw_periods WHERE id = ?', [drawPeriodId]);
    if (!periods.length) return res.status(404).json({ success: false, message: 'ไม่พบงวดหวยนี้' });

    const lotteryId = periods[0].lottery_id;

    // ดึงการตั้งค่าห้อง
    const [settingsRows] = await pool.query(
      'SELECT * FROM room_settings WHERE room_id = ? AND lottery_id = ?',
      [roomId, lotteryId]
    );
    const settings = settingsRows.length ? settingsRows[0] : {
      rate_3top: 900, rate_3tod: 130, rate_2top: 95, rate_2bottom: 95,
      rate_run_top: 3.2, rate_run_bottom: 4.2, default_limit_per_number: 5000
    };

    // ดึงกฎพิเศษ (อั้น, จ่ายครึ่ง, ลิมิต) ของงวดนี้
    const [rules] = await pool.query(
      `SELECT number, bet_type, rule_type, custom_limit, note 
       FROM room_number_rules 
       WHERE room_id = ? AND draw_period_id = ?`,
      [roomId, drawPeriodId]
    );

    const results = [];

    for (const item of items) {
      const { number, betType, amount } = item;
      const baseRate = getRateForBetType(settings, betType);
      let effectiveRate = baseRate;
      let isBlocked = false;
      let isHalfPay = false;
      let limit = Number(settings.default_limit_per_number);
      let note = '';

      // ค้นหากฎเฉพาะของเลขนี้
      const matchedRule = rules.find(r => r.number === number && (r.bet_type === betType || r.bet_type === 'ALL'));
      if (matchedRule) {
        if (matchedRule.rule_type === 'BLOCKED') {
          isBlocked = true;
          note = matchedRule.note || 'เลขอั้น ไม่รับแทง';
        } else if (matchedRule.rule_type === 'HALF_PAY') {
          isHalfPay = true;
          effectiveRate = baseRate / 2;
          note = matchedRule.note || 'เลขจ่ายครึ่ง';
        } else if (matchedRule.rule_type === 'CUSTOM_LIMIT') {
          limit = Number(matchedRule.custom_limit);
          note = matchedRule.note || `จำกัดยอดรับ ${limit} บ.`;
        }
      }

      // ตรวจสอบยอดรวมที่รับไปแล้วของเลขนี้ในงวดนี้
      const [sumRows] = await pool.query(
        `SELECT COALESCE(SUM(bi.amount), 0) as current_total
         FROM bill_items bi
         JOIN bills b ON bi.bill_id = b.id
         WHERE b.room_id = ? AND b.draw_period_id = ? AND bi.number = ? AND bi.bet_type = ?
           AND b.status = 'ACTIVE'`,
        [roomId, drawPeriodId, number, betType]
      );

      const currentTotal = Number(sumRows[0]?.current_total || 0);
      const remainingQuota = Math.max(0, limit - currentTotal);
      const requestedAmount = Number(amount || 0);
      const canAccept = !isBlocked && (remainingQuota >= requestedAmount);

      results.push({
        number,
        betType,
        amount: requestedAmount,
        baseRate,
        effectiveRate,
        isBlocked,
        isHalfPay,
        limit,
        currentTotal,
        remainingQuota,
        canAccept,
        note
      });
    }

    res.json({ success: true, validations: results });
  } catch (err) {
    console.error('checkQuota error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
}

/**
 * บันทึกบิลการแทงหวย (Atomic Transaction + Realtime Quota Broadcast)
 */
export async function submitBill(req, res) {
  const connection = await pool.getConnection();
  try {
    const { drawPeriodId, customerName, note, isPaidByCustomer, items } = req.body;
    const userId = req.user.id;
    const roomId = req.user.room_id;

    if (!roomId) {
      return res.status(400).json({ success: false, message: 'คุณต้องสังกัดห้องคีย์ก่อนออกบิล' });
    }

    if (!items || !items.length) {
      return res.status(400).json({ success: false, message: 'กรุณาระบุรายการตัวเลขที่ต้องการแทง' });
    }

    await connection.beginTransaction();

    // 1. ตรวจสอบงวดหวยและเวลาปิดรับ
    const [periods] = await connection.query(
      'SELECT id, lottery_id, status, close_time, period_name FROM draw_periods WHERE id = ? FOR UPDATE',
      [drawPeriodId]
    );

    if (!periods.length) {
      await connection.rollback();
      return res.status(404).json({ success: false, message: 'ไม่พบงวดหวยนี้' });
    }

    const period = periods[0];
    if (period.status !== 'OPEN' || new Date() > new Date(period.close_time)) {
      await connection.rollback();
      return res.status(400).json({ success: false, message: 'งวดนี้ปิดรับแทงแล้ว' });
    }

    // 2. ดึงการตั้งค่าห้อง
    const [settingsRows] = await connection.query(
      'SELECT * FROM room_settings WHERE room_id = ? AND lottery_id = ?',
      [roomId, period.lottery_id]
    );
    const settings = settingsRows.length ? settingsRows[0] : {
      rate_3top: 900, rate_3tod: 130, rate_2top: 95, rate_2bottom: 95,
      rate_run_top: 3.2, rate_run_bottom: 4.2,
      comm_3top: 8, comm_3tod: 8, comm_2top: 5, comm_2bottom: 5,
      comm_run_top: 5, comm_run_bottom: 5,
      commission_rate: 10, default_limit_per_number: 5000
    };

    // 3. ดึงกฎพิเศษ (อั้น, จ่ายครึ่ง, ลิมิต)
    const [rules] = await connection.query(
      `SELECT number, bet_type, rule_type, custom_limit, note 
       FROM room_number_rules 
       WHERE room_id = ? AND draw_period_id = ?`,
      [roomId, drawPeriodId]
    );

    let totalAmount = 0;
    const processedItems = [];
    const quotaExceeded = [];

    // Helper คิด % ส่วนแบ่งตามประเภทหวย
    const getCommRate = (bType) => {
      switch (bType) {
        case '3TOP': return Number(settings.comm_3top ?? settings.commission_rate ?? 8);
        case '3TOD': return Number(settings.comm_3tod ?? settings.commission_rate ?? 8);
        case '2TOP': return Number(settings.comm_2top ?? settings.commission_rate ?? 5);
        case '2BOTTOM': return Number(settings.comm_2bottom ?? settings.commission_rate ?? 5);
        case 'RUN_TOP': return Number(settings.comm_run_top ?? settings.commission_rate ?? 5);
        case 'RUN_BOTTOM': return Number(settings.comm_run_bottom ?? settings.commission_rate ?? 5);
        default: return Number(settings.commission_rate ?? 5);
      }
    };

    // 4. ตรวจสอบและคำนวณแต่ละรายการ
    for (const item of items) {
      const number = String(item.number || '').trim();
      const betType = item.betType;
      const numAmount = Number(item.amount);

      if (!number || !betType || isNaN(numAmount) || numAmount <= 0) continue;

      // หาอัตราจ่ายตามประเภท
      let baseRate = 0;
      switch (betType) {
        case '3TOP': baseRate = Number(settings.rate_3top || 900); break;
        case '3TOD': baseRate = Number(settings.rate_3tod || 130); break;
        case '2TOP': baseRate = Number(settings.rate_2top || 95); break;
        case '2BOTTOM': baseRate = Number(settings.rate_2bottom || 95); break;
        case 'RUN_TOP': baseRate = Number(settings.rate_run_top || 3.2); break;
        case 'RUN_BOTTOM': baseRate = Number(settings.rate_run_bottom || 4.2); break;
        default: baseRate = 0;
      }

      // ตรวจสอบกฎเลขอั้น / เลขจ่ายครึ่ง / จำกัดยอดรับ
      let effectiveRate = baseRate;
      let isHalfPay = false;
      let limit = Number(settings.default_limit_per_number || 5000);
      let isBlocked = false;

      const matchedRule = rules.find(r => r.number === number && (r.bet_type === betType || r.bet_type === 'ALL'));
      if (matchedRule) {
        if (matchedRule.rule_type === 'BLOCKED') {
          isBlocked = true;
        } else if (matchedRule.rule_type === 'HALF_PAY') {
          isHalfPay = true;
          effectiveRate = baseRate / 2;
        } else if (matchedRule.rule_type === 'CUSTOM_LIMIT') {
          limit = Number(matchedRule.custom_limit);
        }
      }

      if (isBlocked) {
        quotaExceeded.push(`เลข ${number} (${betType}) อั้น ไม่สามารถรับซื้อได้`);
        continue;
      }

      // เช็กยอดรวมในระบบ
      const [sumRows] = await connection.query(
        `SELECT COALESCE(SUM(bi.amount), 0) as current_total
         FROM bill_items bi
         JOIN bills b ON bi.bill_id = b.id
         WHERE b.room_id = ? AND b.draw_period_id = ? AND bi.number = ? AND bi.bet_type = ?
           AND b.status = 'ACTIVE'`,
        [roomId, drawPeriodId, number, betType]
      );

      const currentTotal = Number(sumRows[0]?.current_total || 0);
      const remaining = limit - currentTotal;

      if (numAmount > remaining) {
        quotaExceeded.push(`เลข ${number} (${betType}) เกินโควตาที่รับได้ (เหลือรับได้ ${Math.max(0, remaining)} บาท)`);
        continue;
      }

      totalAmount += numAmount;
      processedItems.push({
        number,
        betType,
        amount: numAmount,
        payRate: effectiveRate,
        isHalfPay
      });
    }

    if (quotaExceeded.length) {
      await connection.rollback();
      return res.status(400).json({
        success: false,
        message: 'ไม่สามารถออกบิลได้เนื่องจากมีเลขเกินโควตา',
        errors: quotaExceeded
      });
    }

    if (!processedItems.length) {
      await connection.rollback();
      return res.status(400).json({ success: false, message: 'ไม่มีรายการตัวเลขที่ถูกต้อง' });
    }

    // 5. คำนวณส่วนแบ่งคอมมิชชั่นแยกตามประเภทหวย
    let commissionAmount = 0;
    for (const item of processedItems) {
      const commRate = getCommRate(item.betType);
      const itemComm = (item.amount * commRate) / 100;
      commissionAmount += itemComm;
    }
    const netDealerAmount = totalAmount - commissionAmount;

    // 6. สร้างเลขบิล
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
    const randSuffix = Math.floor(1000 + Math.random() * 9000);
    const billNo = `KL-${dateStr}-${randSuffix}`;

    // 7. บันทึกบิลลงฐานข้อมูล
    const customerPaymentStatus = isPaidByCustomer ? 'PAID' : 'UNPAID';
    const effectiveCustomerName = customerName && customerName.trim() ? customerName.trim() : null;
    const effectiveNote = note && note.trim() ? note.trim() : null;

    const [billResult] = await connection.query(
      `INSERT INTO bills (bill_no, room_id, draw_period_id, user_id, customer_name, note, total_amount, commission_amount, net_dealer_amount, customer_payment_status, member_payment_status, dealer_payment_status, prize_payout_status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'UNPAID', 'UNPAID', 'NOT_WON')`,
      [billNo, roomId, drawPeriodId, userId, effectiveCustomerName, effectiveNote, totalAmount, commissionAmount, netDealerAmount, customerPaymentStatus]
    );

    const billId = billResult.insertId;

    // 8. บันทึกรายการย่อย
    for (const item of processedItems) {
      await connection.query(
        `INSERT INTO bill_items (bill_id, number, bet_type, amount, pay_rate, is_half_pay, win_status, win_amount)
         VALUES (?, ?, ?, ?, ?, ?, 'PENDING', 0.00)`,
        [billId, item.number, item.betType, item.amount, item.payRate, item.isHalfPay]
      );
    }

    await connection.commit();

    // 9. Broadcast Quota Update ผ่าน Socket.io ให้ทุกคนในห้อง
    broadcastQuotaUpdate(roomId, drawPeriodId, {
      updatedNumbers: processedItems.map(i => ({ number: i.number, betType: i.betType }))
    });

    // 10. ส่งแจ้งเตือนหาหัวหน้าห้อง
    const [rooms] = await pool.query('SELECT leader_id, name FROM rooms WHERE id = ?', [roomId]);
    if (rooms.length) {
      await notificationService.notifyLeaderNewBill({
        leaderId: rooms[0].leader_id,
        roomName: rooms[0].name,
        billNo,
        memberName: req.user.display_name,
        customerName: effectiveCustomerName,
        note: effectiveNote,
        totalAmount,
        billId
      });
    }

    // 11. ดึงข้อมูลบิลสมบูรณ์เพื่อส่งกลับให้ Frontend ทำ Preview / Image Download
    res.json({
      success: true,
      message: 'ออกบิลสำเร็จเรียบร้อย',
      bill: {
        id: billId,
        billNo,
        customerName: effectiveCustomerName,
        note: effectiveNote,
        totalAmount,
        commissionAmount,
        netDealerAmount,
        customerPaymentStatus,
        createdAt: now.toISOString(),
        periodName: period.period_name,
        memberName: req.user.display_name,
        items: processedItems
      }
    });
  } catch (err) {
    await connection.rollback();
    console.error('submitBill error:', err);
    res.status(500).json({ success: false, message: err.message });
  } finally {
    connection.release();
  }
}

/**
 * ดึงรายการกฎตัวเลข (เลขอั้น / เลขจ่ายครึ่ง / จำกัดยอด) ประจำงวดของห้อง
 */
export async function getNumberRules(req, res) {
  try {
    const roomId = req.user.room_id;
    const { drawPeriodId } = req.query;

    if (!roomId) {
      return res.status(400).json({ success: false, message: 'คุณต้องสังกัดห้องคีย์ก่อน' });
    }

    let query = `
      SELECT rnr.*, dp.period_name, dp.period_date, l.id as lottery_id, l.name as lottery_name, l.code as lottery_code
      FROM room_number_rules rnr
      JOIN draw_periods dp ON rnr.draw_period_id = dp.id
      JOIN lotteries l ON dp.lottery_id = l.id
      WHERE rnr.room_id = ?
    `;
    const params = [roomId];

    if (drawPeriodId) {
      query += ' AND rnr.draw_period_id = ?';
      params.push(drawPeriodId);
    }

    query += `
      ORDER BY 
        CASE rnr.rule_type
          WHEN 'BLOCKED' THEN 1
          WHEN 'HALF_PAY' THEN 2
          WHEN 'CUSTOM_LIMIT' THEN 3
          ELSE 4
        END,
        rnr.number ASC
    `;

    const [rules] = await pool.query(query, params);

    // Fetch room settings for effective payout rates
    let settings = null;
    if (drawPeriodId) {
      const [periods] = await pool.query('SELECT lottery_id FROM draw_periods WHERE id = ?', [drawPeriodId]);
      if (periods.length) {
        const [settingsRows] = await pool.query(
          'SELECT * FROM room_settings WHERE room_id = ? AND lottery_id = ?',
          [roomId, periods[0].lottery_id]
        );
        if (settingsRows.length) settings = settingsRows[0];
      }
    }

    // Enhance rules with base and effective rates
    const enrichedRules = rules.map(rule => {
      let baseRate = 0;
      let effectiveRate = 0;
      if (settings) {
        if (rule.bet_type !== 'ALL') {
          baseRate = getRateForBetType(settings, rule.bet_type);
        } else {
          // If ALL, show 2TOP / 3TOP rate as reference based on number length
          baseRate = rule.number.length === 3 ? Number(settings.rate_3top) : Number(settings.rate_2top);
        }
        effectiveRate = rule.rule_type === 'HALF_PAY' ? baseRate / 2 : baseRate;
      }
      return {
        ...rule,
        baseRate,
        effectiveRate
      };
    });

    res.json({ success: true, rules: enrichedRules, settings });
  } catch (err) {
    console.error('getNumberRules error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
}
