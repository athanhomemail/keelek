import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { pool } from '../config/db.js';
import { lineService } from '../services/lineService.js';

function generateToken(user) {
  return jwt.sign(
    { id: user.id, username: user.username, role: user.role, roomId: user.room_id },
    process.env.JWT_SECRET || 'keelek_super_secure_jwt_secret_key_2026',
    { expiresIn: '30d' }
  );
}

export async function login(req, res) {
  try {
    const { username, password, userId } = req.body;

    let user;
    if (userId) {
      const [rows] = await pool.query(
        `SELECT u.id, u.username, u.display_name, u.real_name, u.nickname, u.phone, u.email,
                u.bank_name, u.account_no, u.promptpay, u.profile_pic_url, u.role,
                COALESCE(u.room_id, r_lead.id, rm.room_id) as room_id,
                u.status,
                COALESCE(r_direct.name, r_lead.name, r_member.name) as room_name,
                COALESCE(r_direct.code, r_lead.code, r_member.code) as room_code,
                COALESCE(r_direct.status, r_lead.status, r_member.status) as room_status
         FROM users u
         LEFT JOIN rooms r_direct ON u.room_id = r_direct.id
         LEFT JOIN rooms r_lead ON (r_lead.leader_id = u.id AND r_lead.status = 'ACTIVE')
         LEFT JOIN room_members rm ON (rm.user_id = u.id AND rm.status = 'APPROVED')
         LEFT JOIN rooms r_member ON rm.room_id = r_member.id
         WHERE u.id = ?`,
        [userId]
      );
      if (!rows.length) {
        return res.status(404).json({ success: false, message: 'ไม่พบข้อมูลผู้ใช้' });
      }
      user = rows[0];
    } else {
      if (!username || !password) {
        return res.status(400).json({ success: false, message: 'กรุณากรอกชื่อผู้ใช้และรหัสผ่าน' });
      }

      const [rows] = await pool.query(
        `SELECT u.id, u.username, u.password, u.display_name, u.real_name, u.nickname, u.phone, u.email,
                u.bank_name, u.account_no, u.promptpay, u.profile_pic_url, u.role,
                COALESCE(u.room_id, r_lead.id, rm.room_id) as room_id,
                u.status,
                COALESCE(r_direct.name, r_lead.name, r_member.name) as room_name,
                COALESCE(r_direct.code, r_lead.code, r_member.code) as room_code,
                COALESCE(r_direct.status, r_lead.status, r_member.status) as room_status
         FROM users u
         LEFT JOIN rooms r_direct ON u.room_id = r_direct.id
         LEFT JOIN rooms r_lead ON (r_lead.leader_id = u.id AND r_lead.status = 'ACTIVE')
         LEFT JOIN room_members rm ON (rm.user_id = u.id AND rm.status = 'APPROVED')
         LEFT JOIN rooms r_member ON rm.room_id = r_member.id
         WHERE u.username = ?`,
        [username.trim()]
      );
      if (!rows.length) {
        return res.status(401).json({ success: false, message: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง' });
      }

      user = rows[0];
      const isValid = await bcrypt.compare(password, user.password).catch(() => false);
      if (!isValid) {
        return res.status(401).json({ success: false, message: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง' });
      }
    }

    if (user.status === 'BANNED') {
      return res.status(403).json({ success: false, message: 'บัญชีนี้ถูกระงับการใช้งาน' });
    }

    // Sync room_id back to users table if missing but resolved
    if (user.room_id && !user.u_room_id) {
      await pool.query('UPDATE users SET room_id = ? WHERE id = ? AND room_id IS NULL', [user.room_id, user.id]).catch(() => {});
    }

    const token = generateToken(user);
    delete user.password;

    res.json({
      success: true,
      token,
      user
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาดในการเข้าสู่ระบบ' });
  }
}

export async function getProfile(req, res) {
  try {
    const [users] = await pool.query(
      `SELECT u.id, u.username, u.display_name, u.real_name, u.nickname, u.phone, u.email,
              u.bank_name, u.account_no, u.promptpay, u.profile_pic_url, u.role,
              COALESCE(u.room_id, r_lead.id, rm.room_id) as room_id,
              u.status,
              COALESCE(r_direct.name, r_lead.name, r_member.name) as room_name,
              COALESCE(r_direct.code, r_lead.code, r_member.code) as room_code,
              COALESCE(r_direct.status, r_lead.status, r_member.status) as room_status
       FROM users u
       LEFT JOIN rooms r_direct ON u.room_id = r_direct.id
       LEFT JOIN rooms r_lead ON (r_lead.leader_id = u.id AND r_lead.status = 'ACTIVE')
       LEFT JOIN room_members rm ON (rm.user_id = u.id AND rm.status = 'APPROVED')
       LEFT JOIN rooms r_member ON rm.room_id = r_member.id
       WHERE u.id = ?`,
      [req.user.id]
    );

    if (!users.length) {
      return res.status(404).json({ success: false, message: 'ไม่พบข้อมูลผู้ใช้' });
    }

    res.json({ success: true, user: users[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

export async function listSimulatorUsers(req, res) {
  try {
    const [users] = await pool.query(
      `SELECT u.id, u.username, u.display_name, u.role, u.room_id, u.status, u.email,
              r.name as room_name, r.code as room_code
       FROM users u
       LEFT JOIN rooms r ON u.room_id = r.id
       ORDER BY FIELD(u.role, 'ADMIN', 'LEADER', 'MEMBER', 'GUEST'), u.id ASC`
    );
    res.json({ success: true, users });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

export async function register(req, res) {
  try {
    const { username, password, displayName, email, realName, nickname, phone, bankName, accountNo, promptpay } = req.body;

    if (!username || !password || !displayName) {
      return res.status(400).json({ success: false, message: 'กรุณากรอกชื่อผู้ใช้ รหัสผ่าน และชื่อแสดงให้ครบถ้วน' });
    }

    if (!bankName || (!accountNo && !promptpay)) {
      return res.status(400).json({ success: false, message: 'กรุณาเลือกบัญชีและกรอกข้อมูลเลขที่บัญชีหรือพร้อมเพย์' });
    }

    // Check if username already exists
    const [existing] = await pool.query('SELECT id FROM users WHERE username = ?', [username.trim()]);
    if (existing.length) {
      return res.status(400).json({ success: false, message: 'ชื่อผู้ใช้นี้มีคนใช้แล้ว กรุณาเลือกชื่อผู้ใช้อื่น' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const [result] = await pool.query(
      `INSERT INTO users (username, password, display_name, email, real_name, nickname, phone, bank_name, account_no, promptpay, role, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'GUEST', 'ACTIVE')`,
      [username.trim(), hashedPassword, displayName.trim(), email ? email.trim() : null, realName || null, nickname || null, phone ? phone.trim() : null, bankName || null, accountNo ? accountNo.trim() : null, promptpay ? promptpay.trim() : null]
    );

    const newUser = {
      id: result.insertId,
      username: username.trim(),
      display_name: displayName.trim(),
      real_name: realName ? realName.trim() : null,
      email: email ? email.trim() : null,
      phone: phone ? phone.trim() : null,
      bank_name: bankName || null,
      account_no: accountNo || null,
      promptpay: promptpay || null,
      role: 'GUEST',
      room_id: null,
      status: 'ACTIVE'
    };
    const token = generateToken(newUser);

    res.json({
      success: true,
      message: 'ลงทะเบียนสำเร็จ ยินดีต้อนรับสู่ Kee-Lek',
      token,
      user: newUser
    });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาดในการลงทะเบียน: ' + err.message });
  }
}
