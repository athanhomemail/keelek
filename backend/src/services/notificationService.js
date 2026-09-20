import { pool } from '../config/db.js';
import { emitToUser, emitToRoom, getIO } from './socketService.js';

class NotificationService {
  /**
   * บันทึกการแจ้งเตือนลงฐานข้อมูลและกระจายแบบ Real-time ผ่าน Socket.io
   */
  async createNotification({ recipientUserId = null, roomId = null, title, message, type = 'SYSTEM', meta = {} }) {
    try {
      console.log(`\n📢 [IN-APP NOTIFICATION] Recipient: ${recipientUserId || (roomId ? `Room ${roomId}` : 'BROADCAST')}, Type: ${type}`);
      console.log(`Title: ${title}`);
      console.log(`Message: ${message}`);

      // บันทึกลงตาราง system_notifications
      const [result] = await pool.query(
        `INSERT INTO system_notifications (recipient_user_id, room_id, title, message, type, meta_json)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [recipientUserId, roomId, title, message, type, JSON.stringify(meta)]
      );

      const notificationPayload = {
        id: result.insertId,
        recipientUserId,
        roomId,
        title,
        message,
        type,
        meta,
        isRead: false,
        createdAt: new Date().toISOString()
      };

      // ส่ง Socket Event
      const io = getIO();
      if (io) {
        if (recipientUserId) {
          emitToUser(recipientUserId, 'notification_received', notificationPayload);
        } else if (roomId) {
          emitToRoom(roomId, 'notification_received', notificationPayload);
        } else {
          io.emit('notification_received', notificationPayload);
        }
      }

      return { success: true, notificationId: result.insertId };
    } catch (err) {
      console.error('Error in NotificationService.createNotification:', err.message);
      return { success: false, error: err.message };
    }
  }

  /**
   * แจ้งเตือน Admin เมื่อมีผู้ใช้ขอสร้างห้องคีย์ใหม่
   */
  async notifyAdminRoomRequest({ applicantName, applicantUsername, roomName, phone }) {
    try {
      const [admins] = await pool.query('SELECT id FROM users WHERE role = "ADMIN"');
      const title = `🏢 มีคำขอเปิดห้องคีย์ใหม่`;
      const message = `ผู้ใช้ "${applicantName}" (@${applicantUsername || 'user'}) ได้ขอสร้างห้อง "${roomName}" (โทร: ${phone || 'ไม่ระบุ'})`;

      for (const admin of admins) {
        await this.createNotification({
          recipientUserId: admin.id,
          title,
          message,
          type: 'APPROVAL',
          meta: { roomName, applicantName, applicantUsername, phone, action: 'ROOM_REQUEST' }
        });
      }
    } catch (err) {
      console.error('notifyAdminRoomRequest error:', err);
    }
  }

  /**
   * แจ้งเตือนผู้ขอสร้างห้องเมื่อได้รับการอนุมัติเป็นหัวหน้า
   */
  async notifyLeaderApproved({ leaderId, roomName, roomCode }) {
    const title = `✅ ห้องของคุณได้รับการอนุมัติแล้ว!`;
    const message = `ยินดีด้วย! ห้อง "${roomName}" ได้รับการอนุมัติแล้ว คุณเป็นหัวหน้าห้องเรียบร้อย รหัสห้องของคุณคือ: ${roomCode}`;

    return this.createNotification({
      recipientUserId: leaderId,
      title,
      message,
      type: 'APPROVAL',
      meta: { roomName, roomCode, action: 'ROOM_APPROVED' }
    });
  }

  /**
   * แจ้งเตือนหัวหน้าห้องเมื่อมีสมาชิกลูกทีมขอเข้าร่วมห้อง
   */
  async notifyLeaderJoinRequest({ leaderId, memberId, memberName, memberNickname, memberUsername, memberPhone, memberProfilePic, roomId, roomName }) {
    const title = `👤 สมาชิกขอเข้าร่วมห้อง`;
    const message = `ผู้ใช้ "${memberName}" ขอเข้าร่วมห้อง "${roomName || 'ของคุณ'}" กรุณาตรวจสอบและอนุมัติ`;

    return this.createNotification({
      recipientUserId: leaderId,
      title,
      message,
      type: 'APPROVAL',
      meta: {
        memberId,
        memberName,
        memberNickname,
        memberUsername,
        memberPhone,
        memberProfilePic,
        roomId,
        roomName,
        action: 'MEMBER_JOIN_REQUEST'
      }
    });
  }

  /**
   * แจ้งเตือนสมาชิกเมื่อได้รับการอนุมัติเข้าห้อง
   */
  async notifyMemberApproved({ memberId, roomName }) {
    const title = `🎉 เข้าร่วมห้องสำเร็จ!`;
    const message = `คุณได้รับการอนุมัติให้เข้าร่วมห้อง "${roomName}" เรียบร้อยแล้ว สามารถเริ่มคีย์เลขได้ทันที`;

    return this.createNotification({
      recipientUserId: memberId,
      title,
      message,
      type: 'APPROVAL',
      meta: { roomName, action: 'MEMBER_APPROVED' }
    });
  }

  /**
   * แจ้งเตือนหัวหน้าเมื่อมีบิลหวยใหม่ถูกคีย์เข้ามา
   */
  async notifyLeaderNewBill({ leaderId, roomName, billNo, memberName, customerName, note, totalAmount, billId }) {
    const title = `🧾 บิลหวยใหม่: ${billNo}`;
    let extra = '';
    if (customerName) {
      extra = ` (${customerName})`;
    } else if (note) {
      extra = ` (${note})`;
    }
    const message = `"${memberName}" คีย์บิล ${billNo}${extra} ยอดรวม ${Number(totalAmount).toLocaleString()} บาท ในห้อง "${roomName}"`;

    return this.createNotification({
      recipientUserId: leaderId,
      title,
      message,
      type: 'BILL',
      meta: { billId, billNo, memberName, customerName, note, totalAmount, roomName }
    });
  }

  /**
   * แจ้งเตือนประกาศผลสลากหวยออก
   */
  async notifyDrawResult({ periodName, result3top, result2top, result2bottom, roomId = null }) {
    const title = `🎉 ประกาศผลสลาก: ${periodName}`;
    const message = `ผลออกแล้ว!\n3 ตัวบน: ${result3top} | 2 ตัวบน: ${result2top} | 2 ตัวล่าง: ${result2bottom}`;

    return this.createNotification({
      recipientUserId: null,
      roomId,
      title,
      message,
      type: 'DRAW_RESULT',
      meta: { periodName, result3top, result2top, result2bottom }
    });
  }

  /**
   * No-op method: LINE Rich Menu has been removed in favor of web app navigation
   */
  async updateUserRichMenu() {
    return true;
  }
}

export const notificationService = new NotificationService();
// Export as lineService as well for backwards compatibility if needed
export const lineService = notificationService;
