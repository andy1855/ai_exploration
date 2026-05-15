import type { Sheet, Group } from '../types';

export const NOTES_STORAGE_KEY = 'lemon-note-data';
const ULYSSES_STORAGE_KEY = 'ulysses-note-data';
const MIGRATED_KEY = 'lemon-note-migrated-from-ulysses';
const DATA_FILE = 'lemon-note-data.json';
const IDB_NAME = 'lemon-note-fs';
const IDB_STORE = 'handles';
const IDB_DIR_KEY = 'data-dir';

let directoryHandle: FileSystemDirectoryHandle | null = null;

function idbOpen(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const r = indexedDB.open(IDB_NAME, 1);
    r.onupgradeneeded = () => {
      if (!r.result.objectStoreNames.contains(IDB_STORE)) {
        r.result.createObjectStore(IDB_STORE);
      }
    };
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}

async function idbSetDirHandle(handle: FileSystemDirectoryHandle) {
  const db = await idbOpen();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, 'readwrite');
    tx.objectStore(IDB_STORE).put(handle, IDB_DIR_KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

async function idbGetDirHandle(): Promise<FileSystemDirectoryHandle | null> {
  const db = await idbOpen();
  const handle = await new Promise<FileSystemDirectoryHandle | undefined>((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, 'readonly');
    const req = tx.objectStore(IDB_STORE).get(IDB_DIR_KEY);
    req.onsuccess = () => resolve(req.result as FileSystemDirectoryHandle | undefined);
    req.onerror = () => reject(req.error);
  });
  db.close();
  return handle ?? null;
}

async function idbRemoveDirHandle() {
  const db = await idbOpen();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, 'readwrite');
    tx.objectStore(IDB_STORE).delete(IDB_DIR_KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

export async function initNotePersistence(): Promise<void> {
  directoryHandle = null;
  // File System Access API 仅在安全上下文可用；HTTP 部署下不必打开 IDB，避免拖慢首屏。
  if (typeof window !== 'undefined' && !window.isSecureContext) {
    return;
  }
  try {
    directoryHandle = await idbGetDirHandle();
    // 不在启动时调用 requestPermission（可能长时间阻塞或在不支持的上下文中异常），
    // 读写失败时在 tryHydrateFromDisk / persistNotes 中回退到 localStorage。
  } catch {
    directoryHandle = null;
  }
}

export function isUsingLocalDirectory(): boolean {
  return directoryHandle !== null;
}

export async function tryHydrateFromDisk(): Promise<{ sheets: Sheet[]; groups: Group[] } | null> {
  if (!directoryHandle) return null;
  try {
    const fh = await directoryHandle.getFileHandle(DATA_FILE);
    const file = await fh.getFile();
    const text = await file.text();
    const data = JSON.parse(text) as { sheets?: Sheet[]; groups?: Group[] };
    if (!Array.isArray(data.sheets)) return null;
    return {
      sheets: data.sheets,
      groups: Array.isArray(data.groups) ? data.groups : [],
    };
  } catch {
    return null;
  }
}

async function writeDisk(dir: FileSystemDirectoryHandle, sheets: Sheet[], groups: Group[]) {
  const fh = await dir.getFileHandle(DATA_FILE, { create: true });
  const w = await fh.createWritable();
  await w.write(JSON.stringify({ sheets, groups, savedAt: Date.now() }));
  await w.close();
}

export async function persistNotes(sheets: Sheet[], groups: Group[]): Promise<void> {
  if (directoryHandle) {
    try {
      await writeDisk(directoryHandle, sheets, groups);
      return;
    } catch (e) {
      console.warn('[notes] 写入本地目录失败，改用浏览器存储', e);
    }
  }
  try {
    localStorage.setItem(NOTES_STORAGE_KEY, JSON.stringify({ sheets, groups }));
  } catch (e) {
    console.error('[notes] localStorage 写入失败', e);
  }
}

/**
 * 从 ulysses-note 的 localStorage 数据一次性迁移到 lemon-note。
 * 仅在 lemon-note 无数据且 ulysses-note 有数据时执行。
 */
function tryMigrateFromUlysses(): { sheets: Sheet[]; groups: Group[] } | null {
  try {
    if (localStorage.getItem(MIGRATED_KEY)) return null;
    const raw = localStorage.getItem(ULYSSES_STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!Array.isArray(data.sheets)) return null;
    // 标记已迁移，避免重复执行
    localStorage.setItem(MIGRATED_KEY, '1');
    // 将 ulysses 数据写入 lemon-note 的 key
    localStorage.setItem(NOTES_STORAGE_KEY, JSON.stringify({ sheets: data.sheets, groups: data.groups ?? [] }));
    console.log('[migrate] ulysses-note 笔记已迁移到 lemon-note');
    return { sheets: data.sheets, groups: data.groups ?? [] };
  } catch (e) {
    console.warn('[migrate] ulysses-note 数据迁移失败', e);
    return null;
  }
}

export function loadNotesFromLocalStorage(): { sheets: Sheet[]; groups: Group[] } {
  try {
    const raw = localStorage.getItem(NOTES_STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  // 无 lemon-note 数据 → 尝试从 ulysses-note 迁移
  const migrated = tryMigrateFromUlysses();
  if (migrated) return migrated;
  return { sheets: [], groups: [] };
}

export async function bindLocalDataDirectory(): Promise<{ ok: boolean; message: string }> {
  try {
    if (!('showDirectoryPicker' in window)) {
      return { ok: false, message: '当前浏览器不支持选择本地目录，请使用 Chrome、Edge 等 Chromium 内核浏览器。' };
    }
    const dir = await window.showDirectoryPicker({ mode: 'readwrite' });
    const perm = await dir.requestPermission({ mode: 'readwrite' });
    if (perm !== 'granted') {
      return { ok: false, message: '需要授予对该文件夹的读写权限才能保存文稿。' };
    }
    await idbSetDirHandle(dir);
    directoryHandle = dir;
    return { ok: true, message: '已选择本地目录，文稿将保存到该文件夹内的 lemon-note-data.json。' };
  } catch (e) {
    const msg = e instanceof Error ? e.message : '已取消';
    return { ok: false, message: msg };
  }
}

export async function unbindLocalDataDirectory(): Promise<void> {
  await idbRemoveDirHandle();
  directoryHandle = null;
}

export async function flushCurrentNotesToDisk(
  getState: () => { sheets: Sheet[]; groups: Group[] }
): Promise<{ ok: boolean; message: string }> {
  if (!directoryHandle) {
    return { ok: false, message: '请先选择本地目录。' };
  }
  try {
    const { sheets, groups } = getState();
    await writeDisk(directoryHandle, sheets, groups);
    return { ok: true, message: '已保存到本地。' };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : '保存失败' };
  }
}
