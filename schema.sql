CREATE DATABASE IF NOT EXISTS reconai;

USE reconai;

CREATE TABLE IF NOT EXISTS orders (
    order_id VARCHAR(30) PRIMARY KEY,
    customer_name VARCHAR(100) NOT NULL,
    amount DECIMAL(12,2) NOT NULL,
    order_date DATE NOT NULL,
    status VARCHAR(20) NOT NULL
);

CREATE TABLE IF NOT EXISTS settlements (
    settlement_id INT AUTO_INCREMENT PRIMARY KEY,
    payment_id VARCHAR(30) NOT NULL,
    order_ref VARCHAR(30) NOT NULL,
    gross_amount DECIMAL(12,2) NOT NULL,
    fee DECIMAL(12,2) NOT NULL,
    settled_amount DECIMAL(12,2) NOT NULL,
    settlement_date DATE NOT NULL
);

CREATE TABLE IF NOT EXISTS bank_statement (
    utr VARCHAR(30) PRIMARY KEY,
    amount DECIMAL(12,2) NOT NULL,
    value_date DATE NOT NULL,
    narration VARCHAR(200) NOT NULL
);

CREATE TABLE IF NOT EXISTS reconciliation_log (
    log_id INT AUTO_INCREMENT PRIMARY KEY,
    order_id VARCHAR(30),
    payment_id VARCHAR(30),
    utr VARCHAR(30),
    match_status VARCHAR(30) NOT NULL,
    match_pass VARCHAR(60) NOT NULL,
    confidence VARCHAR(20) NOT NULL,
    category VARCHAR(60),
    difference_amount DECIMAL(12,2),
    raw_reason TEXT,
    ai_explanation TEXT,
    suggested_action TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);