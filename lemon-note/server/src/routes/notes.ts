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

export default router;
