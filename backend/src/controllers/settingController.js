import { pool } from '../config/db.js';
import { emitToRoom } from '../services/socketService.js';

export async function getSettings(req, res) {
  try {
    const roomId = req.user.room_id;
    if (!roomId) return res.status(400).json({ success: false, message: 'คุณไม่ได้อยู่ในห้องใดๆ' });

    // ดึงการตั้งค่าของแต่ละประเภทหวย
    const [settings] = await pool.query(
      `SELECT rs.*, l.name as lottery_name, l.code as lottery_code
       FROM room_settings rs
       JOIN lotteries l ON rs.lottery_id = l.id
       WHERE rs.room_id = ?`,
      [roomId]
    );

    // ดึงกฎพิเศษของงวดปัจจุบัน
    const [rules] = await pool.query(
      `SELECT rnr.*, dp.period_name
       FROM room_number_rules rnr
       JOIN draw_periods dp ON rnr.draw_period_id = dp.id
       WHERE rnr.room_id = ?
       ORDER BY rnr.id DESC`,
      [roomId]
    );

    res.json({ success: true, settings, rules });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

export async function updateSettings(req, res) {
  try {
    const roomId = req.user.room_id;
    const { settingsList } = req.body;

    if (!Array.isArray(settingsList)) {
      return res.status(400).json({ success: false, message: 'ข้อมูลไม่ถูกต้อง' });
    }

    for (const item of settingsList) {
      await pool.query(
        `UPDATE room_settings
         SET rate_3top = ?, rate_3tod = ?, rate_2top = ?, rate_2bottom = ?,
             rate_run_top = ?, rate_run_bottom = ?,
             comm_3top = ?, comm_3tod = ?, comm_2top = ?, comm_2bottom = ?,
             comm_run_top = ?, comm_run_bottom = ?, commission_rate = ?,
             default_limit_per_number = ?, is_enabled = ?
         WHERE room_id = ? AND lottery_id = ?`,
        [
          item.rate_3top, item.rate_3tod, item.rate_2top, item.rate_2bottom,
          item.rate_run_top, item.rate_run_bottom,
          item.comm_3top ?? 8.00, item.comm_3tod ?? 8.00, item.comm_2top ?? 5.00, item.comm_2bottom ?? 5.00,
          item.comm_run_top ?? 5.00, item.comm_run_bottom ?? 5.00, item.commission_rate ?? 10.00,
          item.default_limit_per_number, item.is_enabled ? 1 : 0,
          roomId, item.lottery_id
        ]
      );
    }

    res.json({ success: true, message: 'บันทึกการตั้งค่าเรียบร้อยแล้ว' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

export async function addNumberRule(req, res) {
  try {
    const roomId = req.user.room_id;
    const { drawPeriodId, number, betType, ruleType, customLimit, note } = req.body;

    if (!drawPeriodId || !number || !ruleType) {
      return res.status(400).json({ success: false, message: 'กรุณากรอกข้อมูลให้ครบถ้วน' });
    }

    await pool.query(
      `INSERT INTO room_number_rules (room_id, draw_period_id, number, bet_type, rule_type, custom_limit, note)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [roomId, drawPeriodId, number.trim(), betType || 'ALL', ruleType, customLimit || null, note || null]
    );

    // แจ้งเตือนผ่าน Socket ให้หน้าคีย์เลขอัปเดต Realtime
    emitToRoom(roomId, 'rules_updated', { roomId, drawPeriodId });
    emitToRoom(roomId, 'quota_updated', { roomId, drawPeriodId });

    res.json({ success: true, message: 'เพิ่มกฎตัวเลขเรียบร้อยแล้ว' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

export async function deleteNumberRule(req, res) {
  try {
    const roomId = req.user.room_id;
    const { ruleId } = req.params;

    // หา draw_period_id เพื่อส่ง socket update
    const [existing] = await pool.query(
      'SELECT draw_period_id FROM room_number_rules WHERE id = ? AND room_id = ?',
      [ruleId, roomId]
    );

    await pool.query(
      'DELETE FROM room_number_rules WHERE id = ? AND room_id = ?',
      [ruleId, roomId]
    );

    const drawPeriodId = existing[0]?.draw_period_id;
    emitToRoom(roomId, 'rules_updated', { roomId, drawPeriodId });
    emitToRoom(roomId, 'quota_updated', { roomId, drawPeriodId });

    res.json({ success: true, message: 'ลบกฎตัวเลขเรียบร้อยแล้ว' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}
