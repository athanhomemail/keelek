import jwt from 'jsonwebtoken';
import { pool } from '../config/db.js';

export function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ success: false, message: 'กรุณาเข้าสู่ระบบ (Missing token)' });
  }

  jwt.verify(token, process.env.JWT_SECRET || 'keelek_super_secure_jwt_secret_key_2026', async (err, decoded) => {
    if (err) {
      return res.status(403).json({ success: false, message: 'โทเคนไม่ถูกต้องหรือหมดอายุ' });
    }

    try {
      const [rows] = await pool.query(
        'SELECT id, username, line_user_id, display_name, real_name, nickname, phone, role, room_id, status FROM users WHERE id = ?',
        [decoded.id]
      );

      if (!rows.length || rows[0].status === 'BANNED') {
        return res.status(403).json({ success: false, message: 'บัญชีนี้ถูกระงับการใช้งาน' });
      }

      req.user = rows[0];
      next();
    } catch (dbError) {
      return res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาดในการตรวจสอบสิทธิ์' });
    }
  });
}

export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `คุณไม่มีสิทธิ์เข้าถึงส่วนนี้ (ต้องการสิทธิ์: ${roles.join(', ')})`
      });
    }
    next();
  };
}
