import { pool } from '../config/db.js';

export async function getLotteries(req, res) {
  try {
    const [rows] = await pool.query('SELECT * FROM lotteries WHERE is_active = TRUE ORDER BY id ASC');
    res.json({ success: true, lotteries: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

export async function getDrawPeriods(req, res) {
  try {
    const { status } = req.query;
    let query = `
      SELECT dp.*, l.name as lottery_name, l.code as lottery_code
      FROM draw_periods dp
      JOIN lotteries l ON dp.lottery_id = l.id
    `;
    const params = [];

    if (status) {
      query += ' WHERE dp.status = ?';
      params.push(status);
    }

    query += ' ORDER BY dp.period_date DESC, dp.id DESC';

    const [rows] = await pool.query(query, params);
    res.json({ success: true, periods: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}
