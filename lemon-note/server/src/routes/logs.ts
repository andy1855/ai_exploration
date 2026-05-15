import { Router, type Request, type Response } from 'express';
import { db } from '../database';
import { authenticate } from '../middleware/authenticate';

const router = Router();

// GET /api/logs?page=1&limit=20
router.get('/', authenticate, (req: Request, res: Response): void => {
  const page = Math.max(1, Number(req.query.page ?? 1));
  const limit = Math.min(100, Math.max(1, Number(req.query.limit ?? 20)));
  const offset = (page - 1) * limit;

  const logs = db.prepare(`
    SELECT id, target, method, ip, user_agent, device_info, success, fail_reason, created_at
    FROM login_logs
    WHERE user_id = ?
    ORDER BY created_at DESC
    LIMIT ? OFFSET ?
  `).all(req.user!.userId, limit, offset);

  const total = (db.prepare('SELECT count(*) as cnt FROM login_logs WHERE user_id = ?')
    .get(req.user!.userId) as { cnt: number }).cnt;

  res.json({ logs, total, page, limit });
});

export default router;
