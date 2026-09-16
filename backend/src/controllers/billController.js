import { pool } from '../config/db.js';
import { broadcastQuotaUpdate } from '../services/socketService.js';

export async function getBills(req, res) {
  try {
    const { drawPeriodId, customerPaymentStatus, prizePayoutStatus, memberId, status } = req.query;
    const user = req.user;
    const roomId = user.room_id;

    if (!roomId && user.role !== 'ADMIN') {
      return res.status(400).json({ success: false, message: 'คุณไม่ได้สังกัดห้องคีย์ใดๆ' });
    }

    let query = `
      SELECT b.*, u.display_name as member_name, u.nickname as member_nickname,
             dp.period_name, dp.status as period_status, dp.close_time, l.name as lottery_name
      FROM bills b
      JOIN users u ON b.user_id = u.id
      JOIN draw_periods dp ON b.draw_period_id = dp.id
      JOIN lotteries l ON dp.lottery_id = l.id
      WHERE 1=1
    `;
    const params = [];

    // การจำกัดสิทธิ์ตาม Role
    if (user.role === 'MEMBER') {
      // สมาชิกดูได้เฉพาะบิลของตัวเอง
      query += ' AND b.user_id = ?';
      params.push(user.id);
    } else if (user.role === 'LEADER') {
      // หัวหน้าดูบิลทั้งหมดในห้องของตน
      query += ' AND b.room_id = ?';
      params.push(roomId);
    } else if (user.role === 'ADMIN' && req.query.roomId) {
      query += ' AND b.room_id = ?';
      params.push(req.query.roomId);
    }

    // ตัวกรองงวด
    if (drawPeriodId) {
      query += ' AND b.draw_period_id = ?';
      params.push(drawPeriodId);
    }

    // ตัวกรองสถานะการชำระเงินของลูกค้า
    if (customerPaymentStatus) {
      query += ' AND b.customer_payment_status = ?';
      params.push(customerPaymentStatus);
    }

    // ตัวกรองสถานะรางวัล
    if (prizePayoutStatus) {
      query += ' AND b.prize_payout_status = ?';
      params.push(prizePayoutStatus);
    }

    // ตัวกรองสถานะบิล (ACTIVE / CANCELLED)
    if (status) {
      query += ' AND b.status = ?';
      params.push(status);
    }

    // กรองตามสมาชิก (กรณีหัวหน้ากรองดู)
    if (memberId && user.role === 'LEADER') {
      query += ' AND b.user_id = ?';
      params.push(memberId);
    }

    query += ' ORDER BY b.id DESC';

    const [bills] = await pool.query(query, params);

    // คำนวณสรุปภาพรวม (Summary) - นับและคำนวณเฉพาะบิล ACTIVE
    let totalSales = 0;
    let totalCommission = 0;
    let totalDealerNet = 0;
    let totalWon = 0;
    let totalUnpaidCustomer = 0;
    let activeBillCount = 0;

    for (const b of bills) {
      if (b.status === 'ACTIVE') {
        activeBillCount++;
        totalSales += Number(b.total_amount);
        totalCommission += Number(b.commission_amount);
        totalDealerNet += Number(b.net_dealer_amount);
        totalWon += Number(b.total_win_amount);
        if (b.customer_payment_status === 'UNPAID') {
          totalUnpaidCustomer += Number(b.total_amount);
        }
      }
    }

    const dealerProfit = totalDealerNet - totalWon;

    res.json({
      success: true,
      bills,
      summary: {
        billCount: activeBillCount,
        totalSales,
        totalCommission,
        totalDealerNet,
        totalWon,
        dealerProfit,
        totalUnpaidCustomer
      }
    });
  } catch (err) {
    console.error('getBills error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
}

export async function getBillDetail(req, res) {
  try {
    const { id } = req.params;
    const user = req.user;

    const [bills] = await pool.query(
      `SELECT b.*, u.display_name as member_name, u.phone as member_phone,
              dp.period_name, dp.status as period_status, l.name as lottery_name
       FROM bills b
       JOIN users u ON b.user_id = u.id
       JOIN draw_periods dp ON b.draw_period_id = dp.id
       JOIN lotteries l ON dp.lottery_id = l.id
       WHERE b.id = ?`,
      [id]
    );

    if (!bills.length) {
      return res.status(404).json({ success: false, message: 'ไม่พบบิลนี้' });
    }

    const bill = bills[0];

    // สมาชิกดูได้เฉพาะบิลตัวเอง
    if (user.role === 'MEMBER' && bill.user_id !== user.id) {
      return res.status(403).json({ success: false, message: 'คุณไม่มีสิทธิ์ดูบิลของผู้อื่น' });
    }

    const [items] = await pool.query(
      'SELECT * FROM bill_items WHERE bill_id = ? ORDER BY id ASC',
      [id]
    );

    res.json({
      success: true,
      bill: {
        ...bill,
        items
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

/**
 * อัปเดตสถานะการชำระเงินตามลำดับ (ลูกค้า -> ลูกทีม -> หัวหน้า)
 */
export async function updatePaymentStatus(req, res) {
  try {
    const { id } = req.params;
    const { stage, status } = req.body; // stage: 'CUSTOMER' | 'MEMBER' | 'DEALER', status: 'PAID' | 'UNPAID'
    const user = req.user;

    const [bills] = await pool.query('SELECT * FROM bills WHERE id = ?', [id]);
    if (!bills.length) return res.status(404).json({ success: false, message: 'ไม่พบบิลนี้' });

    const bill = bills[0];

    if (bill.status === 'CANCELLED') {
      return res.status(400).json({ success: false, message: 'ไม่สามารถเปลี่ยนสถานะเงินของบิลที่ถูกยกเลิกแล้ว' });
    }

    // ตรวจสอบสิทธิ์
    if (user.role === 'MEMBER') {
      if (bill.user_id !== user.id) {
        return res.status(403).json({ success: false, message: 'คุณสามารถอัปเดตได้เฉพาะบิลของตนเองเท่านั้น' });
      }
      if (stage === 'DEALER') {
        return res.status(403).json({ success: false, message: 'เฉพาะหัวหน้าเท่านั้นที่อัปเดตการรับเงินของหัวหน้าได้' });
      }
    }

    let fieldToUpdate = '';
    if (stage === 'CUSTOMER') fieldToUpdate = 'customer_payment_status';
    else if (stage === 'MEMBER') fieldToUpdate = 'member_payment_status';
    else if (stage === 'DEALER') fieldToUpdate = 'dealer_payment_status';
    else return res.status(400).json({ success: false, message: 'ระดับการชำระเงินไม่ถูกต้อง' });

    await pool.query(`UPDATE bills SET ${fieldToUpdate} = ? WHERE id = ?`, [status, id]);

    res.json({
      success: true,
      message: 'อัปเดตสถานะการชำระเงินเรียบร้อยแล้ว',
      stage,
      status
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

/**
 * อัปเดตสถานะการจ่ายรางวัล และแนบสลิป
 */
export async function updatePrizePayout(req, res) {
  try {
    const { id } = req.params;
    const { prizePayoutStatus, prizeSlipUrl } = req.body;

    const [bills] = await pool.query('SELECT * FROM bills WHERE id = ?', [id]);
    if (!bills.length) return res.status(404).json({ success: false, message: 'ไม่พบบิลนี้' });

    const bill = bills[0];
    if (req.user.role === 'MEMBER' && bill.user_id !== req.user.id) {
      return res.status(403).json({ success: false, message: 'ไม่มีสิทธิ์จัดการบิลนี้' });
    }

    await pool.query(
      'UPDATE bills SET prize_payout_status = ?, prize_slip_url = COALESCE(?, prize_slip_url) WHERE id = ?',
      [prizePayoutStatus, prizeSlipUrl || null, id]
    );

    res.json({ success: true, message: 'อัปเดตสถานะจ่ายรางวัลเรียบร้อย' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

/**
 * แก้ไขรายการในบิล (เฉพาะบิลที่ยังไม่ชำระเงิน และงวดยังไม่ปิดรับ)
 */
export async function updateBill(req, res) {
  const connection = await pool.getConnection();
  try {
    const { id } = req.params;
    const { customerName, note, items } = req.body;
    const user = req.user;

    if (!items || !Array.isArray(items) || !items.length) {
      return res.status(400).json({ success: false, message: 'กรุณาระบุรายการตัวเลขอย่างน้อย 1 รายการ' });
    }

    await connection.beginTransaction();

    // 1. ดึงข้อมูลบิลเดิมพร้อมล็อกแถว
    const [bills] = await connection.query(
      `SELECT b.*, dp.status as period_status, dp.close_time, dp.lottery_id, dp.period_name
       FROM bills b
       JOIN draw_periods dp ON b.draw_period_id = dp.id
       WHERE b.id = ? FOR UPDATE`,
      [id]
    );

    if (!bills.length) {
      await connection.rollback();
      return res.status(404).json({ success: false, message: 'ไม่พบบิลนี้' });
    }

    const bill = bills[0];

    // 2. ตรวจสอบสถานะการยกเลิก
    if (bill.status === 'CANCELLED') {
      await connection.rollback();
      return res.status(400).json({ 
        success: false, 
        message: 'ไม่สามารถแก้ไขบิลนี้ได้เนื่องจากบิลถูกยกเลิกไปแล้ว' 
      });
    }

    // 3. ตรวจสอบสิทธิ์ (ผู้คีย์บิล หรือ Leader หรือ Admin)
    if (user.role === 'MEMBER' && bill.user_id !== user.id) {
      await connection.rollback();
      return res.status(403).json({ success: false, message: 'คุณไม่มีสิทธิ์แก้ไขบิลของสมาชิกท่านอื่น' });
    }

    // 3. ตรวจสอบเงื่อนไข: ต้องยังไม่ชำระเงิน (UNPAID)
    if (bill.customer_payment_status === 'PAID') {
      await connection.rollback();
      return res.status(400).json({ 
        success: false, 
        message: 'ไม่สามารถแก้ไขบิลนี้ได้เนื่องจากลูกค้ารายการนี้ชำระเงินแล้ว' 
      });
    }

    // 4. ตรวจสอบเงื่อนไข: งวดต้องยังเปิดรับ และยังไม่หมดเวลา
    if (bill.period_status !== 'OPEN' || new Date() > new Date(bill.close_time)) {
      await connection.rollback();
      return res.status(400).json({ 
        success: false, 
        message: 'ไม่สามารถแก้ไขบิลนี้ได้เนื่องจากงวดหวยนี้ปิดรับแล้ว' 
      });
    }

    // 5. ดึงการตั้งค่าห้อง
    const [settingsRows] = await connection.query(
      'SELECT * FROM room_settings WHERE room_id = ? AND lottery_id = ?',
      [bill.room_id, bill.lottery_id]
    );
    const settings = settingsRows.length ? settingsRows[0] : {
      rate_3top: 900, rate_3tod: 130, rate_2top: 95, rate_2bottom: 95,
      rate_run_top: 3.2, rate_run_bottom: 4.2, commission_rate: 10, default_limit_per_number: 5000
    };

    // 6. ดึงกฎพิเศษ (อั้น, จ่ายครึ่ง)
    const [rules] = await connection.query(
      `SELECT number, bet_type, rule_type, custom_limit, note 
       FROM room_number_rules 
       WHERE room_id = ? AND draw_period_id = ?`,
      [bill.room_id, bill.draw_period_id]
    );

    const getRate = (betType) => {
      switch (betType) {
        case '3TOP': return Number(settings.rate_3top);
        case '3TOD': return Number(settings.rate_3tod);
        case '2TOP': return Number(settings.rate_2top);
        case '2BOTTOM': return Number(settings.rate_2bottom);
        case 'RUN_TOP': return Number(settings.rate_run_top);
        case 'RUN_BOTTOM': return Number(settings.rate_run_bottom);
        default: return 0;
      }
    };

    let totalAmount = 0;
    const processedItems = [];

    for (const it of items) {
      const { number, betType, amount } = it;
      const numAmount = Number(amount);
      if (numAmount <= 0) continue;

      const baseRate = getRate(betType);
      let effectiveRate = baseRate;
      let isHalfPay = false;

      const matchedRule = rules.find(r => r.number === number && (r.bet_type === betType || r.bet_type === 'ALL'));
      if (matchedRule) {
        if (matchedRule.rule_type === 'BLOCKED') {
          await connection.rollback();
          return res.status(400).json({ success: false, message: `เลข ${number} (${betType}) อั้น ไม่สามารถรับได้` });
        } else if (matchedRule.rule_type === 'HALF_PAY') {
          isHalfPay = true;
          effectiveRate = baseRate / 2;
        }
      }

      totalAmount += numAmount;
      processedItems.push({
        number: String(number).trim(),
        betType,
        amount: numAmount,
        payRate: effectiveRate,
        isHalfPay
      });
    }

    if (!processedItems.length) {
      await connection.rollback();
      return res.status(400).json({ success: false, message: 'ไม่มีรายการตัวเลขที่ถูกต้อง' });
    }

    // 7. คำนวณค่าคอมมิชชั่น และยอดส่งเจ้ามือ
    const commRate = Number(settings.commission_rate || 10);
    const commissionAmount = (totalAmount * commRate) / 100;
    const netDealerAmount = totalAmount - commissionAmount;

    // 8. ลบรายการเก่าของบิลนี้ และเพิ่มรายการใหม่
    await connection.query('DELETE FROM bill_items WHERE bill_id = ?', [id]);

    for (const item of processedItems) {
      await connection.query(
        `INSERT INTO bill_items (bill_id, number, bet_type, amount, pay_rate, is_half_pay)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [id, item.number, item.betType, item.amount, item.payRate, item.isHalfPay]
      );
    }

    // 9. อัปเดตตาราง bills
    await connection.query(
      `UPDATE bills 
       SET customer_name = ?, note = ?, total_amount = ?, commission_amount = ?, net_dealer_amount = ?, updated_at = NOW()
       WHERE id = ?`,
      [customerName ? customerName.trim() : bill.customer_name, note !== undefined ? note : bill.note, totalAmount, commissionAmount, netDealerAmount, id]
    );

    await connection.commit();

    // 10. Broadcast Quota Update via Socket.io
    broadcastQuotaUpdate(bill.room_id, bill.draw_period_id, {
      type: 'BILL_UPDATED',
      billId: id,
      items: processedItems
    });

    res.json({
      success: true,
      message: 'บันทึกการแก้ไขบิลเรียบร้อยแล้ว',
      billId: id,
      totalAmount,
      itemCount: processedItems.length
    });
  } catch (err) {
    await connection.rollback();
    console.error('updateBill error:', err);
    res.status(500).json({ success: false, message: err.message });
  } finally {
    connection.release();
  }
}

/**
 * ยกเลิกบิล (เฉพาะบิลที่ยังไม่ชำระเงิน และงวดหวยยังไม่ปิดรับ)
 */
export async function cancelBill(req, res) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const { id } = req.params;
    const user = req.user;

    // 1. ดึงข้อมูลบิลพร้อมล็อก Record
    const [bills] = await connection.query(
      `SELECT b.*, dp.status as period_status, dp.close_time
       FROM bills b
       JOIN draw_periods dp ON b.draw_period_id = dp.id
       WHERE b.id = ? FOR UPDATE`,
      [id]
    );

    if (!bills.length) {
      await connection.rollback();
      return res.status(404).json({ success: false, message: 'ไม่พบบิลนี้' });
    }

    const bill = bills[0];

    // 2. ตรวจสอบสถานะการยกเลิกเดิม
    if (bill.status === 'CANCELLED') {
      await connection.rollback();
      return res.status(400).json({ success: false, message: 'บิลนี้ถูกยกเลิกไปแล้ว' });
    }

    // 3. ตรวจสอบสิทธิ์ (ผู้คีย์บิล หรือ Leader หรือ Admin)
    if (user.role === 'MEMBER' && bill.user_id !== user.id) {
      await connection.rollback();
      return res.status(403).json({ success: false, message: 'คุณไม่มีสิทธิ์ยกเลิกบิลของสมาชิกท่านอื่น' });
    }
    if (user.role === 'LEADER' && bill.room_id !== user.room_id) {
      await connection.rollback();
      return res.status(403).json({ success: false, message: 'คุณไม่มีสิทธิ์ยกเลิกบิลนอกห้องของคุณ' });
    }

    // 4. ตรวจสอบเงื่อนไข: ต้องยังไม่ชำระเงิน (UNPAID)
    if (bill.customer_payment_status === 'PAID') {
      await connection.rollback();
      return res.status(400).json({
        success: false,
        message: 'ไม่สามารถยกเลิกบิลนี้ได้เนื่องจากลูกค้ารายการนี้ชำระเงินแล้ว'
      });
    }

    // 5. ตรวจสอบเงื่อนไข: งวดต้องยังเปิดรับ และยังไม่หมดเวลา
    if (bill.period_status !== 'OPEN' || (bill.close_time && new Date() > new Date(bill.close_time))) {
      await connection.rollback();
      return res.status(400).json({
        success: false,
        message: 'ไม่สามารถยกเลิกบิลนี้ได้เนื่องจากงวดหวยนี้ปิดรับแล้ว'
      });
    }

    // 6. อัปเดตสถานะเป็น CANCELLED
    await connection.query(
      'UPDATE bills SET status = "CANCELLED", updated_at = NOW() WHERE id = ?',
      [id]
    );

    await connection.commit();

    // 7. แจ้งเตือนอัปเดตโควตาผ่าน Socket.io ทันที (คืนโควตา)
    broadcastQuotaUpdate(bill.room_id, bill.draw_period_id, {
      type: 'BILL_CANCELLED',
      billId: id,
      billNo: bill.bill_no
    });

    res.json({
      success: true,
      message: `ยกเลิกบิล ${bill.bill_no} สำเร็จ คืนโควตาเรียบร้อยแล้ว`,
      billId: id,
      billNo: bill.bill_no
    });
  } catch (err) {
    await connection.rollback();
    console.error('cancelBill error:', err);
    res.status(500).json({ success: false, message: err.message });
  } finally {
    connection.release();
  }
}


