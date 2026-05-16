import type { Pool } from 'mysql2/promise';
import { formatDbTimestamp } from '../utils/timestamp';

/**
 * 启动时添加缺失列（1060 重复列则忽略）。
 * 将时间列从 BIGINT 改为 VARCHAR(26) 请在库上执行 `migrations/schema_timestamp.sql`。
 */
const STATEMENTS = [
  'ALTER TABLE sheets ADD COLUMN is_deleted TINYINT(1) NOT NULL DEFAULT 0',
  'ALTER TABLE sheets ADD COLUMN deleted_at VARCHAR(26) NULL DEFAULT NULL',
  'ALTER TABLE note_groups ADD COLUMN is_deleted TINYINT(1) NOT NULL DEFAULT 0',
  'ALTER TABLE note_groups ADD COLUMN deleted_at VARCHAR(26) NULL DEFAULT NULL',
  'ALTER TABLE note_groups ADD COLUMN created_at VARCHAR(26) NULL DEFAULT NULL',
  'ALTER TABLE note_groups ADD COLUMN updated_at VARCHAR(26) NULL DEFAULT NULL',
  'ALTER TABLE verification_codes ADD COLUMN created_at VARCHAR(26) NULL',
  'ALTER TABLE login_logs ADD COLUMN created_at VARCHAR(26) NULL',
];

export async function applyMigrations(pool: Pool): Promise<void> {
  const conn = await pool.getConnection();
  try {
    for (const sql of STATEMENTS) {
      try {
        await conn.query(sql);
      } catch (e: unknown) {
        const err = e as { code?: string; errno?: number; message?: string };
        if (err.errno === 1060 || err.code === 'ER_DUP_FIELDNAME') continue;
        console.warn('[migrate]', sql.slice(0, 70), err.message ?? err);
      }
    }
    console.log('[migrate] ok', formatDbTimestamp());
  } finally {
    conn.release();
  }
}
