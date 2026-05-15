import { Router, type Request, type Response } from 'express';
import { dbGet, dbAll, dbRun } from '../database';
import { authenticate } from '../middleware/authenticate';

const router = Router();
router.use(authenticate);

// GET /api/notes
router.get('/', async (req: Request, res: Response): Promise<void> => {
  const userId = req.user!.userId;

  const sheets = await dbAll<Record<string, unknown>>(
    `SELECT id, title, content, type, language, group_id, pinned,
            word_count, chinese_count, english_count, created_at, updated_at
     FROM sheets WHERE user_id = ? ORDER BY updated_at DESC`, [userId]);

  const groups = await dbAll<Record<string, unknown>>(
    'SELECT id, name, icon, color, parent_id, `order`, collapsed FROM note_groups WHERE user_id = ? ORDER BY `order` ASC', [userId]);

  res.json({
    sheets: sheets.map((s) => ({
      id: s.id, title: s.title, content: s.content, type: s.type,
      language: s.language, groupId: s.group_id, pinned: s.pinned === 1,
      wordCount: s.word_count, chineseCount: s.chinese_count, englishCount: s.english_count,
      createdAt: s.created_at, updatedAt: s.updated_at,
    })),
    groups: groups.map((g) => ({
      id: g.id, name: g.name, icon: g.icon, color: g.color,
      parentId: g.parent_id, order: g.order, collapsed: g.collapsed === 1,
    })),
  });
});

// PUT /api/notes — 全量同步
router.put('/', async (req: Request, res: Response): Promise<void> => {
  const userId = req.user!.userId;
  const { sheets = [], groups = [] } = req.body as {
    sheets?: Array<{ id: string; title?: string; content?: string; type?: string; language?: string | null; groupId?: string | null; pinned?: boolean; wordCount?: number; chineseCount?: number; englishCount?: number; createdAt?: number; updatedAt?: number }>;
    groups?: Array<{ id: string; name?: string; icon?: string | null; color?: string | null; parentId?: string | null; order?: number; collapsed?: boolean }>;
  };

  if (Array.isArray(sheets)) {
    for (const s of sheets) {
      await dbRun(
        `INSERT INTO sheets (id, user_id, title, content, type, language, group_id, pinned,
                             word_count, chinese_count, english_count, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           title = VALUES(title), content = VALUES(content), type = VALUES(type),
           language = VALUES(language), group_id = VALUES(group_id), pinned = VALUES(pinned),
           word_count = VALUES(word_count), chinese_count = VALUES(chinese_count),
           english_count = VALUES(english_count), updated_at = VALUES(updated_at)`,
        [s.id, userId, s.title ?? '', s.content ?? '', s.type ?? 'plain',
         s.language ?? null, s.groupId ?? null, s.pinned ? 1 : 0,
         s.wordCount ?? 0, s.chineseCount ?? 0, s.englishCount ?? 0,
         s.createdAt ?? Date.now(), s.updatedAt ?? Date.now()]
      );
    }
  }

  if (Array.isArray(groups)) {
    for (const g of groups) {
      await dbRun(
        `INSERT INTO note_groups (id, user_id, name, icon, color, parent_id, \`order\`, collapsed)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           name = VALUES(name), icon = VALUES(icon), color = VALUES(color),
           parent_id = VALUES(parent_id), \`order\` = VALUES(\`order\`), collapsed = VALUES(collapsed)`,
        [g.id, userId, g.name ?? '', g.icon ?? null, g.color ?? null,
         g.parentId ?? null, g.order ?? 0, g.collapsed ? 1 : 0]
      );
    }
  }

  res.json({ ok: true });
});

// ─── Version History ─────────────────────────────────

router.post('/versions', async (req: Request, res: Response): Promise<void> => {
  const userId = req.user!.userId;
  const { sheetId, title, content, type, language, groupId, wordCount, chineseCount, englishCount } = req.body;
  if (!sheetId) { res.status(400).json({ error: '缺少 sheetId' }); return; }

  await dbRun(
    `INSERT INTO sheet_versions (sheet_id, user_id, title, content, type, language, group_id, word_count, chinese_count, english_count, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [sheetId, userId, title ?? '', content ?? '', type ?? 'plain',
     language ?? null, groupId ?? null, wordCount ?? 0, chineseCount ?? 0, englishCount ?? 0, Date.now()]
  );

  // Keep max 10 versions per sheet
  const versions = await dbAll<{ id: number }>(
    'SELECT id FROM sheet_versions WHERE sheet_id = ? ORDER BY created_at DESC', [sheetId]);
  if (versions.length > 10) {
    const idsToDelete = versions.slice(10).map(v => v.id);
    await dbRun(`DELETE FROM sheet_versions WHERE id IN (${idsToDelete.map(() => '?').join(',')})`, idsToDelete);
  }

  res.json({ ok: true });
});

router.get('/versions/:sheetId', async (req: Request, res: Response): Promise<void> => {
  const userId = req.user!.userId;
  const versions = await dbAll(
    `SELECT id, title, content, type, language, group_id, word_count, chinese_count, english_count, created_at
     FROM sheet_versions WHERE sheet_id = ? AND user_id = ? ORDER BY created_at DESC LIMIT 10`,
    [req.params.sheetId, userId]
  );
  res.json({ versions });
});

router.post('/versions/restore/:versionId', async (req: Request, res: Response): Promise<void> => {
  const userId = req.user!.userId;
  type VersionRow = { id: number; sheet_id: string; title: string; content: string; type: string; language: string | null; group_id: string | null; word_count: number; chinese_count: number; english_count: number; created_at: number };
  const version = await dbGet<VersionRow>(
    'SELECT * FROM sheet_versions WHERE id = ? AND user_id = ?', [Number(req.params.versionId), userId]);
  if (!version) { res.status(404).json({ error: '版本不存在' }); return; }

  await dbRun(
    `UPDATE sheets SET title = ?, content = ?, type = ?, language = ?, group_id = ?,
      word_count = ?, chinese_count = ?, english_count = ?, updated_at = ?
     WHERE id = ? AND user_id = ?`,
    [version.title, version.content, version.type, version.language, version.group_id,
     version.word_count, version.chinese_count, version.english_count, Date.now(),
     version.sheet_id, userId]
  );

  res.json({ ok: true, sheetId: version.sheet_id });
});

export default router;
