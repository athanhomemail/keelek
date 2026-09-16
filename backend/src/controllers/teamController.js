import { pool } from '../config/db.js';

export async function getTeamStats(req, res) {
  try {
    const user = req.user;
    const roomId = user.room_id;

    if (!roomId) {
      return res.status(400).json({ success: false, message: 'คุณยังไม่ได้สังกัดห้องคีย์ใดๆ' });
    }

    // 1. ดึงข้อมูลห้องและหัวหน้า
    const [rooms] = await pool.query(
      `SELECT r.id, r.code, r.name, r.leader_id, r.status, r.expires_at,
              u.display_name as leader_name, u.phone as leader_phone, u.profile_pic_url as leader_pic
       FROM rooms r
       JOIN users u ON r.leader_id = u.id
       WHERE r.id = ?`,
      [roomId]
    );

    if (!rooms.length) {
      return res.status(404).json({ success: false, message: 'ไม่พบข้อมูลห้องนี้' });
    }

    const room = rooms[0];

    // 2. ดึงรายชื่อสมาชิกพร้อมสถิติยอดขาย
    const [members] = await pool.query(
      `SELECT u.id, u.username, u.display_name, u.nickname, u.phone, u.profile_pic_url,
              rm.joined_at, rm.status as member_status,
              COUNT(b.id) as total_bills,
              COALESCE(SUM(b.total_amount), 0) as total_sales,
              COALESCE(SUM(b.commission_amount), 0) as total_commission
       FROM room_members rm
       JOIN users u ON rm.user_id = u.id
       LEFT JOIN bills b ON b.user_id = u.id AND b.room_id = ?
       WHERE rm.room_id = ? AND rm.status = 'APPROVED'
       GROUP BY u.id, rm.joined_at, rm.status
       ORDER BY total_sales DESC, total_bills DESC`,
      [roomId, roomId]
    );

    res.json({
      success: true,
      room,
      members,
      isLeader: user.role === 'LEADER'
    });
  } catch (err) {
    console.error('getTeamStats error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
}
