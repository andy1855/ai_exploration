import { notesApi } from '../api/notes';
import type { Sheet } from '../types';

/** 上次为某文稿写入版本历史时的元数据（内存级，刷新后重置，仅影响去重粒度） */
type CheckpointMeta = {
  at: number;
  snapshotHash: string;
  contentLength: number;
  title: string;
};

const metaBySheet = new Map<string, CheckpointMeta>();

const MIN_INTERVAL_MS = 2 * 60 * 1000;
const LARGE_CHAR_DELTA = 280;
const LARGE_RATIO = 0.045;
const SMALL_UNLOAD_DELTA = 120;

function snapshotHash(s: Sheet): string {
  const str = `${s.title ?? ''}\n${s.content ?? ''}`;
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return `${h}`;
}

function recordAfterSave(sheet: Sheet): void {
  const now = Date.now();
  metaBySheet.set(sheet.id, {
    at: now,
    snapshotHash: snapshotHash(sheet),
    contentLength: sheet.content?.length ?? 0,
    title: sheet.title ?? '',
  });
}

function shouldWriteVersion(sheet: Sheet, reason: 'sheet_switch' | 'beforeunload' | 'before_sync'): boolean {
  const prev = metaBySheet.get(sheet.id);
  const snap = snapshotHash(sheet);
  if (prev && prev.snapshotHash === snap) return false;

  const now = Date.now();
  if (!prev) return true;

  const titleChanged = prev.title !== (sheet.title ?? '');
  const len = sheet.content?.length ?? 0;
  const lenDelta = Math.abs(len - prev.contentLength);
  const base = Math.max(prev.contentLength, len, 1);
  const ratio = lenDelta / base;

  const largeChange =
    titleChanged || lenDelta >= LARGE_CHAR_DELTA || ratio >= LARGE_RATIO;
  const cooledDown = now - prev.at >= MIN_INTERVAL_MS;

  if (reason === 'beforeunload') {
    return largeChange || cooledDown || lenDelta >= SMALL_UNLOAD_DELTA;
  }

  if (reason === 'sheet_switch' || reason === 'before_sync') {
    return largeChange || cooledDown;
  }

  return false;
}

/**
 * 异步写入版本（失败静默）。在切换笔记、关闭页面前、推送服务器前调用。
 */
export async function requestCheckpoint(sheet: Sheet, reason: 'sheet_switch' | 'beforeunload' | 'before_sync'): Promise<void> {
  if (!shouldWriteVersion(sheet, reason)) return;
  try {
    await notesApi.saveVersion(sheet);
    recordAfterSave(sheet);
  } catch {
    // 离线或失败：不更新 meta，下次触发仍可重试
  }
}

/** 同步前：对最近可能编辑过的文稿尝试检查点 */
export async function checkpointSheetsBeforePush(sheets: Sheet[]): Promise<void> {
  const sorted = [...sheets].sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0));
  const top = sorted.slice(0, 24);
  await Promise.all(top.map((s) => requestCheckpoint(s, 'before_sync')));
}

export function checkpointOnUnload(sheet: Sheet | undefined): void {
  if (!sheet) return;
  void requestCheckpoint(sheet, 'beforeunload');
}
