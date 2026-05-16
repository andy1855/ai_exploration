import { dbAll, dbRun } from '../database';
import { formatDbTimestamp } from './timestamp';

function isUnknownColumn(e: unknown): boolean {
  const err = e as { errno?: number };
  return err.errno === 1054;
}

/** 软删除一篇文稿：优先写 `deleted`，若无该列则写 `is_deleted` */
export async function markSheetDeleted(userId: number, sheetId: string, nowStr = formatDbTimestamp()): Promise<number> {
  try {
    const r = await dbRun(
      `UPDATE sheets SET \`deleted\` = 1, \`deleted_at\` = ? WHERE \`id\` = ? AND \`user_id\` = ? AND (\`deleted\` IS NULL OR \`deleted\` = 0)`,
      [nowStr, sheetId, userId]
    );
    return r.affectedRows;
  } catch (e: unknown) {
    if (!isUnknownColumn(e)) throw e;
  }
  const r = await dbRun(
    `UPDATE sheets SET \`is_deleted\` = 1, \`deleted_at\` = ? WHERE \`id\` = ? AND \`user_id\` = ? AND (\`is_deleted\` IS NULL OR \`is_deleted\` = 0)`,
    [nowStr, sheetId, userId]
  );
  return r.affectedRows;
}

/** 软删除一个分组 */
export async function markGroupDeleted(userId: number, groupId: string, nowStr = formatDbTimestamp()): Promise<number> {
  try {
    const r = await dbRun(
      `UPDATE note_groups SET \`deleted\` = 1, \`deleted_at\` = ?, \`updated_at\` = ? WHERE \`id\` = ? AND \`user_id\` = ? AND (\`deleted\` IS NULL OR \`deleted\` = 0)`,
      [nowStr, nowStr, groupId, userId]
    );
    return r.affectedRows;
  } catch (e: unknown) {
    if (!isUnknownColumn(e)) throw e;
  }
  const r = await dbRun(
    `UPDATE note_groups SET \`is_deleted\` = 1, \`deleted_at\` = ?, \`updated_at\` = ? WHERE \`id\` = ? AND \`user_id\` = ? AND (\`is_deleted\` IS NULL OR \`is_deleted\` = 0)`,
    [nowStr, nowStr, groupId, userId]
  );
  return r.affectedRows;
}

/** 当前用户全部文稿软删除（注销账户等） */
export async function markAllSheetsDeletedForUser(userId: number, nowStr = formatDbTimestamp()): Promise<void> {
  try {
    await dbRun(
      `UPDATE sheets SET \`deleted\` = 1, \`deleted_at\` = ? WHERE \`user_id\` = ? AND (\`deleted\` IS NULL OR \`deleted\` = 0)`,
      [nowStr, userId]
    );
    return;
  } catch (e: unknown) {
    if (!isUnknownColumn(e)) throw e;
  }
  await dbRun(
    `UPDATE sheets SET \`is_deleted\` = 1, \`deleted_at\` = ? WHERE \`user_id\` = ? AND (\`is_deleted\` IS NULL OR \`is_deleted\` = 0)`,
    [nowStr, userId]
  );
}

/** 当前用户全部分组软删除 */
export async function markAllGroupsDeletedForUser(userId: number, nowStr = formatDbTimestamp()): Promise<void> {
  try {
    await dbRun(
      `UPDATE note_groups SET \`deleted\` = 1, \`deleted_at\` = ?, \`updated_at\` = ? WHERE \`user_id\` = ? AND (\`deleted\` IS NULL OR \`deleted\` = 0)`,
      [nowStr, nowStr, userId]
    );
    return;
  } catch (e: unknown) {
    if (!isUnknownColumn(e)) throw e;
  }
  await dbRun(
    `UPDATE note_groups SET \`is_deleted\` = 1, \`deleted_at\` = ?, \`updated_at\` = ? WHERE \`user_id\` = ? AND (\`is_deleted\` IS NULL OR \`is_deleted\` = 0)`,
    [nowStr, nowStr, userId]
  );
}

/** 用户行软删除 */
export async function markUserDeleted(userId: number, nowStr = formatDbTimestamp()): Promise<void> {
  try {
    await dbRun(`UPDATE users SET \`deleted\` = 1, \`deleted_at\` = ? WHERE \`id\` = ?`, [nowStr, userId]);
    return;
  } catch (e: unknown) {
    if (!isUnknownColumn(e)) throw e;
    console.warn('[soft-delete] users 表缺少 deleted 列，跳过用户行软删');
  }
}

/** 列出未删除的文稿 id（用于全量同步差量软删） */
export async function listAliveSheetIds(userId: number): Promise<{ id: string }[]> {
  try {
    return await dbAll<{ id: string }>(
      `SELECT id FROM sheets WHERE user_id = ? AND (\`deleted\` IS NULL OR \`deleted\` = 0)`,
      [userId]
    );
  } catch (e: unknown) {
    if (!isUnknownColumn(e)) throw e;
    return await dbAll<{ id: string }>(
      `SELECT id FROM sheets WHERE user_id = ? AND (\`is_deleted\` IS NULL OR \`is_deleted\` = 0)`,
      [userId]
    );
  }
}

export async function listAliveGroupIds(userId: number): Promise<{ id: string }[]> {
  try {
    return await dbAll<{ id: string }>(
      `SELECT id FROM note_groups WHERE user_id = ? AND (\`deleted\` IS NULL OR \`deleted\` = 0)`,
      [userId]
    );
  } catch (e: unknown) {
    if (!isUnknownColumn(e)) throw e;
    return await dbAll<{ id: string }>(
      `SELECT id FROM note_groups WHERE user_id = ? AND (\`is_deleted\` IS NULL OR \`is_deleted\` = 0)`,
      [userId]
    );
  }
}

async function fetchSheetsRows(userId: number): Promise<Record<string, unknown>[]> {
  try {
    return await dbAll<Record<string, unknown>>(
      `SELECT id, title, content, type, language, group_id, pinned,
              word_count, chinese_count, english_count, created_at, updated_at
       FROM sheets
       WHERE user_id = ? AND (\`deleted\` IS NULL OR \`deleted\` = 0)
       ORDER BY updated_at DESC`,
      [userId]
    );
  } catch (e: unknown) {
    if (!isUnknownColumn(e)) throw e;
    return await dbAll<Record<string, unknown>>(
      `SELECT id, title, content, type, language, group_id, pinned,
              word_count, chinese_count, english_count, created_at, updated_at
       FROM sheets
       WHERE user_id = ? AND (\`is_deleted\` IS NULL OR \`is_deleted\` = 0)
       ORDER BY updated_at DESC`,
      [userId]
    );
  }
}

async function fetchGroupsRows(userId: number): Promise<Record<string, unknown>[]> {
  try {
    return await dbAll<Record<string, unknown>>(
      `SELECT id, name, icon, color, parent_id, \`order\`, collapsed
       FROM note_groups
       WHERE user_id = ? AND (\`deleted\` IS NULL OR \`deleted\` = 0)
       ORDER BY \`order\` ASC`,
      [userId]
    );
  } catch (e: unknown) {
    if (!isUnknownColumn(e)) throw e;
    return await dbAll<Record<string, unknown>>(
      `SELECT id, name, icon, color, parent_id, \`order\`, collapsed
       FROM note_groups
       WHERE user_id = ? AND (\`is_deleted\` IS NULL OR \`is_deleted\` = 0)
       ORDER BY \`order\` ASC`,
      [userId]
    );
  }
}

export async function fetchNotesSnapshotForUser(userId: number): Promise<{
  sheets: Record<string, unknown>[];
  groups: Record<string, unknown>[];
}> {
  const [sheets, groups] = await Promise.all([fetchSheetsRows(userId), fetchGroupsRows(userId)]);
  return { sheets, groups };
}
