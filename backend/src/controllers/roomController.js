import { pool } from '../config/db.js';
import { lineService } from '../services/lineService.js';
import { emitToUser, emitToRoom } from '../services/socketService.js';

function generateRoomCode() {
  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

/**
 * ผู้ใช้ขอยื่นเปิดห้องคีย์ (รอ Admin อนุมัติ)
 */
export async function createRoom(req, res) {
  const connection = await pool.getConnection();
  try {
    const { roomName } = req.body;
    const userId = req.user.id;

    if (!roomName || !roomName.trim()) {
      return res.status(400).json({ success: false, message: 'กรุณากรอกชื่อห้องคีย์หวย' });
    }

    // ตรวจสอบว่าผู้ใช้มีห้องอยู่แล้วหรือไม่
    if (req.user.room_id) {
      return res.status(400).json({ success: false, message: 'คุณมีห้องประจำอยู่แล้ว ไม่สามารถสร้างห้องซ้ำได้' });
    }

    // ดึงข้อมูลผู้ใช้ปัจจุบันเพื่อนำมาใช้
    const [userRows] = await pool.query('SELECT * FROM users WHERE id = ?', [userId]);
    if (!userRows.length) {
      return res.status(404).json({ success: false, message: 'ไม่พบข้อมูลผู้ใช้' });
    }
    const currentUser = userRows[0];

    const realName = req.body.realName || currentUser.real_name || currentUser.display_name;
    const nickname = req.body.nickname || currentUser.nickname;
    const phone = req.body.phone || currentUser.phone || '-';
    const bankName = req.body.bankName || currentUser.bank_name;
    const accountNo = req.body.accountNo || currentUser.account_no;
    const promptpay = req.body.promptpay || currentUser.promptpay;

    await connection.beginTransaction();

    // 1. อัปเดตข้อมูลผู้ใช้ถ้ามีการส่งค่ามาใหม่
    if (req.body.realName || req.body.phone || req.body.bankName || req.body.accountNo) {
      await connection.query(
        `UPDATE users 
         SET real_name = COALESCE(?, real_name), 
             nickname = COALESCE(?, nickname), 
             phone = COALESCE(?, phone), 
             bank_name = COALESCE(?, bank_name), 
             account_no = COALESCE(?, account_no), 
             promptpay = COALESCE(?, promptpay)
         WHERE id = ?`,
        [req.body.realName, req.body.nickname, req.body.phone, req.body.bankName, req.body.accountNo, req.body.promptpay, userId]
      );
    }

    // 2. สุ่มรหัสห้อง 6 หลัก
    let roomCode = generateRoomCode();
    let isUnique = false;
    while (!isUnique) {
      const [existing] = await connection.query('SELECT id FROM rooms WHERE code = ?', [roomCode]);
      if (!existing.length) isUnique = true;
      else roomCode = generateRoomCode();
    }

    // 3. สร้างห้องสถานะ PENDING รอ Admin Approve
    const [roomResult] = await connection.query(
      `INSERT INTO rooms (code, name, leader_id, status)
       VALUES (?, ?, ?, 'PENDING')`,
      [roomCode, roomName, userId]
    );
    const newRoomId = roomResult.insertId;

    // 4. สร้างการตั้งค่าเริ่มต้นให้ห้อง (Room Settings)
    await connection.query(
      `INSERT INTO room_settings (room_id, lottery_id, is_enabled, rate_3top, rate_3tod, rate_2top, rate_2bottom, rate_run_top, rate_run_bottom, comm_3top, comm_3tod, comm_2top, comm_2bottom, comm_run_top, comm_run_bottom, commission_rate, default_limit_per_number)
       VALUES 
       (?, 1, TRUE, 900.00, 130.00, 95.00, 95.00, 3.20, 4.20, 8.00, 8.00, 5.00, 5.00, 5.00, 5.00, 10.00, 5000.00),
       (?, 2, TRUE, 850.00, 120.00, 92.00, 92.00, 3.20, 4.20, 8.00, 8.00, 5.00, 5.00, 5.00, 5.00, 10.00, 5000.00)`,
      [newRoomId, newRoomId]
    );

    await connection.commit();

    // 5. ส่งแจ้งเตือนไปยัง Admin ทุกคน
    await lineService.notifyAdminRoomRequest({
      applicantName: realName || req.user.display_name,
      applicantUsername: req.user.username,
      roomName,
      phone
    });

    res.json({
      success: true,
      message: 'ส่งคำขอสร้างห้องเรียบร้อยแล้ว กรุณารอผู้ดูแลระบบอนุมัติ',
      roomId: newRoomId,
      code: roomCode
    });
  } catch (err) {
    await connection.rollback();
    console.error('createRoom error:', err);
    res.status(500).json({ success: false, message: err.message });
  } finally {
    connection.release();
  }
}

/**
 * กรอกรหัส PIN 6 หลักเพื่อขอเข้าร่วมห้อง
 */
export async function joinRoom(req, res) {
  try {
    const { code } = req.body;
    const userId = req.user.id;

    if (!code || code.length !== 6) {
      return res.status(400).json({ success: false, message: 'กรุณากรอกรหัสห้อง 6 หลักให้ถูกต้อง' });
    }

    const cleanCode = code.toUpperCase().trim();
    const [rooms] = await pool.query('SELECT * FROM rooms WHERE code = ? AND status = "ACTIVE"', [cleanCode]);
    if (!rooms.length) {
      return res.status(404).json({ success: false, message: 'ไม่พบห้องที่ตรงกับรหัสนี้ หรือห้องไม่ได้เปิดใช้งาน' });
    }

    const room = rooms[0];

    // ตรวจสอบว่าเคยขอเข้าร่วมหรืออยู่ในห้องนี้แล้วหรือยัง
    const [existing] = await pool.query(
      'SELECT * FROM room_members WHERE room_id = ? AND user_id = ?',
      [room.id, userId]
    );

    if (existing.length) {
      if (existing[0].status === 'APPROVED') {
        return res.status(400).json({ success: false, message: 'คุณเป็นสมาชิกในห้องนี้อยู่แล้ว' });
      }
      if (existing[0].status === 'PENDING') {
        return res.status(400).json({ success: false, message: 'คุณได้ส่งคำขอเข้าร่วมห้องนี้ไปแล้ว กรุณารอหัวหน้ายืนยัน' });
      }
      // หากเคยถูกปฏิเสธหรือเตะ ให้ reset เป็น PENDING
      await pool.query(
        'UPDATE room_members SET status = "PENDING", joined_at = NOW() WHERE id = ?',
        [existing[0].id]
      );
    } else {
      await pool.query(
        'INSERT INTO room_members (room_id, user_id, status) VALUES (?, ?, "PENDING")',
        [room.id, userId]
      );
    }

    // ส่งข้อความแจ้งเตือนไปหาหัวหน้าห้อง
    await lineService.notifyLeaderJoinRequest({
      leaderId: room.leader_id,
      memberId: userId,
      memberName: req.user.display_name,
      memberProfilePic: req.user.profile_pic_url
    });

    res.json({
      success: true,
      message: `ส่งคำขอเข้าร่วมห้อง "${room.name}" เรียบร้อยแล้ว กรุณารอหัวหน้าห้องยืนยัน`,
      roomName: room.name
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

/**
 * ดึงรายการสมาชิกที่รอการอนุมัติเข้าร่วมห้อง (สำหรับหัวหน้า)
 */
export async function getPendingJoinRequests(req, res) {
  try {
    const roomId = req.user.room_id;
    if (!roomId) return res.status(400).json({ success: false, message: 'คุณไม่ได้อยู่ในห้องใดๆ' });

    const [rows] = await pool.query(
      `SELECT rm.id as request_id, rm.joined_at, u.id as user_id, u.display_name, u.real_name, u.nickname, u.phone, u.profile_pic_url
       FROM room_members rm
       JOIN users u ON rm.user_id = u.id
       WHERE rm.room_id = ? AND rm.status = 'PENDING'
       ORDER BY rm.joined_at ASC`,
      [roomId]
    );

    res.json({ success: true, requests: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

/**
 * หัวหน้ากดยืนยันให้ลูกทีมเข้าห้อง
 */
export async function approveMember(req, res) {
  const connection = await pool.getConnection();
  try {
    const { userId } = req.body;
    const roomId = req.user.room_id;

    await connection.beginTransaction();

    await connection.query(
      'UPDATE room_members SET status = "APPROVED" WHERE room_id = ? AND user_id = ?',
      [roomId, userId]
    );

    await connection.query(
      'UPDATE users SET room_id = ?, role = "MEMBER" WHERE id = ?',
      [roomId, userId]
    );

    await connection.commit();

    // เปลี่ยน Rich Menu ของสมาชิก
    await lineService.updateUserRichMenu(userId, 'MEMBER');

    emitToUser(userId, 'room_approved', { roomId });
    emitToRoom(roomId, 'team_updated', { userId, action: 'JOINED' });

    res.json({ success: true, message: 'อนุมัติสมาชิกเรียบร้อยแล้ว' });
  } catch (err) {
    await connection.rollback();
    res.status(500).json({ success: false, message: err.message });
  } finally {
    connection.release();
  }
}

/**
 * หัวหน้าปฏิเสธคำขอเข้าห้อง
 */
export async function rejectMember(req, res) {
  try {
    const { userId } = req.body;
    const roomId = req.user.room_id;

    await pool.query(
      'UPDATE room_members SET status = "REJECTED" WHERE room_id = ? AND user_id = ?',
      [roomId, userId]
    );

    emitToUser(userId, 'room_rejected', { roomId });

    res.json({ success: true, message: 'ปฏิเสธคำขอเข้าห้องแล้ว' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

/**
 * หัวหน้าเตะสมาชิกออกจากห้อง
 */
export async function kickMember(req, res) {
  const connection = await pool.getConnection();
  try {
    const { memberId } = req.body;
    const roomId = req.user.room_id;

    if (memberId === req.user.id) {
      return res.status(400).json({ success: false, message: 'ไม่สามารถเตะตัวเองออกจากห้องได้' });
    }

    await connection.beginTransaction();

    await connection.query(
      'UPDATE room_members SET status = "KICKED" WHERE room_id = ? AND user_id = ?',
      [roomId, memberId]
    );

    await connection.query(
      'UPDATE users SET room_id = NULL, role = "GUEST" WHERE id = ?',
      [memberId]
    );

    await connection.commit();

    // เปลี่ยน Rich Menu กลับเป็นผู้ใช้ใหม่
    await lineService.updateUserRichMenu(memberId, 'GUEST');

    emitToUser(memberId, 'kicked_from_room', { roomId });
    emitToRoom(roomId, 'team_updated', { memberId, action: 'KICKED' });

    res.json({ success: true, message: 'เตะสมาชิกออกจากห้องเรียบร้อยแล้ว' });
  } catch (err) {
    await connection.rollback();
    res.status(500).json({ success: false, message: err.message });
  } finally {
    connection.release();
  }
}

/**
 * สมาชิกออกจากห้องเอง
 */
export async function leaveRoom(req, res) {
  const connection = await pool.getConnection();
  try {
    const userId = req.user.id;
    const roomId = req.user.room_id;

    if (req.user.role === 'LEADER') {
      return res.status(400).json({ success: false, message: 'หัวหน้าไม่สามารถกดออกจากห้องได้ (ต้องยุบห้องแทน)' });
    }

    await connection.beginTransaction();

    await connection.query(
      'UPDATE room_members SET status = "KICKED" WHERE room_id = ? AND user_id = ?',
      [roomId, userId]
    );

    await connection.query(
      'UPDATE users SET room_id = NULL, role = "GUEST" WHERE id = ?',
      [userId]
    );

    await connection.commit();

    await lineService.updateUserRichMenu(userId, 'GUEST');
    emitToRoom(roomId, 'team_updated', { userId, action: 'LEFT' });

    res.json({ success: true, message: 'ออกจากห้องเรียบร้อยแล้ว' });
  } catch (err) {
    await connection.rollback();
    res.status(500).json({ success: false, message: err.message });
  } finally {
    connection.release();
  }
}

/**
 * หัวหน้ากดยุบห้อง
 */
export async function disbandRoom(req, res) {
  const connection = await pool.getConnection();
  try {
    const leaderId = req.user.id;
    const roomId = req.user.room_id;

    if (!roomId) {
      return res.status(400).json({ success: false, message: 'คุณไม่ได้อยู่ในห้องใดๆ' });
    }

    // ตรวจสอบว่าห้องนี้มีอยู่จริงและผู้ใช้เป็นหัวหน้าห้อง
    const [rooms] = await connection.query(
      'SELECT * FROM rooms WHERE id = ? AND leader_id = ?',
      [roomId, leaderId]
    );
    if (!rooms.length) {
      return res.status(403).json({ success: false, message: 'คุณไม่มีสิทธิ์ยุบห้องนี้ หรือไม่พบห้อง' });
    }

    const room = rooms[0];

    await connection.beginTransaction();

    // 1. อัปเดตสถานะห้องเป็น DISBANDED
    await connection.query(
      'UPDATE rooms SET status = "DISBANDED" WHERE id = ?',
      [roomId]
    );

    // 2. ปรับสถานะสมาชิกในห้องเป็น KICKED ในตาราง room_members
    await connection.query(
      'UPDATE room_members SET status = "KICKED" WHERE room_id = ?',
      [roomId]
    );

    // ดึง user IDs ทั้งหมดในห้อง (รวมหัวหน้าและลูกทีม) เพื่ออัปเดต LINE Rich Menu และ socket
    const [members] = await connection.query(
      'SELECT id FROM users WHERE room_id = ?',
      [roomId]
    );

    // 3. ปรับ users ทุกคนในห้อง (ทั้งหัวหน้าและลูกทีม) ให้ role = 'GUEST' และ room_id = NULL
    await connection.query(
      'UPDATE users SET room_id = NULL, role = "GUEST" WHERE room_id = ?',
      [roomId]
    );

    await connection.commit();

    // 4. แจ้งเตือนและอัปเดต LINE Rich Menu
    for (const m of members) {
      lineService.updateUserRichMenu(m.id, 'GUEST').catch(() => {});
      emitToUser(m.id, 'room_disbanded', { roomId, roomName: room.name });
    }
    emitToRoom(roomId, 'room_disbanded', { roomId, roomName: room.name });

    res.json({ success: true, message: `ยุบห้อง "${room.name}" เรียบร้อยแล้ว` });
  } catch (err) {
    await connection.rollback();
    console.error('disbandRoom error:', err);
    res.status(500).json({ success: false, message: err.message });
  } finally {
    connection.release();
  }
}

