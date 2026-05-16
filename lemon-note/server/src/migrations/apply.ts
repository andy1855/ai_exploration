import type { Pool, PoolConnection } from 'mysql2/promise';
import { formatDbTimestamp } from '../utils/timestamp';

function isDupColumnError(e: unknown): boolean {
  const err = e as { code?: string; errno?: number };
  return err.errno === 1060 || err.code === 'ER_DUP_FIELDNAME';
}

async function tryQuery(conn: PoolConnection, sql: string): Promise<boolean> {
  try {
    await conn.query(sql);
    return true;
  } catch (e: unknown) {
    if (isDupColumnError(e)) return false;
    const err = e as { errno?: number; message?: string };
    console.warn('[migrate]', sql.slice(0, 80), err.message ?? e);
    return false;
  }
}

async function columnExists(conn: PoolConnection, table: string, column: string): Promise<boolean> {
  const [rows] = await conn.query(
    `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ? LIMIT 1`,
    [table, column]
  );
  return Array.isArray(rows) && rows.length > 0;
}

/**
 * is_deleted → deleted：复制数据后删除旧列
 */
async function migrateIsDeletedToDeleted(conn: PoolConnection, table: string): Promise<void> {
  if (!(await columnExists(conn, table, 'is_deleted'))) return;
  if (!(await columnExists(conn, table, 'deleted'))) {
    console.warn('[migrate] skip is_deleted migration: missing deleted column on', table);
    return;
  }
  try {
    await conn.query(`UPDATE \`${table}\` SET \`deleted\` = COALESCE(\`is_deleted\`, 0)`);
  } catch (e: unknown) {
    console.warn('[migrate] copy is_deleted → deleted', table, e);
  }
  try {
    await conn.query(`ALTER TABLE \`${table}\` DROP COLUMN \`is_deleted\``);
  } catch (e: unknown) {
    console.warn('[migrate] drop is_deleted', table, e);
  }
}

/**
 * 启动时补齐列、统一 deleted 字段名。
 * 时间列从 BIGINT 迁到 VARCHAR(26) 请先执行仓库内 migrations/schema_timestamp.sql 再重启。
 */
export async function applyMigrations(pool: Pool): Promise<void> {
  const conn = await pool.getConnection();
  try {
    const addColumn = (sql: string) => tryQuery(conn, sql);

    await addColumn('ALTER TABLE sheets ADD COLUMN `deleted` TINYINT(1) NOT NULL DEFAULT 0');
    await addColumn('ALTER TABLE sheets ADD COLUMN `deleted_at` VARCHAR(26) NULL DEFAULT NULL');
    await migrateIsDeletedToDeleted(conn, 'sheets');

    await addColumn('ALTER TABLE note_groups ADD COLUMN `deleted` TINYINT(1) NOT NULL DEFAULT 0');
    await addColumn('ALTER TABLE note_groups ADD COLUMN `deleted_at` VARCHAR(26) NULL DEFAULT NULL');
    await addColumn('ALTER TABLE note_groups ADD COLUMN `created_at` VARCHAR(26) NULL DEFAULT NULL');
    await addColumn('ALTER TABLE note_groups ADD COLUMN `updated_at` VARCHAR(26) NULL DEFAULT NULL');
    await migrateIsDeletedToDeleted(conn, 'note_groups');

    await addColumn('ALTER TABLE sheet_versions ADD COLUMN `deleted` TINYINT(1) NOT NULL DEFAULT 0');
    await addColumn('ALTER TABLE sheet_versions ADD COLUMN `deleted_at` VARCHAR(26) NULL DEFAULT NULL');

    await addColumn('ALTER TABLE users ADD COLUMN `deleted` TINYINT(1) NOT NULL DEFAULT 0');
    await addColumn('ALTER TABLE users ADD COLUMN `deleted_at` VARCHAR(26) NULL DEFAULT NULL');

    await addColumn('ALTER TABLE login_logs ADD COLUMN `deleted` TINYINT(1) NOT NULL DEFAULT 0');
    await addColumn('ALTER TABLE login_logs ADD COLUMN `deleted_at` VARCHAR(26) NULL DEFAULT NULL');

    await addColumn('ALTER TABLE verification_codes ADD COLUMN `deleted` TINYINT(1) NOT NULL DEFAULT 0');
    await addColumn('ALTER TABLE verification_codes ADD COLUMN `deleted_at` VARCHAR(26) NULL DEFAULT NULL');

    await addColumn('ALTER TABLE verification_codes ADD COLUMN `created_at` VARCHAR(26) NULL');
    await addColumn('ALTER TABLE login_logs ADD COLUMN `created_at` VARCHAR(26) NULL');

    console.log('[migrate] ok', formatDbTimestamp());
  } finally {
    conn.release();
  }
}
