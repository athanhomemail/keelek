import express from 'express';
import { authenticateToken, requireRole } from '../middleware/auth.js';
import * as authCtrl from '../controllers/authController.js';
import * as roomCtrl from '../controllers/roomController.js';
import * as lotteryCtrl from '../controllers/lotteryController.js';
import * as betCtrl from '../controllers/betController.js';
import * as billCtrl from '../controllers/billController.js';
import * as teamCtrl from '../controllers/teamController.js';
import * as settingCtrl from '../controllers/settingController.js';
import * as adminCtrl from '../controllers/adminController.js';
import { pool } from '../config/db.js';

const router = express.Router();

// ==================== AUTH & SIMULATOR ====================
router.post('/auth/login', authCtrl.login);
router.post('/auth/register', authCtrl.register);
router.get('/auth/profile', authenticateToken, authCtrl.getProfile);
router.get('/auth/simulator-users', authCtrl.listSimulatorUsers);

// ==================== LOTTERIES & PERIODS ====================
router.get('/lotteries', lotteryCtrl.getLotteries);
router.get('/draw-periods', lotteryCtrl.getDrawPeriods);

// ==================== ROOMS & MEMBERSHIP ====================
router.post('/rooms/create', authenticateToken, roomCtrl.createRoom);
router.post('/rooms/join', authenticateToken, roomCtrl.joinRoom);
router.get('/rooms/pending-requests', authenticateToken, requireRole('LEADER'), roomCtrl.getPendingJoinRequests);
router.post('/rooms/approve-member', authenticateToken, requireRole('LEADER'), roomCtrl.approveMember);
router.post('/rooms/reject-member', authenticateToken, requireRole('LEADER'), roomCtrl.rejectMember);
router.post('/rooms/kick-member', authenticateToken, requireRole('LEADER'), roomCtrl.kickMember);
router.post('/rooms/leave', authenticateToken, roomCtrl.leaveRoom);
router.post('/rooms/disband', authenticateToken, requireRole('LEADER'), roomCtrl.disbandRoom);

// ==================== BETS & REALTIME QUOTA ====================
router.get('/bets/number-rules', authenticateToken, betCtrl.getNumberRules);
router.post('/bets/check-quota', authenticateToken, betCtrl.checkQuota);
router.post('/bets/submit', authenticateToken, betCtrl.submitBill);

// ==================== BILLS & FINANCE ====================
router.get('/bills', authenticateToken, billCtrl.getBills);
router.get('/bills/:id', authenticateToken, billCtrl.getBillDetail);
router.put('/bills/:id', authenticateToken, billCtrl.updateBill);
router.patch('/bills/:id/cancel', authenticateToken, billCtrl.cancelBill);
router.post('/bills/:id/cancel', authenticateToken, billCtrl.cancelBill);
router.patch('/bills/:id/payment-status', authenticateToken, billCtrl.updatePaymentStatus);
router.patch('/bills/:id/prize-payout', authenticateToken, billCtrl.updatePrizePayout);

// ==================== TEAM ====================
router.get('/team/stats', authenticateToken, teamCtrl.getTeamStats);

// ==================== SETTINGS (LEADER ONLY) ====================
router.get('/settings', authenticateToken, requireRole('LEADER'), settingCtrl.getSettings);
router.put('/settings', authenticateToken, requireRole('LEADER'), settingCtrl.updateSettings);
router.post('/settings/number-rule', authenticateToken, requireRole('LEADER'), settingCtrl.addNumberRule);
router.delete('/settings/number-rule/:ruleId', authenticateToken, requireRole('LEADER'), settingCtrl.deleteNumberRule);

// ==================== ADMIN ====================
router.get('/admin/overview', authenticateToken, requireRole('ADMIN'), adminCtrl.getAdminOverview);
router.get('/admin/rooms', authenticateToken, requireRole('ADMIN'), adminCtrl.listRooms);
router.post('/admin/rooms/approve', authenticateToken, requireRole('ADMIN'), adminCtrl.approveRoom);
router.post('/admin/rooms/reject', authenticateToken, requireRole('ADMIN'), adminCtrl.rejectRoom);
router.patch('/admin/rooms/expiration', authenticateToken, requireRole('ADMIN'), adminCtrl.updateRoomExpiration);
router.patch('/admin/rooms/status', authenticateToken, requireRole('ADMIN'), adminCtrl.toggleRoomStatus);
router.post('/admin/scraper/trigger', authenticateToken, requireRole('ADMIN'), adminCtrl.triggerScraper);
router.post('/admin/draw-periods', authenticateToken, requireRole('ADMIN'), adminCtrl.createDrawPeriod);
router.put('/admin/draw-periods/:id', authenticateToken, requireRole('ADMIN'), adminCtrl.updateDrawPeriod);
router.patch('/admin/draw-periods/:id/status', authenticateToken, requireRole('ADMIN'), adminCtrl.updateDrawPeriodStatus);
router.delete('/admin/draw-periods/:id', authenticateToken, requireRole('ADMIN'), adminCtrl.deleteDrawPeriod);

// ==================== NOTIFICATIONS (IN-APP NOTIFICATION CENTER) ====================
router.get('/notifications', authenticateToken, async (req, res) => {
  try {
    const user = req.user;
    const [rows] = await pool.query(
      `SELECT * FROM system_notifications 
       WHERE recipient_user_id = ? OR recipient_user_id IS NULL OR (room_id = ? AND room_id IS NOT NULL)
       ORDER BY id DESC LIMIT 50`,
      [user.id, user.room_id]
    );
    res.json({ success: true, notifications: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.patch('/notifications/:id/read', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query('UPDATE system_notifications SET is_read = TRUE WHERE id = ?', [id]);
    res.json({ success: true, message: 'ทำเครื่องหมายว่าอ่านแล้ว' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.patch('/notifications/read-all', authenticateToken, async (req, res) => {
  try {
    const user = req.user;
    await pool.query(
      `UPDATE system_notifications 
       SET is_read = TRUE 
       WHERE recipient_user_id = ? OR recipient_user_id IS NULL OR (room_id = ? AND room_id IS NOT NULL)`,
      [user.id, user.room_id]
    );
    res.json({ success: true, message: 'ทำเครื่องหมายว่าอ่านแล้วทั้งหมด' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

export default router;
