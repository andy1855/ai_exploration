import { Router, type Request, type Response } from 'express';
import { db } from '../database';
import { authenticate } from '../middleware/authenticate';

const router = Router();

// All routes require authentication
router.use(authenticate);

interface SheetRow {
  id: string;
  title: string;
  content: string;
  type: string;
  language: string | null;
  group_id: string | null;
  pinned: number;
  word_count: number;
  chinese_count: number;
  english_count: number;
  created_at: number;
  updated_at: number;
}

interface GroupRow {
  id: string;
  name: string;
  icon: string | null;
  color: string | null;
  parent_id: string | null;
  order: number;
  collapsed: number;
}

// GET /api/notes — 获取用户所有笔记
router.get('/', (req: Request, res: Response): void => {
  const userId = req.user!.userId;

  const sheets = db.prepare(`
    SELECT id, title, content, type, language, group_id, pinned,
           word_count, chinese_count, english_count, created_at, updated_at
    FROM sheets WHERE user_id = ? ORDER BY updated_at DESC
  `).all(userId) as SheetRow[];

  const groups = db.prepare(`
    SELECT id, name, icon, color, parent_id, "order", collapsed
    FROM note_groups WHERE user_id = ? ORDER BY "order" ASC
  `).all(userId) as GroupRow[];

  res.json({
    sheets: sheets.map((s) => ({
      id: s.id,
      title: s.title,
      content: s.content,
      type: s.type,
      language: s.language,
      groupId: s.group_id,
      pinned: s.pinned === 1,
      wordCount: s.word_count,
      chineseCount: s.chinese_count,
      englishCount: s.english_count,
      createdAt: s.created_at,
      updatedAt: s.updated_at,
    })),
    groups: groups.map((g) => ({
      id: g.id,
      name: g.name,
      icon: g.icon,
      color: g.color,
      parentId: g.parent_id,
      order: g.order,
      collapsed: g.collapsed === 1,
    })),
  });
});

// PUT /api/notes — 全量同步笔记（覆盖式）
router.put('/', (req: Request, res: Response): void => {
  const userId = req.user!.userId;
  const { sheets, groups } = req.body as {
    sheets?: Array<{
      id: string; title?: string; content?: string; type?: string;
      language?: string | null; groupId?: string | null; pinned?: boolean;
      wordCount?: number; chineseCount?: number; englishCount?: number;
      createdAt?: number; updatedAt?: number;
    }>;
    groups?: Array<{
      id: string; name?: string; icon?: string | null; color?: string | null;
      parentId?: string | null; order?: number; collapsed?: boolean;
    }>;
  };

  const upsertSheet = db.prepare(`
    INSERT INTO sheets (id, user_id, title, content, type, language, group_id, pinned,
                        word_count, chinese_count, english_count, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      title       = excluded.title,
      content     = excluded.content,
      type        = excluded.type,
      language    = excluded.language,
      group_id    = excluded.group_id,
      pinned      = excluded.pinned,
      word_count  = excluded.word_count,
      chinese_count = excluded.chinese_count,
      english_count = excluded.english_count,
      updated_at  = excluded.updated_at
  `);

  const upsertGroup = db.prepare(`
    INSERT INTO note_groups (id, user_id, name, icon, color, parent_id, "order", collapsed)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      name      = excluded.name,
      icon      = excluded.icon,
      color     = excluded.color,
      parent_id = excluded.parent_id,
      "order"   = excluded."order",
      collapsed = excluded.collapsed
  `);

  const transact = db.transaction(() => {
    if (Array.isArray(sheets)) {
      for (const s of sheets) {
        upsertSheet.run(
          s.id, userId, s.title ?? '', s.content ?? '', s.type ?? 'plain',
          s.language ?? null, s.groupId ?? null, s.pinned ? 1 : 0,
          s.wordCount ?? 0, s.chineseCount ?? 0, s.englishCount ?? 0,
          s.createdAt ?? Date.now(), s.updatedAt ?? Date.now()
        );
      }
    }
    if (Array.isArray(groups)) {
      for (const g of groups) {
        upsertGroup.run(
          g.id, userId, g.name ?? '', g.icon ?? null, g.color ?? null,
          g.parentId ?? null, g.order ?? 0, g.collapsed ? 1 : 0
        );
      }
    }
  });

  transact();
  res.json({ ok: true });
});

// ─── Version History ─────────────────────────────────

// POST /api/notes/versions — 保存一个新版本快照
router.post('/versions', (req: Request, res: Response): void => {
  const userId = req.user!.userId;
  const { sheetId, title, content, type, language, groupId, wordCount, chineseCount, englishCount } = req.body as {
    sheetId: string;
    title?: string;
    content?: string;
    type?: string;
    language?: string | null;
    groupId?: string | null;
    wordCount?: number;
    chineseCount?: number;
    englishCount?: number;
  };

  if (!sheetId) { res.status(400).json({ error: '缺少 sheetId' }); return; }

  db.prepare(`
    INSERT INTO sheet_versions (sheet_id, user_id, title, content, type, language, group_id, word_count, chinese_count, english_count, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    sheetId, userId, title ?? '', content ?? '', type ?? 'plain',
    language ?? null, groupId ?? null, wordCount ?? 0, chineseCount ?? 0, englishCount ?? 0,
    Date.now()
  );

  // 每个 sheet 最多保留 10 个版本，删除最旧的
  db.prepare(`
    DELETE FROM sheet_versions WHERE id IN (
      SELECT id FROM sheet_versions WHERE sheet_id = ? ORDER BY created_at DESC LIMIT -1 OFFSET 10
    )
  `).run(sheetId);

  res.json({ ok: true });
});

// GET /api/notes/versions/:sheetId — 获取某篇文稿的版本列表
router.get('/versions/:sheetId', (req: Request, res: Response): void => {
  const userId = req.user!.userId;
  const { sheetId } = req.params;

  const versions = db.prepare(`
    SELECT id, title, content, type, language, group_id, word_count, chinese_count, english_count, created_at
    FROM sheet_versions WHERE sheet_id = ? AND user_id = ?
    ORDER BY created_at DESC LIMIT 10
  `).all(sheetId, userId);

  res.json({ versions });
});

// POST /api/notes/versions/restore/:versionId — 恢复到指定版本
router.post('/versions/restore/:versionId', (req: Request, res: Response): void => {
  const userId = req.user!.userId;
  const versionId = Number(req.params.versionId);

  const version = db.prepare(`
    SELECT * FROM sheet_versions WHERE id = ? AND user_id = ?
  `).get(versionId, userId) as {
    id: number; sheet_id: string; title: string; content: string;
    type: string; language: string | null; group_id: string | null;
    word_count: number; chinese_count: number; english_count: number;
  } | undefined;

  if (!version) { res.status(404).json({ error: '版本不存在' }); return; }

  // 将版本数据写回 sheets 表
  db.prepare(`
    UPDATE sheets SET
      title = ?, content = ?, type = ?, language = ?, group_id = ?,
      word_count = ?, chinese_count = ?, english_count = ?, updated_at = ?
    WHERE id = ? AND user_id = ?
  `).run(
    version.title, version.content, version.type, version.language, version.group_id,
    version.word_count, version.chinese_count, version.english_count, Date.now(),
    version.sheet_id, userId
  );

  res.json({ ok: true, sheetId: version.sheet_id });
});

export default router;
