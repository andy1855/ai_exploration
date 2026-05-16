import { Router, type Request, type Response } from 'express';
import { dbGet, dbAll, dbRun } from '../database';
import { authenticate } from '../middleware/authenticate';
import { formatDbTimestamp, msToDbTimestamp, dbTimeToMs } from '../utils/timestamp';
import {
  fetchNotesSnapshotForUser,
  listAliveSheetIds,
  listAliveGroupIds,
  markSheetDeleted,
  markGroupDeleted,
} from '../utils/softDelete';

function twoMonthsAgoDbTimestamp(): string {
  const d = new Date();
  d.setMonth(d.getMonth() - 2);
  return formatDbTimestamp(d);
}

const router = Router();
router.use(authenticate);

// GET /api/notes
router.get('/', async (req: Request, res: Response): Promise<void> => {
  const userId = req.user!.userId;
  const { sheets, groups } = await fetchNotesSnapshotForUser(userId);

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
      createdAt: dbTimeToMs(s.created_at as string | number),
      updatedAt: dbTimeToMs(s.updated_at as string | number),
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

/** 显式软删文稿（不依赖全量同步延时） */
router.delete('/sheets/:sheetId', async (req: Request, res: Response): Promise<void> => {
  const userId = req.user!.userId;
  const sheetId = req.params.sheetId;
  const n = await markSheetDeleted(userId, sheetId);
  if (n === 0) {
    res.status(404).json({ error: '未找到文稿或已删除' });
    return;
  }
  res.json({ ok: true });
});

/** 显式软删分组 */
router.delete('/groups/:groupId', async (req: Request, res: Response): Promise<void> => {
  const userId = req.user!.userId;
  const groupId = req.params.groupId;
  const n = await markGroupDeleted(userId, groupId);
  if (n === 0) {
    res.status(404).json({ error: '未找到分组或已删除' });
    return;
  }
  res.json({ ok: true });
});

// PUT /api/notes — 全量同步（客户端未包含的 id 做软删）
router.put('/', async (req: Request, res: Response): Promise<void> => {
  const userId = req.user!.userId;
  const { sheets = [], groups = [] } = req.body as {
    sheets?: Array<{
      id: string;
      title?: string;
      content?: string;
      type?: string;
      language?: string | null;
      groupId?: string | null;
      pinned?: boolean;
      wordCount?: number;
      chineseCount?: number;
      englishCount?: number;
      createdAt?: number;
      updatedAt?: number;
    }>;
    groups?: Array<{
      id: string;
      name?: string;
      icon?: string | null;
      color?: string | null;
      parentId?: string | null;
      order?: number;
      collapsed?: boolean;
    }>;
  };

  const nowStr = formatDbTimestamp();

  if (Array.isArray(sheets)) {
    const aliveRows = await listAliveSheetIds(userId);
    const clientIds = new Set(sheets.map((s) => s.id));
    for (const row of aliveRows) {
      if (!clientIds.has(row.id)) {
        const n = await markSheetDeleted(userId, row.id, nowStr);
        if (n === 0) {
          console.warn('[notes/sync] soft-delete sheet skipped (0 rows)', row.id, userId);
        }
      }
    }

    for (const s of sheets) {
      const cAt = msToDbTimestamp(s.createdAt ?? Date.now());
      const uAt = msToDbTimestamp(s.updatedAt ?? Date.now());
      await dbRun(
        `INSERT INTO sheets (id, user_id, title, content, type, language, group_id, pinned,
                             word_count, chinese_count, english_count, created_at, updated_at, deleted, deleted_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, NULL)
         ON DUPLICATE KEY UPDATE
           title = VALUES(title), content = VALUES(content), type = VALUES(type),
           language = VALUES(language), group_id = VALUES(group_id), pinned = VALUES(pinned),
           word_count = VALUES(word_count), chinese_count = VALUES(chinese_count),
           english_count = VALUES(english_count), updated_at = VALUES(updated_at),
           deleted = 0, deleted_at = NULL,
           created_at = COALESCE(NULLIF(TRIM(CAST(created_at AS CHAR)), ''), VALUES(created_at))`,
        [
          s.id,
          userId,
          s.title ?? '',
          s.content ?? '',
          s.type ?? 'plain',
          s.language ?? null,
          s.groupId ?? null,
          s.pinned ? 1 : 0,
          s.wordCount ?? 0,
          s.chineseCount ?? 0,
          s.englishCount ?? 0,
          cAt,
          uAt,
        ]
      );
    }
  }

  if (Array.isArray(groups)) {
    const aliveGroups = await listAliveGroupIds(userId);
    const clientGids = new Set(groups.map((g) => g.id));
    for (const row of aliveGroups) {
      if (!clientGids.has(row.id)) {
        const n = await markGroupDeleted(userId, row.id, nowStr);
        if (n === 0) {
          console.warn('[notes/sync] soft-delete group skipped (0 rows)', row.id, userId);
        }
      }
    }

    const gNow = formatDbTimestamp();
    for (const g of groups) {
      await dbRun(
        `INSERT INTO note_groups (id, user_id, name, icon, color, parent_id, \`order\`, collapsed, created_at, updated_at, deleted, deleted_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, NULL)
         ON DUPLICATE KEY UPDATE
           name = VALUES(name), icon = VALUES(icon), color = VALUES(color),
           parent_id = VALUES(parent_id), \`order\` = VALUES(\`order\`), collapsed = VALUES(collapsed),
           updated_at = VALUES(updated_at), deleted = 0, deleted_at = NULL,
           created_at = IFNULL(note_groups.created_at, VALUES(created_at))`,
        [
          g.id,
          userId,
          g.name ?? '',
          g.icon ?? null,
          g.color ?? null,
          g.parentId ?? null,
          g.order ?? 0,
          g.collapsed ? 1 : 0,
          gNow,
          gNow,
        ]
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

  const vAt = formatDbTimestamp();
  await dbRun(
    `INSERT INTO sheet_versions (sheet_id, user_id, title, content, type, language, group_id, word_count, chinese_count, english_count, created_at, deleted, deleted_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, NULL)`,
    [
      sheetId,
      userId,
      title ?? '',
      content ?? '',
      type ?? 'plain',
      language ?? null,
      groupId ?? null,
      wordCount ?? 0,
      chineseCount ?? 0,
      englishCount ?? 0,
      vAt,
    ]
  );


  const cutoff = twoMonthsAgoDbTimestamp();
  await dbRun(`DELETE FROM sheet_versions WHERE user_id = ? AND created_at < ?`, [userId, cutoff]);

  const versions = await dbAll<{ id: number; created_at: string | number }>(
    'SELECT id, created_at FROM sheet_versions WHERE sheet_id = ? ORDER BY created_at DESC',
    [sheetId]
  );
  const maxPerSheet = 50;
  if (versions.length > maxPerSheet) {
    const idsToDelete = versions.slice(maxPerSheet).map((v) => v.id);
    await dbRun(`DELETE FROM sheet_versions WHERE id IN (${idsToDelete.map(() => '?').join(',')})`, idsToDelete);
  }

  res.json({ ok: true });
});

router.get('/versions/:sheetId', async (req: Request, res: Response): Promise<void> => {
  const userId = req.user!.userId;
  const versions = await dbAll(
    `SELECT id, title, content, type, language, group_id, word_count, chinese_count, english_count, created_at
     FROM sheet_versions WHERE sheet_id = ? AND user_id = ? AND (deleted IS NULL OR deleted = 0) ORDER BY created_at DESC LIMIT 50`,
    [req.params.sheetId, userId]
  );
  res.json({
    versions: versions.map((v: Record<string, unknown>) => ({
      id: v.id,
      title: v.title,
      content: v.content,
      type: v.type,
      language: v.language,
      group_id: v.group_id,
      word_count: v.word_count,
      chinese_count: v.chinese_count,
      english_count: v.english_count,
      created_at: dbTimeToMs(v.created_at as string | number),
    })),
  });
});

router.post('/versions/restore/:versionId', async (req: Request, res: Response): Promise<void> => {
  const userId = req.user!.userId;
  type VersionRow = {
    id: number;
    sheet_id: string;
    title: string;
    content: string;
    type: string;
    language: string | null;
    group_id: string | null;
    word_count: number;
    chinese_count: number;
    english_count: number;
    created_at: string | number;
  };
  const version = await dbGet<VersionRow>(
    'SELECT * FROM sheet_versions WHERE id = ? AND user_id = ? AND (deleted IS NULL OR deleted = 0)',
    [Number(req.params.versionId), userId]
  );
  if (!version) { res.status(404).json({ error: '版本不存在' }); return; }

  await dbRun(
    `UPDATE sheets SET title = ?, content = ?, type = ?, language = ?, group_id = ?,
      word_count = ?, chinese_count = ?, english_count = ?, updated_at = ?,
      deleted = 0, deleted_at = NULL
     WHERE id = ? AND user_id = ?`,
    [
      version.title,
      version.content,
      version.type,
      version.language,
      version.group_id,
      version.word_count,
      version.chinese_count,
      version.english_count,
      formatDbTimestamp(),
      version.sheet_id,
      userId,
    ]
  );

  res.json({ ok: true, sheetId: version.sheet_id });
});

export default router;
