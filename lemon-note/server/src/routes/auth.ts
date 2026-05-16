import { Router, type Request, type Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { dbGet, dbAll, dbRun } from '../database';
import { sendEmailCode } from '../services/notify';
import { authenticate } from '../middleware/authenticate';
import { validateNickname } from '../utils/nickname';
import { formatDbTimestamp, dbTimeToMs } from '../utils/timestamp';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET ?? 'dev-secret';
const CODE_TTL = 10 * 60;

const NICK_ADJ = ['快乐', '聪明', '活泼', '勇敢', '温柔', '神秘', '优雅', '闪亮', '可爱', '开朗', '机智', '阳光', '清爽', '潇洒', '灵动', '奇妙'];
const NICK_NOUN = ['猫咪', '狐狸', '海豚', '企鹅', '熊猫', '兔子', '松鼠', '猎豹', '猫头鹰', '独角兽', '飞龙', '星星', '月亮', '彩虹', '流星', '极光'];
function generateNickname() {
  const adj = NICK_ADJ[Math.floor(Math.random() * NICK_ADJ.length)];
  const noun = NICK_NOUN[Math.floor(Math.random() * NICK_NOUN.length)];
  const num = Math.floor(10 + Math.random() * 90);
  return `${adj}的${noun}${num}`;
}

function isEmail(s: string) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s); }
function randomCode() { return String(Math.floor(100000 + Math.random() * 900000)); }
function getIp(req: Request) {
  return (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ?? req.socket.remoteAddress ?? '';
}

async function recordLog(params: {
  userId: number | null; target: string; method: string;
  req: Request; success: boolean; failReason?: string; deviceInfo?: string;
}) {
  await dbRun(
    `INSERT INTO login_logs (user_id, target, method, ip, user_agent, device_info, success, fail_reason, created_at, deleted, deleted_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, NULL)`,
    [params.userId, params.target, params.method, getIp(params.req),
     params.req.headers['user-agent'] ?? '', params.deviceInfo ?? null,
     params.success ? 1 : 0, params.failReason ?? null, formatDbTimestamp()]
  );
}

router.post('/send-code', async (req: Request, res: Response): Promise<void> => {
  const { target, purpose } = req.body as { target: string; purpose: 'register' | 'login' };
  if (!target || !purpose) { res.status(400).json({ error: '参数缺失' }); return; }
  if (!isEmail(target)) { res.status(400).json({ error: '请输入有效的邮箱地址' }); return; }

  const since = formatDbTimestamp(new Date(Date.now() - 3600000));
  const recent = await dbGet<{ cnt: number }>(
    'SELECT count(*) as cnt FROM verification_codes WHERE target = ? AND created_at > ?', [target, since]);
  if (recent && recent.cnt >= 5) { res.status(429).json({ error: '发送过于频繁，请稍后再试' }); return; }

  const code = randomCode();
  const expiresAtStr = formatDbTimestamp(new Date(Date.now() + CODE_TTL * 1000));
  const createdAtStr = formatDbTimestamp();
  await dbRun(
    'INSERT INTO verification_codes (target, code, type, purpose, expires_at, created_at, deleted, deleted_at) VALUES (?, ?, ?, ?, ?, ?, 0, NULL)',
    [target, code, 'email', purpose, expiresAtStr, createdAtStr]
  );

  try {
    await sendEmailCode(target, code, purpose);
    const devMode = !process.env.SMTP_HOST;
    res.json({ ok: true, ...(devMode ? { devCode: code, devHint: '邮件服务未配置，当前验证码' } : {}) });
  } catch (err) {
    console.error('Send code error:', err);
    res.status(500).json({ error: '发送失败，请稍后重试' });
  }
});

router.post('/register', async (req: Request, res: Response): Promise<void> => {
  const { target, code, password, nickname, rememberMe } = req.body as {
    target: string; code: string; password?: string; nickname?: string; rememberMe?: boolean;
  };
  if (!target || !code) { res.status(400).json({ error: '参数缺失' }); return; }
  if (!isEmail(target)) { res.status(400).json({ error: '请输入有效的邮箱地址' }); return; }

  const nowFmt = formatDbTimestamp();
  const record = await dbGet<{ id: number }>(
    `SELECT * FROM verification_codes WHERE target = ? AND code = ? AND purpose = 'register'
     AND used = 0 AND expires_at > ? ORDER BY id DESC LIMIT 1`, [target, code, nowFmt]);
  if (!record) { res.status(400).json({ error: '验证码错误或已过期' }); return; }

  const existing = await dbGet('SELECT id FROM users WHERE email = ? AND (deleted IS NULL OR deleted = 0)', [target]);
  if (existing) { res.status(409).json({ error: '该邮箱已注册，请直接登录' }); return; }

  let finalNickname: string;
  if (nickname != null && String(nickname).trim() !== '') {
    const v = validateNickname(String(nickname));
    if (!v.ok) { res.status(400).json({ error: v.error }); return; }
    finalNickname = v.value;
  } else { finalNickname = generateNickname(); }

  const passwordHash = password ? await bcrypt.hash(password, 10) : null;
  const regAt = formatDbTimestamp();
  const result = await dbRun('INSERT INTO users (email, phone, password, nickname, created_at, deleted, deleted_at) VALUES (?, NULL, ?, ?, ?, 0, NULL)',
    [target, passwordHash, finalNickname, regAt]);
  const userId = result.insertId!;
  await dbRun('UPDATE verification_codes SET used = 1 WHERE id = ?', [record.id]);

  const expiresIn = rememberMe ? '30d' : '24h';
  const expiresAt = Date.now() + (rememberMe ? 30 * 86400000 : 86400000);
  const token = jwt.sign({ userId, target }, JWT_SECRET, { expiresIn });

  await recordLog({ userId, target, method: 'email_code', req, success: true });
  res.json({ ok: true, token, userId, target, nickname: finalNickname, expiresAt });
});

router.post('/login', async (req: Request, res: Response): Promise<void> => {
  const { target, method, code, password, rememberMe, deviceInfo } = req.body as {
    target: string; method: 'password' | 'email_code'; code?: string; password?: string;
    rememberMe?: boolean; deviceInfo?: string;
  };
  if (!target || !method) { res.status(400).json({ error: '参数缺失' }); return; }
  if (!isEmail(target)) { res.status(400).json({ error: '请输入有效的邮箱地址' }); return; }

  const user = await dbGet<{ id: number; email: string | null; phone: string | null; password: string | null; nickname: string | null }>(
    'SELECT * FROM users WHERE email = ? AND (deleted IS NULL OR deleted = 0)', [target]);
  if (!user) {
    await recordLog({ userId: null, target, method, req, success: false, failReason: '用户不存在' });
    res.status(401).json({ error: '账号不存在，请先注册' }); return;
  }

  if (method === 'password') {
    if (!password || !user.password) {
      await recordLog({ userId: user.id, target, method, req, success: false, failReason: '未设置密码' });
      res.status(401).json({ error: '该账号未设置密码，请使用验证码登录' }); return;
    }
    const ok = await bcrypt.compare(password, user.password);
    if (!ok) {
      await recordLog({ userId: user.id, target, method, req, success: false, failReason: '密码错误' });
      res.status(401).json({ error: '密码错误' }); return;
    }
  } else {
    if (!code) { res.status(400).json({ error: '请输入验证码' }); return; }
    const nowFmt = formatDbTimestamp();
    const record = await dbGet<{ id: number }>(
      `SELECT * FROM verification_codes WHERE target = ? AND code = ? AND purpose = 'login'
       AND used = 0 AND expires_at > ? ORDER BY id DESC LIMIT 1`, [target, code, nowFmt]);
    if (!record) {
      await recordLog({ userId: user.id, target, method, req, success: false, failReason: '验证码错误或过期' });
      res.status(401).json({ error: '验证码错误或已过期' }); return;
    }
    await dbRun('UPDATE verification_codes SET used = 1 WHERE id = ?', [record.id]);
  }

  const expiresIn = rememberMe ? '30d' : '24h';
  const expiresAt = Date.now() + (rememberMe ? 30 * 86400000 : 86400000);
  const token = jwt.sign({ userId: user.id, target }, JWT_SECRET, { expiresIn });
  await recordLog({ userId: user.id, target, method, req, success: true, deviceInfo });

  res.json({ ok: true, token, userId: user.id, target, nickname: user.nickname ?? '', expiresAt });
});

router.get('/me', authenticate, async (req: Request, res: Response): Promise<void> => {
  const me = await dbGet<Record<string, unknown>>('SELECT id, email, phone, nickname, created_at FROM users WHERE id = ? AND (deleted IS NULL OR deleted = 0)', [req.user!.userId]);
  if (!me) { res.status(404).json({ error: '用户不存在' }); return; }
  res.json({
    ...me,
    created_at: dbTimeToMs(me.created_at as string | number),
  });
});

router.post('/change-password', authenticate, async (req: Request, res: Response): Promise<void> => {
  const { oldPassword, newPassword } = req.body as { oldPassword?: string; newPassword: string };
  if (!newPassword || newPassword.length < 6) { res.status(400).json({ error: '密码至少6位' }); return; }
  const user = await dbGet<{ password: string | null }>('SELECT * FROM users WHERE id = ? AND (deleted IS NULL OR deleted = 0)', [req.user!.userId]);
  if (!user) { res.status(404).json({ error: '用户不存在' }); return; }
  if (user.password && oldPassword) {
    const ok = await bcrypt.compare(oldPassword, user.password);
    if (!ok) { res.status(401).json({ error: '原密码错误' }); return; }
  }
  const hash = await bcrypt.hash(newPassword, 10);
  await dbRun('UPDATE users SET password = ? WHERE id = ?', [hash, req.user!.userId]);
  res.json({ ok: true });
});

router.put('/profile', authenticate, async (req: Request, res: Response): Promise<void> => {
  const { nickname } = req.body as { nickname: string };
  const v = validateNickname(nickname);
  if (!v.ok) { res.status(400).json({ error: v.error }); return; }
  await dbRun('UPDATE users SET nickname = ? WHERE id = ?', [v.value, req.user!.userId]);
  res.json({ nickname: v.value });
});

router.post('/change-email', authenticate, async (req: Request, res: Response): Promise<void> => {
  const { newEmail, code } = req.body as { newEmail: string; code: string };
  if (!newEmail || !code) { res.status(400).json({ error: '参数缺失' }); return; }
  if (!isEmail(newEmail)) { res.status(400).json({ error: '请输入有效的邮箱地址' }); return; }
  const nowFmt = formatDbTimestamp();
  const record = await dbGet<{ id: number }>(
    `SELECT * FROM verification_codes WHERE target = ? AND code = ? AND purpose = 'register'
     AND used = 0 AND expires_at > ? ORDER BY id DESC LIMIT 1`, [newEmail, code, nowFmt]);
  if (!record) { res.status(400).json({ error: '验证码错误或已过期' }); return; }
  const existing = await dbGet('SELECT id FROM users WHERE email = ? AND (deleted IS NULL OR deleted = 0)', [newEmail]);
  if (existing) { res.status(409).json({ error: '该邮箱已被使用' }); return; }
  await dbRun('UPDATE users SET email = ? WHERE id = ?', [newEmail, req.user!.userId]);
  await dbRun('UPDATE verification_codes SET used = 1 WHERE id = ?', [record.id]);
  res.json({ ok: true });
});

export default router;
