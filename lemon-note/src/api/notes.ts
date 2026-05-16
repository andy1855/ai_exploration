import { api } from './client';
import type { Sheet, Group } from '../types';

export interface NotesSnapshot {
  sheets: Sheet[];
  groups: Group[];
}

export interface SheetVersion {
  id: number;
  title: string;
  content: string;
  type: string;
  language: string | null;
  group_id: string | null;
  word_count: number;
  chinese_count: number;
  english_count: number;
  created_at: number;
}

export const notesApi = {
  /** 从服务器拉取所有笔记 */
  fetchAll: () =>
    api.get<NotesSnapshot>('/notes'),

  /** 全量同步笔记到服务器 */
  syncAll: (data: NotesSnapshot) =>
    api.put<{ ok: boolean }>('/notes', data),

  /** 软删除单篇文稿（服务端 deleted=1） */
  softDeleteSheet: (sheetId: string) =>
    api.delete<{ ok: boolean }>(`/notes/sheets/${encodeURIComponent(sheetId)}`),

  /** 软删除分组 */
  softDeleteGroup: (groupId: string) =>
    api.delete<{ ok: boolean }>(`/notes/groups/${encodeURIComponent(groupId)}`),

  /** 保存版本快照 */
  saveVersion: (sheet: Sheet) =>
    api.post<{ ok: boolean }>('/notes/versions', {
      sheetId: sheet.id,
      title: sheet.title,
      content: sheet.content,
      type: sheet.type,
      language: sheet.language,
      groupId: sheet.groupId,
      wordCount: sheet.wordCount,
      chineseCount: sheet.chineseCount,
      englishCount: sheet.englishCount,
    }),

  /** 获取版本历史 */
  getVersions: (sheetId: string) =>
    api.get<{ versions: SheetVersion[] }>(`/notes/versions/${sheetId}`),

  /** 恢复到指定版本 */
  restoreVersion: (versionId: number) =>
    api.post<{ ok: boolean; sheetId: string }>(`/notes/versions/restore/${versionId}`),
};
