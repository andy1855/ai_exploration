-- Lemon Note：数据库约定
--
-- 1) 软删除：`deleted` TINYINT(1)，0 未删除、1 已删除；`deleted_at` VARCHAR(26) NULL，删除时间 yyyy-MM-dd HH:mm:ss.SSS
-- 2) 日期时间：统一为字符串 `yyyy-MM-dd HH:mm:ss.SSS`，列类型建议 VARCHAR(26)
--
-- 应用启动时会自动 `ALTER TABLE ... ADD COLUMN` 补齐 `deleted` / `deleted_at`，
-- 并将旧列 `is_deleted` 数据迁到 `deleted` 后删除 `is_deleted`（见 server/src/migrations/apply.ts）。
--
-- 以下用于把历史「毫秒 BIGINT」列改为 VARCHAR。请在维护窗口执行前备份库，
-- 按各表实际列类型调整；若已是 VARCHAR 可跳过 UPDATE。

-- ─── sheets ─────────────────────────────────────
-- UPDATE sheets SET
--   created_at = CONCAT(
--     DATE_FORMAT(FROM_UNIXTIME(FLOOR(created_at / 1000)), '%Y-%m-%d %H:%i:%s'),
--     '.',
--     LPAD(created_at % 1000, 3, '0')
--   )
-- WHERE created_at REGEXP '^[0-9]+$';
-- （对 updated_at 同理）
-- ALTER TABLE sheets MODIFY COLUMN created_at VARCHAR(26) NOT NULL;
-- ALTER TABLE sheets MODIFY COLUMN updated_at VARCHAR(26) NOT NULL;
-- ALTER TABLE sheets MODIFY COLUMN deleted_at VARCHAR(26) NULL;

-- ─── note_groups ────────────────────────────────
-- （created_at / updated_at / deleted_at 同上思路转换后）
-- ALTER TABLE note_groups MODIFY COLUMN created_at VARCHAR(26) NULL;
-- ALTER TABLE note_groups MODIFY COLUMN updated_at VARCHAR(26) NULL;
-- ALTER TABLE note_groups MODIFY COLUMN deleted_at VARCHAR(26) NULL;

-- ─── sheet_versions ─────────────────────────────
-- UPDATE sheet_versions SET created_at = ... （同上公式，列名为 created_at）
-- ALTER TABLE sheet_versions MODIFY COLUMN created_at VARCHAR(26) NOT NULL;
-- ALTER TABLE sheet_versions MODIFY COLUMN deleted_at VARCHAR(26) NULL;

-- ─── users ──────────────────────────────────────
-- UPDATE users SET created_at = ...
-- ALTER TABLE users MODIFY COLUMN created_at VARCHAR(26) NOT NULL;
-- ALTER TABLE users MODIFY COLUMN deleted_at VARCHAR(26) NULL;

-- ─── login_logs ─────────────────────────────────
-- ALTER TABLE login_logs MODIFY COLUMN created_at VARCHAR(26) NULL;
-- ALTER TABLE login_logs MODIFY COLUMN deleted_at VARCHAR(26) NULL;

-- ─── verification_codes ────────────────────────
-- expires_at / created_at 若为毫秒 BIGINT，先用 UPDATE 转成字符串再 MODIFY
-- ALTER TABLE verification_codes MODIFY COLUMN expires_at VARCHAR(26) NOT NULL;
-- ALTER TABLE verification_codes MODIFY COLUMN created_at VARCHAR(26) NULL;
-- ALTER TABLE verification_codes MODIFY COLUMN deleted_at VARCHAR(26) NULL;
