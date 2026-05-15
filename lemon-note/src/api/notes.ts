import { api } from './client';
import type { Sheet, Group } from '../types';

export interface NotesSnapshot {
  sheets: Sheet[];
  groups: Group[];
}

export const notesApi = {
  /** 从服务器拉取所有笔记 */
  fetchAll: () =>
    api.get<NotesSnapshot>('/notes'),

  /** 全量同步笔记到服务器 */
  syncAll: (data: NotesSnapshot) =>
    api.put<{ ok: boolean }>('/notes', data),
};
