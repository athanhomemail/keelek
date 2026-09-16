-- Kee-Lek (คีย์เลข) Database Schema
-- Database: keelek (under domain kuayrai.com)
-- Character Set: utf8mb4 / utf8mb4_unicode_ci

SET NAMES utf8mb4;
SET CHARACTER SET utf8mb4;

CREATE DATABASE IF NOT EXISTS keelek CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE keelek;


-- 1. Users Table
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    line_user_id VARCHAR(100) UNIQUE NULL,
    display_name VARCHAR(100) NOT NULL,
    real_name VARCHAR(100) NULL,
    nickname VARCHAR(50) NULL,
    phone VARCHAR(20) NULL,
    email VARCHAR(100) NULL,
    bank_name VARCHAR(100) NULL,
    account_no VARCHAR(50) NULL,
    promptpay VARCHAR(50) NULL,
    profile_pic_url VARCHAR(255) NULL,
    role ENUM('ADMIN', 'LEADER', 'MEMBER', 'GUEST') NOT NULL DEFAULT 'GUEST',
    room_id INT NULL,
    status ENUM('ACTIVE', 'PENDING_APPROVAL', 'BANNED') NOT NULL DEFAULT 'ACTIVE',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_user_role (role),
    INDEX idx_user_room (room_id),
    INDEX idx_line_user_id (line_user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Rooms Table
CREATE TABLE IF NOT EXISTS rooms (
    id INT AUTO_INCREMENT PRIMARY KEY,
    code VARCHAR(6) UNIQUE NOT NULL COMMENT '6-digit alphanumeric room PIN e.g. A7K92X',
    name VARCHAR(100) NOT NULL,
    leader_id INT NOT NULL,
    status ENUM('ACTIVE', 'PENDING', 'EXPIRED', 'DISBANDED') NOT NULL DEFAULT 'PENDING',
    expires_at DATETIME NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_room_code (code),
    INDEX idx_room_leader (leader_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. Room Members Table
CREATE TABLE IF NOT EXISTS room_members (
    id INT AUTO_INCREMENT PRIMARY KEY,
    room_id INT NOT NULL,
    user_id INT NOT NULL,
    status ENUM('APPROVED', 'PENDING', 'REJECTED', 'KICKED') NOT NULL DEFAULT 'PENDING',
    joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uk_room_user (room_id, user_id),
    INDEX idx_rm_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. Lotteries Table
CREATE TABLE IF NOT EXISTS lotteries (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(50) NOT NULL COMMENT 'หวยไทย, หวยลาว',
    code VARCHAR(20) UNIQUE NOT NULL COMMENT 'THAI, LAO',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. Draw Periods Table
CREATE TABLE IF NOT EXISTS draw_periods (
    id INT AUTO_INCREMENT PRIMARY KEY,
    lottery_id INT NOT NULL,
    period_date DATE NOT NULL,
    period_name VARCHAR(100) NOT NULL COMMENT 'e.g. งวดประจำวันที่ 16 กันยายน 2569',
    close_time DATETIME NOT NULL,
    status ENUM('OPEN', 'CLOSED', 'DRAWN', 'SETTLED') NOT NULL DEFAULT 'OPEN',
    result_3top VARCHAR(3) NULL,
    result_2top VARCHAR(2) NULL,
    result_2bottom VARCHAR(2) NULL,
    result_3tod_json JSON NULL,
    raw_result_json JSON NULL,
    drawn_at DATETIME NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_dp_lottery (lottery_id),
    INDEX idx_dp_status (status),
    INDEX idx_dp_date (period_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 6. Room Settings Table
CREATE TABLE IF NOT EXISTS room_settings (
    id INT AUTO_INCREMENT PRIMARY KEY,
    room_id INT NOT NULL,
    lottery_id INT NOT NULL,
    is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    rate_3top DECIMAL(10,2) NOT NULL DEFAULT 900.00,
    rate_3tod DECIMAL(10,2) NOT NULL DEFAULT 130.00,
    rate_2top DECIMAL(10,2) NOT NULL DEFAULT 95.00,
    rate_2bottom DECIMAL(10,2) NOT NULL DEFAULT 95.00,
    rate_run_top DECIMAL(10,2) NOT NULL DEFAULT 3.20,
    rate_run_bottom DECIMAL(10,2) NOT NULL DEFAULT 4.20,
    commission_rate DECIMAL(5,2) NOT NULL DEFAULT 10.00 COMMENT '% ส่วนแบ่งลูกทีม',
    default_limit_per_number DECIMAL(12,2) NOT NULL DEFAULT 5000.00 COMMENT 'เพดานรับซื้อสูงสุดต่อเลข',
    close_time_offset_minutes INT NOT NULL DEFAULT 0 COMMENT 'ปิดรับก่อนเวลาทางการ (นาที)',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uk_room_lottery (room_id, lottery_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 7. Room Number Rules (เลขอั้น / เลขจ่ายครึ่ง / จำกัดยอด)
CREATE TABLE IF NOT EXISTS room_number_rules (
    id INT AUTO_INCREMENT PRIMARY KEY,
    room_id INT NOT NULL,
    draw_period_id INT NOT NULL,
    number VARCHAR(10) NOT NULL,
    bet_type ENUM('3TOP', '3TOD', '2TOP', '2BOTTOM', 'RUN_TOP', 'RUN_BOTTOM', 'ALL') NOT NULL,
    rule_type ENUM('BLOCKED', 'HALF_PAY', 'CUSTOM_LIMIT') NOT NULL,
    custom_limit DECIMAL(12,2) NULL,
    note VARCHAR(255) NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_rnr_lookup (room_id, draw_period_id, number)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 8. Bills Table
CREATE TABLE IF NOT EXISTS bills (
    id INT AUTO_INCREMENT PRIMARY KEY,
    bill_no VARCHAR(30) UNIQUE NOT NULL,
    room_id INT NOT NULL,
    draw_period_id INT NOT NULL,
    user_id INT NOT NULL COMMENT 'สมาชิกคนที่คีย์บิลนี้',
    customer_name VARCHAR(100) NOT NULL,
    note TEXT NULL,
    total_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    commission_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    net_dealer_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    total_win_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    customer_payment_status ENUM('UNPAID', 'PAID') NOT NULL DEFAULT 'UNPAID' COMMENT 'ลูกค้าจ่ายให้สมาชิกแล้วหรือยัง',
    member_payment_status ENUM('UNPAID', 'PAID') NOT NULL DEFAULT 'UNPAID' COMMENT 'สมาชิกส่งเงินให้หัวหน้าแล้วหรือยัง',
    dealer_payment_status ENUM('UNPAID', 'PAID') NOT NULL DEFAULT 'UNPAID' COMMENT 'หัวหน้ารับเงินแล้ว',
    prize_payout_status ENUM('NOT_WON', 'PENDING', 'PAID_BY_MEMBER', 'PAID_BY_DEALER') NOT NULL DEFAULT 'NOT_WON' COMMENT 'สถานะการจ่ายเงินรางวัลให้ลูกค้า',
    prize_slip_url VARCHAR(255) NULL,
    status ENUM('ACTIVE', 'CANCELLED') NOT NULL DEFAULT 'ACTIVE' COMMENT 'สถานะบิล (ACTIVE=ใช้งาน, CANCELLED=ยกเลิกคืนโควตา)',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_bills_room (room_id),
    INDEX idx_bills_period (draw_period_id),
    INDEX idx_bills_user (user_id),
    INDEX idx_bills_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 9. Bill Items Table
CREATE TABLE IF NOT EXISTS bill_items (
    id INT AUTO_INCREMENT PRIMARY KEY,
    bill_id INT NOT NULL,
    number VARCHAR(10) NOT NULL,
    bet_type ENUM('3TOP', '3TOD', '2TOP', '2BOTTOM', 'RUN_TOP', 'RUN_BOTTOM') NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    pay_rate DECIMAL(10,2) NOT NULL,
    is_half_pay BOOLEAN NOT NULL DEFAULT FALSE,
    win_status ENUM('PENDING', 'WON', 'LOST') NOT NULL DEFAULT 'PENDING',
    win_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_bi_bill (bill_id),
    INDEX idx_bi_number_bet (number, bet_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 10. System Notifications (Rich Message Log / Simulation)
CREATE TABLE IF NOT EXISTS system_notifications (
    id INT AUTO_INCREMENT PRIMARY KEY,
    recipient_user_id INT NULL COMMENT 'NULL หมายถึงส่งหาทุกคนในห้อง',
    room_id INT NULL,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    type ENUM('BILL', 'DRAW_RESULT', 'APPROVAL', 'SYSTEM') NOT NULL,
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    meta_json JSON NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_notif_user (recipient_user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 11. System Scraper Logs
CREATE TABLE IF NOT EXISTS system_scraper_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    lottery_id INT NOT NULL,
    draw_period_id INT NOT NULL,
    scraped_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    source_url VARCHAR(255) NULL,
    status ENUM('SUCCESS', 'FAILED') NOT NULL,
    raw_data TEXT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
