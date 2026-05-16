import { Router, type Request, type Response } from 'express';
import { dbGet, dbAll } from '../database';
import { authenticate } from '../middleware/authenticate';
import { dbTimeToMs } from '../utils/timestamp';

const router = Router();

router.get('/', authenticate, async (req: Request, res: Response): Promise<void> => {
  const page = Math.max(1, Number(req.query.page ?? 1));
  const limit = Math.min(100, Math.max(1, Number(req.query.limit ?? 20)));
  const offset = (page - 1) * limit;

  const logs = await dbAll<Record<string, unknown>>(
    `SELECT id, target, method, ip, user_agent, device_info, success, fail_reason, created_at
     FROM login_logs WHERE user_id = ? AND (deleted IS NULL OR deleted = 0) ORDER BY created_at DESC LIMIT ? OFFSET ?`,
    [req.user!.userId, limit, offset]
  );

  const total = await dbGet<{ cnt: number }>(
    'SELECT count(*) as cnt FROM login_logs WHERE user_id = ? AND (deleted IS NULL OR deleted = 0)', [req.user!.userId]);

  res.json({
    logs: logs.map((row) => ({
      ...row,
      created_at: dbTimeToMs(row.created_at as string | number),
    })),
    total: total?.cnt ?? 0,
    page,
    limit,
  });
});

export default router;
