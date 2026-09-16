-- Kee-Lek Initial Seed Data
SET NAMES utf8mb4;
SET CHARACTER SET utf8mb4;

USE keelek;


-- 1. Users Seed
INSERT INTO users (id, username, password, display_name, real_name, nickname, phone, email, bank_name, account_no, promptpay, role, room_id, status)
VALUES
(1, 'admin', '$2b$10$w8g8dCiqhV4uX7yqQdIqKOUQvL6Uqf.L2mOQ0GqWkZ3lGZq6xK9q6', 'ผู้ดูแลระบบ (Admin)', 'แอดมิน สูงสุด', 'แอดมิน', '080-000-0000', 'admin@keelek.com', 'กสิกรไทย', '123-4-56789-0', '0800000000', 'ADMIN', NULL, 'ACTIVE'),
(2, 'leader1', '$2b$10$w8g8dCiqhV4uX7yqQdIqKOUQvL6Uqf.L2mOQ0GqWkZ3lGZq6xK9q6', 'เฮียเก้า (เจ้ามือรวยทรัพย์)', 'เกียรติศักดิ์ มั่งคั่ง', 'เฮียเก้า', '081-234-5678', 'leader1@keelek.com', 'ไทยพาณิชย์', '987-6-54321-0', '0812345678', 'LEADER', 1, 'ACTIVE'),
(3, 'member1', '$2b$10$w8g8dCiqhV4uX7yqQdIqKOUQvL6Uqf.L2mOQ0GqWkZ3lGZq6xK9q6', 'น้องแนน สายบวก', 'นันทนา บุญส่ง', 'แนน', '089-876-5432', 'member1@keelek.com', 'กรุงเทพ', '456-7-89012-3', '0898765432', 'MEMBER', 1, 'ACTIVE'),
(4, 'member2', '$2b$10$w8g8dCiqhV4uX7yqQdIqKOUQvL6Uqf.L2mOQ0GqWkZ3lGZq6xK9q6', 'พี่ท็อป พารวย', 'ทวีชัย เจริญผล', 'ท็อป', '086-555-4321', 'member2@keelek.com', 'กรุงไทย', '321-0-98765-4', '0865554321', 'MEMBER', 1, 'ACTIVE'),
(5, 'guest1', '$2b$10$w8g8dCiqhV4uX7yqQdIqKOUQvL6Uqf.L2mOQ0GqWkZ3lGZq6xK9q6', 'คุณสมชาย (ผู้ใช้ใหม่)', 'สมชาย รักดี', 'ชาย', '085-111-2233', 'guest1@keelek.com', 'กสิกรไทย', '111-2-33445-5', '0851112233', 'GUEST', NULL, 'ACTIVE')
ON DUPLICATE KEY UPDATE id=id;

-- 2. Rooms Seed
INSERT INTO rooms (id, code, name, leader_id, status, expires_at)
VALUES
(1, 'KL8899', 'ห้องรวยทรัพย์ ปลดหนี้ 888', 2, 'ACTIVE', DATE_ADD(NOW(), INTERVAL 365 DAY))
ON DUPLICATE KEY UPDATE id=id;

-- 3. Room Members Seed
INSERT INTO room_members (room_id, user_id, status, joined_at)
VALUES
(1, 3, 'APPROVED', NOW()),
(1, 4, 'APPROVED', NOW())
ON DUPLICATE KEY UPDATE room_id=room_id;

-- 4. Lotteries Seed
INSERT INTO lotteries (id, name, code, is_active)
VALUES
(1, 'หวยรัฐบาลไทย', 'THAI', TRUE),
(2, 'หวยพัฒนาลาว', 'LAO', TRUE)
ON DUPLICATE KEY UPDATE id=id;

-- 5. Draw Periods Seed
-- งวดปัจจุบันสำหรับเปิดรับส่งเลข
INSERT INTO draw_periods (id, lottery_id, period_date, period_name, close_time, status)
VALUES
(1, 1, '2026-09-16', 'หวยไทย งวดประจำวันที่ 16/09/2026', '2026-09-16 15:30:00', 'OPEN'),
(2, 2, '2026-09-16', 'หวยลาว งวดประจำวันที่ 16/09/2026', '2026-09-16 20:00:00', 'OPEN')
ON DUPLICATE KEY UPDATE id=id;

-- 6. Room Settings Seed
INSERT INTO room_settings (room_id, lottery_id, is_enabled, rate_3top, rate_3tod, rate_2top, rate_2bottom, rate_run_top, rate_run_bottom, commission_rate, default_limit_per_number)
VALUES
(1, 1, TRUE, 900.00, 130.00, 95.00, 95.00, 3.20, 4.20, 10.00, 5000.00),
(1, 2, TRUE, 850.00, 120.00, 92.00, 92.00, 3.20, 4.20, 10.00, 5000.00)
ON DUPLICATE KEY UPDATE room_id=room_id;

-- 7. Room Number Rules Seed (ตัวอย่างเลขอั้น / จ่ายครึ่ง)
INSERT INTO room_number_rules (room_id, draw_period_id, number, bet_type, rule_type, custom_limit, note)
VALUES
(1, 1, '89', '2TOP', 'BLOCKED', 0.00, 'เลขอั้นดัง ไม่รับทุกกรณี'),
(1, 1, '89', '2BOTTOM', 'BLOCKED', 0.00, 'เลขอั้นดัง ไม่รับทุกกรณี'),
(1, 1, '95', '2TOP', 'HALF_PAY', 2500.00, 'เลขเด็ด จ่ายครึ่งราคา'),
(1, 1, '729', '3TOP', 'CUSTOM_LIMIT', 1000.00, 'จำกัดยอดรับรวมไม่เกิน 1,000 บาท')
ON DUPLICATE KEY UPDATE id=id;

-- 8. Sample Bills Seed
INSERT INTO bills (id, bill_no, room_id, draw_period_id, user_id, customer_name, note, total_amount, commission_amount, net_dealer_amount, customer_payment_status, member_payment_status, dealer_payment_status, prize_payout_status)
VALUES
(1, 'KL-202609-0001', 1, 1, 3, 'ป้าพร ข้าวแกง', 'จ่ายสดตอนเที่ยง', 500.00, 50.00, 450.00, 'PAID', 'PAID', 'PAID', 'NOT_WON'),
(2, 'KL-202609-0002', 1, 1, 3, 'ลุงสมพร อู่ช่าง', 'ค้างไว้ก่อน', 300.00, 30.00, 270.00, 'UNPAID', 'UNPAID', 'UNPAID', 'NOT_WON'),
(3, 'KL-202609-0003', 1, 1, 4, 'เจ๊หมวย ผลไม้', 'โอนพร้อมเพย์แล้ว', 1200.00, 120.00, 1080.00, 'PAID', 'PAID', 'UNPAID', 'NOT_WON')
ON DUPLICATE KEY UPDATE id=id;

-- 9. Sample Bill Items Seed
INSERT INTO bill_items (bill_id, number, bet_type, amount, pay_rate, is_half_pay, win_status, win_amount)
VALUES
(1, '729', '3TOP', 100.00, 900.00, FALSE, 'PENDING', 0.00),
(1, '29', '2TOP', 200.00, 95.00, FALSE, 'PENDING', 0.00),
(1, '92', '2BOTTOM', 200.00, 95.00, FALSE, 'PENDING', 0.00),
(2, '95', '2TOP', 100.00, 47.50, TRUE, 'PENDING', 0.00),
(2, '59', '2BOTTOM', 200.00, 95.00, FALSE, 'PENDING', 0.00),
(3, '583', '3TOP', 200.00, 900.00, FALSE, 'PENDING', 0.00),
(3, '583', '3TOD', 200.00, 130.00, FALSE, 'PENDING', 0.00),
(3, '83', '2TOP', 400.00, 95.00, FALSE, 'PENDING', 0.00),
(3, '38', '2BOTTOM', 400.00, 95.00, FALSE, 'PENDING', 0.00)
ON DUPLICATE KEY UPDATE id=id;
