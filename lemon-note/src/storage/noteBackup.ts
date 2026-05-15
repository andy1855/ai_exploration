import type { Sheet, Group } from '../types';

const BACKUP_KEY = 'lemon-note-backups';

/** 备份时间点定义（从最近到最远） */
const BACKUP_SLOTS = [
  { label: '半小时前',  withinMs: 30 * 60 * 1000 },
  { label: '1 小时前', withinMs: 60 * 60 * 1000 },
  { label: '昨天',     withinMs: 24 * 60 * 60 * 1000 },
  { label: '3 天前',   withinMs: 3 * 24 * 60 * 60 * 1000 },
  { label: '1 个月前', withinMs: 30 * 24 * 60 * 60 * 1000 },
] as const;

export interface BackupEntry {
  id: string;
  label: string;
  timestamp: number;
  sheets: Sheet[];
  groups: Group[];
}

function loadBackups(): BackupEntry[] {
  try {
    const raw = localStorage.getItem(BACKUP_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return [];
}

function saveBackups(backups: BackupEntry[]) {
  try {
    localStorage.setItem(BACKUP_KEY, JSON.stringify(backups));
  } catch (e) {
    console.warn('[backup] 保存备份失败', e);
  }
}

/**
 * 在笔记变更时调用：按时间槽位创建备份快照。
 * 策略：从最近到最远扫描，找到第一个未创建的槽位，填充当前数据。
 * 最多保留 5 份。
 */
export function tryAutoBackup(sheets: Sheet[], groups: Group[]) {
  const now = Date.now();
  const backups = loadBackups();
  const existing = new Set(backups.map((b) => b.label));

  for (const slot of BACKUP_SLOTS) {
    if (existing.has(slot.label)) continue;

    // 找到最老的未备份的历史快照最近的那份
    if (existing.size < BACKUP_SLOTS.length) {
      backups.push({
        id: `backup-${now}`,
        label: slot.label,
        timestamp: now,
        sheets: JSON.parse(JSON.stringify(sheets)),
        groups: JSON.parse(JSON.stringify(groups)),
      });
      break;
    }
  }

  // 裁剪到 5 份
  if (backups.length > BACKUP_SLOTS.length) {
    backups.splice(0, backups.length - BACKUP_SLOTS.length);
  }

  saveBackups(backups);
}

/** 获取所有备份列表（最新的在前） */
export function getBackupList(): BackupEntry[] {
  return loadBackups().reverse();
}

/** 导出备份为 JSON 文件下载 */
export function exportBackup(backup: BackupEntry) {
  const data = {
    ...backup,
    exportedAt: new Date().toISOString(),
    version: '1.0',
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `lemon-note-backup-${new Date(backup.timestamp).toLocaleDateString('zh-CN').replace(/\//g, '-')}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

/** 从上传的 JSON 文件解析备份数据 */
export function parseBackupFile(file: File): Promise<BackupEntry> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result as string);
        if (!Array.isArray(data.sheets)) {
          reject(new Error('无效的备份文件：缺少 sheets 数据'));
          return;
        }
        resolve({
          id: data.id ?? `import-${Date.now()}`,
          label: data.label ?? '导入备份',
          timestamp: data.timestamp ?? Date.now(),
          sheets: data.sheets,
          groups: Array.isArray(data.groups) ? data.groups : [],
        });
      } catch {
        reject(new Error('无效的备份文件：无法解析 JSON'));
      }
    };
    reader.onerror = () => reject(new Error('文件读取失败'));
    reader.readAsText(file);
  });
}
