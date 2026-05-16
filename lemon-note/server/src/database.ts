import { type RowDataPacket, type ResultSetHeader, type Pool, createPool } from 'mysql2/promise';
import { applyMigrations } from './migrations/apply';

const MYSQL_CONFIG = {
  host: process.env.MYSQL_HOST ?? '127.0.0.1',
  port: Number(process.env.MYSQL_PORT ?? 3306),
  user: process.env.MYSQL_USER ?? 'root',
  password: process.env.MYSQL_PASSWORD ?? '',
  database: process.env.MYSQL_DB ?? 'lemonnotedb',
  charset: 'utf8mb4',
  waitForConnections: true,
  connectionLimit: 10,
};

let pool: Pool;

export async function initDb(): Promise<void> {
  pool = createPool(MYSQL_CONFIG);
  const conn = await pool.getConnection();
  conn.release();
  console.log(`[db] MySQL connected to ${MYSQL_CONFIG.database}@${MYSQL_CONFIG.host}`);
  await applyMigrations(pool);
}

export function getPool(): Pool {
  return pool;
}

type ParamType = string | number | boolean | null | Buffer | Date;

export async function dbAll<T = Record<string, unknown>>(sql: string, params: ParamType[] = []): Promise<T[]> {
  const [rows] = await pool.execute<RowDataPacket[]>(sql, params);
  return rows as T[];
}

export async function dbGet<T = Record<string, unknown>>(sql: string, params: ParamType[] = []): Promise<T | null> {
  const [rows] = await pool.execute<RowDataPacket[]>(sql, params);
  const arr = rows as T[];
  return arr.length > 0 ? arr[0] : null;
}

export async function dbRun(sql: string, params: ParamType[] = []): Promise<{ insertId?: number; affectedRows: number }> {
  const [result] = await pool.execute<ResultSetHeader>(sql, params);
  return { insertId: result.insertId, affectedRows: result.affectedRows };
}

export type User = {
  id: number;
  email: string | null;
  phone: string | null;
  password: string | null;
  nickname: string | null;
  created_at: string | number;
};

export type LoginLog = {
  id: number;
  user_id: number | null;
  target: string;
  method: string;
  ip: string | null;
  user_agent: string | null;
  success: number;
  fail_reason: string | null;
  created_at: string | number;
};
