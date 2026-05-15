import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const dbPath = process.env.DB_PATH ?? './data/lemon.db';
const dbDir = path.dirname(path.resolve(dbPath));
if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });

export const db = new Database(path.resolve(dbPath));

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    email      TEXT UNIQUE,
    phone      TEXT UNIQUE,
    password   TEXT,
    nickname   TEXT,
    created_at INTEGER NOT NULL DEFAULT (unixepoch())
  );

  CREATE TABLE IF NOT EXISTS verification_codes (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    target     TEXT NOT NULL,
    code       TEXT NOT NULL,
    type       TEXT NOT NULL CHECK(type IN ('email','phone')),
    purpose    TEXT NOT NULL CHECK(purpose IN ('register','login')),
    used       INTEGER NOT NULL DEFAULT 0,
    expires_at INTEGER NOT NULL,
    created_at INTEGER NOT NULL DEFAULT (unixepoch())
  );

  CREATE INDEX IF NOT EXISTS idx_codes_target ON verification_codes(target, expires_at);

  CREATE TABLE IF NOT EXISTS login_logs (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id    INTEGER,
    target     TEXT NOT NULL,
    method     TEXT NOT NULL CHECK(method IN ('password','email_code','phone_code')),
    ip         TEXT,
    user_agent TEXT,
    success    INTEGER NOT NULL DEFAULT 0,
    fail_reason TEXT,
    created_at INTEGER NOT NULL DEFAULT (unixepoch()),
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE SET NULL
  );

  CREATE INDEX IF NOT EXISTS idx_logs_user ON login_logs(user_id);
  CREATE INDEX IF NOT EXISTS idx_logs_created ON login_logs(created_at DESC);
`);

export type User = {
  id: number;
  email: string | null;
  phone: string | null;
  password: string | null;
  nickname: string | null;
  created_at: number;
};

export type LoginLog = {
  id: number;
  user_id: number | null;
  target: string;
  method: 'password' | 'email_code' | 'phone_code';
  ip: string | null;
  user_agent: string | null;
  success: number;
  fail_reason: string | null;
  created_at: number;
};
