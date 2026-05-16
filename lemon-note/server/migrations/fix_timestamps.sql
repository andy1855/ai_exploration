-- 修复 users/login_logs/verification_codes 的时间数据
-- 原数据是 MySQL unix_timestamp() 秒级值，转换时被多除了 1000
-- 需要反向恢复原始秒值，重新格式化为 VARCHAR(26)

-- 修复 users
UPDATE lemonnotedb.users SET created_at = CONCAT(
  DATE_FORMAT(FROM_UNIXTIME(
    UNIX_TIMESTAMP(SUBSTRING_INDEX(created_at, '.', 1)) * 1000
    + CAST(SUBSTRING_INDEX(created_at, '.', -1) AS UNSIGNED)
  ), '%Y-%m-%d %H:%i:%s'),
  '.', '000'
) WHERE created_at < '2020-01-01';

-- 修复 login_logs
UPDATE lemonnotedb.login_logs SET created_at = CONCAT(
  DATE_FORMAT(FROM_UNIXTIME(
    UNIX_TIMESTAMP(SUBSTRING_INDEX(created_at, '.', 1)) * 1000
    + CAST(SUBSTRING_INDEX(created_at, '.', -1) AS UNSIGNED)
  ), '%Y-%m-%d %H:%i:%s'),
  '.', '000'
) WHERE created_at < '2020-01-01';

-- 修复 verification_codes created_at
UPDATE lemonnotedb.verification_codes SET created_at = CONCAT(
  DATE_FORMAT(FROM_UNIXTIME(
    UNIX_TIMESTAMP(SUBSTRING_INDEX(created_at, '.', 1)) * 1000
    + CAST(SUBSTRING_INDEX(created_at, '.', -1) AS UNSIGNED)
  ), '%Y-%m-%d %H:%i:%s'),
  '.', '000'
) WHERE created_at < '2020-01-01';

-- 修复 verification_codes expires_at
UPDATE lemonnotedb.verification_codes SET expires_at = CONCAT(
  DATE_FORMAT(FROM_UNIXTIME(
    UNIX_TIMESTAMP(SUBSTRING_INDEX(expires_at, '.', 1)) * 1000
    + CAST(SUBSTRING_INDEX(expires_at, '.', -1) AS UNSIGNED)
  ), '%Y-%m-%d %H:%i:%s'),
  '.', '000'
) WHERE expires_at < '2020-01-01';
