import { pool } from '../config/db.js';
import { notificationService } from '../services/notificationService.js';
import { scrapeAndProcessPeriod } from '../services/lotteryScraper.js';
import { emitToUser } from '../services/socketService.js';

export async function listRooms(req, res) {
  try {
    const [rooms] = await pool.query(
      `SELECT r.*, u.display_name as leader_name, u.real_name, u.phone, u.bank_name, u.account_no, u.promptpay,
              (SELECT COUNT(*) FROM room_members rm WHERE rm.room_id = r.id AND rm.status = 'APPROVED') as member_count,
              (SELECT COALESCE(SUM(b.total_amount), 0) FROM bills b WHERE b.room_id = r.id AND b.status = 'ACTIVE') as total_turnover
       FROM rooms r
       JOIN users u ON r.leader_id = u.id
       ORDER BY r.id DESC`
    );

    res.json({ success: true, rooms });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

export async function approveRoom(req, res) {
  const connection = await pool.getConnection();
  try {
    const { roomId, days = 365 } = req.body;

    const [rooms] = await connection.query('SELECT * FROM rooms WHERE id = ?', [roomId]);
    if (!rooms.length) return res.status(404).json({ success: false, message: 'ไม่พบห้องนี้' });

    const room = rooms[0];

    await connection.beginTransaction();

    await connection.query(
      `UPDATE rooms 
       SET status = 'ACTIVE', expires_at = DATE_ADD(NOW(), INTERVAL ? DAY)
       WHERE id = ?`,
      [days, roomId]
    );

    await connection.query(
      `UPDATE users 
       SET role = 'LEADER', room_id = ?
       WHERE id = ?`,
      [roomId, room.leader_id]
    );

    await connection.commit();

    // แจ้งเตือนหัวหน้าห้อง
    await notificationService.notifyLeaderApproved({
      leaderId: room.leader_id,
      roomName: room.name,
      roomCode: room.code
    });

    emitToUser(room.leader_id, 'room_approved', {
      roomId,
      roomName: room.name,
      roomCode: room.code
    });

    res.json({ success: true, message: `อนุมัติห้อง "${room.name}" เรียบร้อยแล้ว (อายุ ${days} วัน)` });
  } catch (err) {
    await connection.rollback();
    res.status(500).json({ success: false, message: err.message });
  } finally {
    connection.release();
  }
}

export async function rejectRoom(req, res) {
  try {
    const { roomId } = req.body;
    await pool.query('UPDATE rooms SET status = "DISBANDED" WHERE id = ?', [roomId]);
    res.json({ success: true, message: 'ปฏิเสธคำขอเปิดห้องแล้ว' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

export async function updateRoomExpiration(req, res) {
  try {
    const { roomId, expiresAt } = req.body;
    await pool.query('UPDATE rooms SET expires_at = ? WHERE id = ?', [expiresAt, roomId]);
    res.json({ success: true, message: 'อัปเดตวันหมดอายุเรียบร้อยแล้ว' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

export async function toggleRoomStatus(req, res) {
  try {
    const { roomId, status } = req.body; // 'ACTIVE', 'EXPIRED', 'DISBANDED'
    await pool.query('UPDATE rooms SET status = ? WHERE id = ?', [status, roomId]);
    res.json({ success: true, message: 'ปรับสถานะห้องเรียบร้อยแล้ว' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

export async function triggerScraper(req, res) {
  try {
    const { periodId, result3top, result2top, result2bottom } = req.body;
    const result = await scrapeAndProcessPeriod(periodId, { result3top, result2top, result2bottom });
    res.json({
      success: true,
      message: 'ประมวลผลรางวัลและคำนวณบิลเรียบร้อยแล้ว',
      data: result
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

export async function getAdminOverview(req, res) {
  try {
    const [roomStats] = await pool.query(`
      SELECT 
        COUNT(*) as total_rooms,
        SUM(CASE WHEN status = 'ACTIVE' THEN 1 ELSE 0 END) as active_rooms,
        SUM(CASE WHEN status = 'PENDING' THEN 1 ELSE 0 END) as pending_rooms
      FROM rooms
    `);

    const [userStats] = await pool.query(`
      SELECT 
        COUNT(*) as total_users,
        SUM(CASE WHEN role = 'LEADER' THEN 1 ELSE 0 END) as total_leaders,
        SUM(CASE WHEN role = 'MEMBER' THEN 1 ELSE 0 END) as total_members
      FROM users
    `);

    const [billStats] = await pool.query(`
      SELECT 
        COUNT(*) as total_bills,
        COALESCE(SUM(total_amount), 0) as total_turnover,
        COALESCE(SUM(total_win_amount), 0) as total_payout
      FROM bills
      WHERE status = 'ACTIVE'
    `);

    res.json({
      success: true,
      overview: {
        rooms: roomStats[0],
        users: userStats[0],
        finances: {
          ...billStats[0],
          gross_margin: Number(billStats[0].total_turnover) - Number(billStats[0].total_payout)
        }
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

// Create new Draw Period
export async function createDrawPeriod(req, res) {
  try {
    const { lotteryId, periodDate, periodName, closeTime } = req.body;
    if (!lotteryId || !periodDate || !periodName) {
      return res.status(400).json({ success: false, message: 'กรุณาระบุประเภทหวย, วันที่ออกผล และชื่องวดให้ครบถ้วน' });
    }

    const effectiveCloseTime = closeTime || `${periodDate} 15:30:00`;

    const [result] = await pool.query(
      `INSERT INTO draw_periods (lottery_id, period_date, period_name, close_time, status)
       VALUES (?, ?, ?, ?, 'OPEN')`,
      [Number(lotteryId), periodDate, periodName.trim(), effectiveCloseTime]
    );

    res.json({
      success: true,
      message: 'สร้างงวดหวยใหม่เรียบร้อยแล้ว',
      periodId: result.insertId
    });
  } catch (err) {
    console.error('Error creating draw period:', err);
    res.status(500).json({ success: false, message: err.message });
  }
}

// Update Draw Period Status (OPEN, CLOSED, SETTLED)
export async function updateDrawPeriodStatus(req, res) {
  try {
    const { id } = req.params;
    const { status } = req.body;
    if (!['OPEN', 'CLOSED', 'DRAWN', 'SETTLED'].includes(status)) {
      return res.status(400).json({ success: false, message: 'สถานะงวดไม่ถูกต้อง' });
    }

    await pool.query('UPDATE draw_periods SET status = ? WHERE id = ?', [status, id]);
    res.json({ success: true, message: `เปลี่ยนสถานะงวดเป็น ${status} สำเร็จ` });
  } catch (err) {
    console.error('Error updating draw period status:', err);
    res.status(500).json({ success: false, message: err.message });
  }
}

// Delete Draw Period (only if no bills exist)
export async function deleteDrawPeriod(req, res) {
  try {
    const { id } = req.params;
    const [bills] = await pool.query('SELECT COUNT(*) as count FROM bills WHERE draw_period_id = ?', [id]);
    if (bills[0].count > 0) {
      return res.status(400).json({ 
        success: false, 
        message: `ไม่สามารถลบงวดนี้ได้เนื่องจากมีบิลคีย์อยู่ในงวดนี้แล้ว ${bills[0].count} บิล (สามารถเปลี่ยนสถานะเป็น ปิดรับ แทนได้)` 
      });
    }

    await pool.query('DELETE FROM draw_periods WHERE id = ?', [id]);
    res.json({ success: true, message: 'ลบงวดหวยเรียบร้อยแล้ว' });
  } catch (err) {
    console.error('Error deleting draw period:', err);
    res.status(500).json({ success: false, message: err.message });
  }
}

// Update Draw Period Details (periodName, periodDate, closeTime, lotteryId)
export async function updateDrawPeriod(req, res) {
  try {
    const { id } = req.params;
    const { lotteryId, periodDate, periodName, closeTime } = req.body;

    const [rows] = await pool.query('SELECT status FROM draw_periods WHERE id = ?', [id]);
    if (!rows.length) {
      return res.status(404).json({ success: false, message: 'ไม่พบงวดหวยนี้' });
    }

    if (rows[0].status === 'DRAWN' || rows[0].status === 'SETTLED') {
      return res.status(400).json({ success: false, message: 'ไม่สามารถแก้ไขงวดที่ออกผลรางวัลแล้วได้' });
    }

    const effectiveCloseTime = closeTime ? closeTime.replace('T', ' ') : undefined;

    await pool.query(
      `UPDATE draw_periods 
       SET lottery_id = COALESCE(?, lottery_id),
           period_date = COALESCE(?, period_date),
           period_name = COALESCE(?, period_name),
           close_time = COALESCE(?, close_time)
       WHERE id = ?`,
      [lotteryId ? Number(lotteryId) : null, periodDate || null, periodName ? periodName.trim() : null, effectiveCloseTime || null, id]
    );

    res.json({ success: true, message: 'อัปเดตข้อมูลและเวลางวดหวยเรียบร้อยแล้ว' });
  } catch (err) {
    console.error('Error updating draw period:', err);
    res.status(500).json({ success: false, message: err.message });
  }
}


