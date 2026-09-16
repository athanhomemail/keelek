-- Kee-Lek Clean Production Seed Data
-- Database: keelek
-- Contains ONLY 2 initial Admin users and master lottery definitions.

SET NAMES utf8mb4;
SET CHARACTER SET utf8mb4;

USE keelek;

-- 1. Initial Admin Users (Only 2 Admins)
-- Default password for both accounts: admin123
INSERT INTO users (id, username, password, display_name, real_name, nickname, phone, email, role, room_id, status)
VALUES
(1, 'admin', '$2a$10$292plQYJo4JyeHfqlvzTK.KDrWHRZFkNyGrh7dNeyx5/Vx8deaFCu', 'ผู้ดูแลระบบ 1 (Admin)', 'แอดมิน หลัก', 'แอดมิน 1', '080-000-0001', 'admin1@keelek.com', 'ADMIN', NULL, 'ACTIVE'),
(2, 'admin2', '$2a$10$292plQYJo4JyeHfqlvzTK.KDrWHRZFkNyGrh7dNeyx5/Vx8deaFCu', 'ผู้ดูแลระบบ 2 (Admin)', 'แอดมิน สำรอง', 'แอดมิน 2', '080-000-0002', 'admin2@keelek.com', 'ADMIN', NULL, 'ACTIVE')
ON DUPLICATE KEY UPDATE id=id;

-- 2. Master Lotteries
INSERT INTO lotteries (id, name, code, is_active)
VALUES
(1, 'หวยรัฐบาลไทย', 'THAI', TRUE),
(2, 'หวยพัฒนาลาว', 'LAO', TRUE)
ON DUPLICATE KEY UPDATE id=id;

-- 3. Initial Active Draw Periods (งวดเปิดรับเริ่มต้น)
INSERT INTO draw_periods (id, lottery_id, period_date, period_name, close_time, status)
VALUES
(1, 1, '2026-10-01', 'หวยไทย งวดประจำวันที่ 01/10/2026', '2026-10-01 15:30:00', 'OPEN'),
(2, 2, '2026-09-16', 'หวยลาว งวดประจำวันที่ 16/09/2026', '2026-09-16 20:30:00', 'OPEN')
ON DUPLICATE KEY UPDATE id=id;
