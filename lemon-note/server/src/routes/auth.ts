import { Router, type Request, type Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { db } from '../database';
import { sendEmailCode } from '../services/notify';
import { authenticate } from '../middleware/authenticate';
import { validateNickname } from '../utils/nickname';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET ?? 'dev-secret';
const CODE_TTL = 10 * 60; // 10 minutes in seconds

const NICK_ADJ = ['快乐', '聪明', '活泼', '勇敢', '温柔', '神秘', '优雅', '闪亮', '可爱', '开朗', '机智', '阳光', '清爽', '潇洒', '灵动', '奇妙'];
const NICK_NOUN = ['猫咪', '狐狸', '海豚', '企鹅', '熊猫', '兔子', '松鼠', '猎豹', '猫头鹰', '独角兽', '飞龙', '星星', '月亮', '彩虹', '流星', '极光'];
function generateNickname() {
  const adj = NICK_ADJ[Math.floor(Math.random() * NICK_ADJ.length)];
  const noun = NICK_NOUN[Math.floor(Math.random() * NICK_NOUN.length)];
  const num = Math.floor(10 + Math.random() * 90);
  return `${adj}的${noun}${num}`;
}

function isEmail(s: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}
function randomCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}
function getIp(req: Request) {
  return (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ?? req.socket.remoteAddress ?? '';
}

function recordLog(params: {
  userId: number | null;
  target: string;
  method: string;
  req: Request;
  success: boolean;
  failReason?: string;
  deviceInfo?: string;
}) {
  const stmt = db.prepare(`
    INSERT INTO login_logs (user_id, target, method, ip, user_agent, device_info, success, fail_reason)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  try {
    stmt.run(
      params.userId,
      params.target,
      params.method,
      getIp(params.req),
      params.req.headers['user-agent'] ?? '',
      params.deviceInfo ?? null,
      params.success ? 1 : 0,
      params.failReason ?? null
    );
  } catch {
    // fallback for databases without device_info column
    db.prepare(`
      INSERT INTO login_logs (user_id, target, method, ip, user_agent, success, fail_reason)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      params.userId,
      params.target,
      params.method,
      getIp(params.req),
      params.req.headers['user-agent'] ?? '',
      params.success ? 1 : 0,
      params.failReason ?? null
    );
  }
}

// POST /api/auth/send-code
router.post('/send-code', async (req: Request, res: Response): Promise<void> => {
  const { target, purpose } = req.body as { target: string; purpose: 'register' | 'login' };

  if (!target || !purpose) {
    res.status(400).json({ error: '参数缺失' });
    return;
  }
  if (!isEmail(target)) {
    res.status(400).json({ error: '请输入有效的邮箱地址' });
    return;
  }
  const type = 'email';

  // Rate limit: max 5 codes per target per hour
  const recent = db.prepare(`
    SELECT count(*) as cnt FROM verification_codes
    WHERE target = ? AND created_at > unixepoch() - 3600
  `).get(target) as { cnt: number };
  if (recent.cnt >= 5) {
    res.status(429).json({ error: '发送过于频繁，请稍后再试' });
    return;
  }

  const code = randomCode();
  const expiresAt = Math.floor(Date.now() / 1000) + CODE_TTL;

  db.prepare(`
    INSERT INTO verification_codes (target, code, type, purpose, expires_at)
    VALUES (?, ?, ?, ?, ?)
  `).run(target, code, type, purpose, expiresAt);

  try {
    await sendEmailCode(target, code, purpose);
    const devMode = !process.env.SMTP_HOST;
    res.json({ ok: true, ...(devMode ? { devCode: code, devHint: '邮件服务未配置，当前验证码' } : {}) });
  } catch (err) {
    console.error('Send code error:', err);
    res.status(500).json({ error: '发送失败，请稍后重试' });
  }
});

// POST /api/auth/register
router.post('/register', async (req: Request, res: Response): Promise<void> => {
  const { target, code, password, nickname, rememberMe } = req.body as {
    target: string;
    code: string;
    password?: string;
    nickname?: string;
    rememberMe?: boolean;
  };

  if (!target || !code) { res.status(400).json({ error: '参数缺失' }); return; }
  if (!isEmail(target)) { res.status(400).json({ error: '请输入有效的邮箱地址' }); return; }

  const record = db.prepare(`
    SELECT * FROM verification_codes
    WHERE target = ? AND code = ? AND purpose = 'register'
      AND used = 0 AND expires_at > unixepoch()
    ORDER BY id DESC LIMIT 1
  `).get(target, code) as { id: number } | undefined;

  if (!record) { res.status(400).json({ error: '验证码错误或已过期' }); return; }

  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(target);
  if (existing) { res.status(409).json({ error: '该邮箱已注册，请直接登录' }); return; }

  let finalNickname: string;
  if (nickname != null && String(nickname).trim() !== '') {
    const v = validateNickname(String(nickname));
    if (!v.ok) {
      res.status(400).json({ error: v.error });
      return;
    }
    finalNickname = v.value;
  } else {
    finalNickname = generateNickname();
  }

  const passwordHash = password ? await bcrypt.hash(password, 10) : null;
  const result = db.prepare(`INSERT INTO users (email, phone, password, nickname) VALUES (?, NULL, ?, ?)`)
    .run(target, passwordHash, finalNickname);

  const userId = result.lastInsertRowid as number;
  db.prepare('UPDATE verification_codes SET used = 1 WHERE id = ?').run(record.id);

  const expiresIn = rememberMe ? '30d' : '24h';
  const expiresAt = Date.now() + (rememberMe ? 30 * 86400000 : 86400000);
  const token = jwt.sign({ userId, target }, JWT_SECRET, { expiresIn });

  recordLog({ userId, target, method: 'email_code', req, success: true });
  res.json({ ok: true, token, userId, target, nickname: finalNickname, expiresAt });
});

// POST /api/auth/login
router.post('/login', async (req: Request, res: Response): Promise<void> => {
  const { target, method, code, password, rememberMe, deviceInfo } = req.body as {
    target: string;
    method: 'password' | 'email_code';
    code?: string;
    password?: string;
    rememberMe?: boolean;
    deviceInfo?: string;
  };

  if (!target || !method) { res.status(400).json({ error: '参数缺失' }); return; }
  if (!isEmail(target)) { res.status(400).json({ error: '请输入有效的邮箱地址' }); return; }

  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(target) as {
    id: number; email: string | null; phone: string | null; password: string | null; nickname: string | null;
  } | undefined;

  if (!user) {
    recordLog({ userId: null, target, method, req, success: false, failReason: '用户不存在' });
    res.status(401).json({ error: '账号不存在，请先注册' });
    return;
  }

  if (method === 'password') {
    if (!password || !user.password) {
      recordLog({ userId: user.id, target, method, req, success: false, failReason: '未设置密码' });
      res.status(401).json({ error: '该账号未设置密码，请使用验证码登录' });
      return;
    }
    const ok = await bcrypt.compare(password, user.password);
    if (!ok) {
      recordLog({ userId: user.id, target, method, req, success: false, failReason: '密码错误' });
      res.status(401).json({ error: '密码错误' });
      return;
    }
  } else {
    if (!code) {
      res.status(400).json({ error: '请输入验证码' });
      return;
    }
    const record = db.prepare(`
      SELECT * FROM verification_codes
      WHERE target = ? AND code = ? AND purpose = 'login'
        AND used = 0 AND expires_at > unixepoch()
      ORDER BY id DESC LIMIT 1
    `).get(target, code) as { id: number } | undefined;

    if (!record) {
      recordLog({ userId: user.id, target, method, req, success: false, failReason: '验证码错误或过期' });
      res.status(401).json({ error: '验证码错误或已过期' });
      return;
    }
    db.prepare('UPDATE verification_codes SET used = 1 WHERE id = ?').run(record.id);
  }

  const expiresIn = rememberMe ? '30d' : '24h';
  const expiresAt = Date.now() + (rememberMe ? 30 * 86400000 : 86400000);
  const token = jwt.sign({ userId: user.id, target }, JWT_SECRET, { expiresIn });
  recordLog({ userId: user.id, target, method, req, success: true, deviceInfo });

  res.json({ ok: true, token, userId: user.id, target, nickname: user.nickname ?? '', expiresAt });
});

// GET /api/auth/me
router.get('/me', authenticate, (req: Request, res: Response): void => {
  const user = db.prepare('SELECT id, email, phone, nickname, created_at FROM users WHERE id = ?')
    .get(req.user!.userId) as { id: number; email: string | null; phone: string | null; nickname: string | null; created_at: number } | undefined;
  if (!user) {
    res.status(404).json({ error: '用户不存在' });
    return;
  }
  res.json(user);
});

// POST /api/auth/change-password
router.post('/change-password', authenticate, async (req: Request, res: Response): Promise<void> => {
  const { oldPassword, newPassword } = req.body as { oldPassword?: string; newPassword: string };
  if (!newPassword || newPassword.length < 6) {
    res.status(400).json({ error: '密码至少6位' });
    return;
  }
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user!.userId) as { password: string | null } | undefined;
  if (!user) { res.status(404).json({ error: '用户不存在' }); return; }

  if (user.password && oldPassword) {
    const ok = await bcrypt.compare(oldPassword, user.password);
    if (!ok) { res.status(401).json({ error: '原密码错误' }); return; }
  }
  const hash = await bcrypt.hash(newPassword, 10);
  db.prepare('UPDATE users SET password = ? WHERE id = ?').run(hash, req.user!.userId);
  res.json({ ok: true });
});

// PUT /api/auth/profile — update nickname
router.put('/profile', authenticate, (req: Request, res: Response): void => {
  const { nickname } = req.body as { nickname: string };
  if (nickname == null || String(nickname).trim() === '') {
    res.status(400).json({ error: '用户名不能为空' });
    return;
  }
  const v = validateNickname(String(nickname));
  if (!v.ok) {
    res.status(400).json({ error: v.error });
    return;
  }
  db.prepare('UPDATE users SET nickname = ? WHERE id = ?').run(v.value, req.user!.userId);
  res.json({ ok: true, nickname: v.value });
});

// POST /api/auth/change-email — bind or change email with verification code
router.post('/change-email', authenticate, async (req: Request, res: Response): Promise<void> => {
  const { newEmail, code } = req.body as { newEmail: string; code: string };
  if (!newEmail || !isEmail(newEmail)) {
    res.status(400).json({ error: '请输入有效邮箱' });
    return;
  }
  if (!code) {
    res.status(400).json({ error: '请输入验证码' });
    return;
  }

  // Check if email already used by another account
  const existing = db.prepare('SELECT id FROM users WHERE email = ? AND id != ?')
    .get(newEmail, req.user!.userId);
  if (existing) {
    res.status(409).json({ error: '该邮箱已被其他账号使用' });
    return;
  }

  const record = db.prepare(`
    SELECT * FROM verification_codes
    WHERE target = ? AND code = ? AND purpose = 'register'
      AND used = 0 AND expires_at > unixepoch()
    ORDER BY id DESC LIMIT 1
  `).get(newEmail, code) as { id: number } | undefined;

  if (!record) {
    res.status(400).json({ error: '验证码错误或已过期' });
    return;
  }

  db.prepare('UPDATE users SET email = ? WHERE id = ?').run(newEmail, req.user!.userId);
  db.prepare('UPDATE verification_codes SET used = 1 WHERE id = ?').run(record.id);
  res.json({ ok: true, email: newEmail });
});

export default router;
