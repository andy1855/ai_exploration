-- ============================================
-- Lemon Note: BIGINT -> VARCHAR(26) + deleted 列
-- 先在服务器 pull 最新代码，然后执行此文件
-- mysql -u root < /root/ai_exploration/lemon-note/server/migrations/migrate_now.sql
-- ============================================

-- sheets
ALTER TABLE lemonnotedb.sheets ADD COLUMN deleted TINYINT(1) NOT NULL DEFAULT 0;
ALTER TABLE lemonnotedb.sheets ADD COLUMN deleted_at VARCHAR(26) NULL DEFAULT NULL;
UPDATE lemonnotedb.sheets SET created_at = CONCAT(DATE_FORMAT(FROM_UNIXTIME(FLOOR(created_at / 1000)), '%Y-%m-%d %H:%i:%s'), '.', LPAD(created_at % 1000, 3, '0')) WHERE created_at REGEXP '^[0-9]+$';
UPDATE lemonnotedb.sheets SET updated_at = CONCAT(DATE_FORMAT(FROM_UNIXTIME(FLOOR(updated_at / 1000)), '%Y-%m-%d %H:%i:%s'), '.', LPAD(updated_at % 1000, 3, '0')) WHERE updated_at REGEXP '^[0-9]+$';
ALTER TABLE lemonnotedb.sheets MODIFY COLUMN created_at VARCHAR(26) NOT NULL;
ALTER TABLE lemonnotedb.sheets MODIFY COLUMN updated_at VARCHAR(26) NOT NULL;

-- note_groups
ALTER TABLE lemonnotedb.note_groups ADD COLUMN deleted TINYINT(1) NOT NULL DEFAULT 0;
ALTER TABLE lemonnotedb.note_groups ADD COLUMN deleted_at VARCHAR(26) NULL DEFAULT NULL;
ALTER TABLE lemonnotedb.note_groups ADD COLUMN created_at VARCHAR(26) NULL DEFAULT NULL;
ALTER TABLE lemonnotedb.note_groups ADD COLUMN updated_at VARCHAR(26) NULL DEFAULT NULL;

-- sheet_versions
ALTER TABLE lemonnotedb.sheet_versions ADD COLUMN deleted TINYINT(1) NOT NULL DEFAULT 0;
ALTER TABLE lemonnotedb.sheet_versions ADD COLUMN deleted_at VARCHAR(26) NULL DEFAULT NULL;
UPDATE lemonnotedb.sheet_versions SET created_at = CONCAT(DATE_FORMAT(FROM_UNIXTIME(FLOOR(created_at / 1000)), '%Y-%m-%d %H:%i:%s'), '.', LPAD(created_at % 1000, 3, '0')) WHERE created_at REGEXP '^[0-9]+$';
ALTER TABLE lemonnotedb.sheet_versions MODIFY COLUMN created_at VARCHAR(26) NOT NULL;

-- users
ALTER TABLE lemonnotedb.users ADD COLUMN deleted TINYINT(1) NOT NULL DEFAULT 0;
ALTER TABLE lemonnotedb.users ADD COLUMN deleted_at VARCHAR(26) NULL DEFAULT NULL;
UPDATE lemonnotedb.users SET created_at = CONCAT(DATE_FORMAT(FROM_UNIXTIME(FLOOR(created_at / 1000)), '%Y-%m-%d %H:%i:%s'), '.', LPAD(created_at % 1000, 3, '0')) WHERE created_at REGEXP '^[0-9]+$';
ALTER TABLE lemonnotedb.users MODIFY COLUMN created_at VARCHAR(26) NOT NULL;

-- login_logs
ALTER TABLE lemonnotedb.login_logs ADD COLUMN deleted TINYINT(1) NOT NULL DEFAULT 0;
ALTER TABLE lemonnotedb.login_logs ADD COLUMN deleted_at VARCHAR(26) NULL DEFAULT NULL;
UPDATE lemonnotedb.login_logs SET created_at = CONCAT(DATE_FORMAT(FROM_UNIXTIME(FLOOR(created_at / 1000)), '%Y-%m-%d %H:%i:%s'), '.', LPAD(created_at % 1000, 3, '0')) WHERE created_at REGEXP '^[0-9]+$';
ALTER TABLE lemonnotedb.login_logs MODIFY COLUMN created_at VARCHAR(26) NULL;

-- verification_codes
ALTER TABLE lemonnotedb.verification_codes ADD COLUMN deleted TINYINT(1) NOT NULL DEFAULT 0;
ALTER TABLE lemonnotedb.verification_codes ADD COLUMN deleted_at VARCHAR(26) NULL DEFAULT NULL;
ALTER TABLE lemonnotedb.verification_codes ADD COLUMN created_at VARCHAR(26) NULL;
UPDATE lemonnotedb.verification_codes SET created_at = CONCAT(DATE_FORMAT(FROM_UNIXTIME(FLOOR(created_at / 1000)), '%Y-%m-%d %H:%i:%s'), '.', LPAD(created_at % 1000, 3, '0')) WHERE created_at REGEXP '^[0-9]+$';
ALTER TABLE lemonnotedb.verification_codes MODIFY COLUMN created_at VARCHAR(26) NULL;
UPDATE lemonnotedb.verification_codes SET expires_at = CONCAT(DATE_FORMAT(FROM_UNIXTIME(FLOOR(expires_at / 1000)), '%Y-%m-%d %H:%i:%s'), '.', LPAD(expires_at % 1000, 3, '0')) WHERE expires_at REGEXP '^[0-9]+$';
ALTER TABLE lemonnotedb.verification_codes MODIFY COLUMN expires_at VARCHAR(26) NOT NULL;
