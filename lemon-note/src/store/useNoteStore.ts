import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';
import type { Sheet, Group, AppPreferences, SheetType, EditorViewMode, MarkdownPreviewMode } from '../types';
import { getLanguageExtName } from '../utils/languageUtils';
import { textIncludesQuery } from '../utils/searchUtils';
import { inferTypeAndLanguageFromTitle } from '../utils/inferSheetTypeFromTitle';
import { loadNotesFromLocalStorage, onChangeSync, flushPushToServer } from '../storage/notePersistence';
import { requestCheckpoint } from '../version/versionCheckpoint';

const PREFS_KEY = 'lemon-note-preferences';

function loadData(): { sheets: Sheet[]; groups: Group[] } {
  return loadNotesFromLocalStorage();
}

function saveData(sheets: Sheet[], groups: Group[]) {
  onChangeSync(sheets, groups);
}

function loadPreferences(): AppPreferences {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (raw) {
      const saved = JSON.parse(raw) as Record<string, unknown>;
      let editorViewMode: EditorViewMode = (saved.editorViewMode as EditorViewMode) ?? 'default';
      if (saved.editorViewMode == null) {
        if (saved.typewriterMode === true) editorViewMode = 'typewriter';
        else if (saved.focusMode === true) editorViewMode = 'focus';
      }
      delete saved.focusMode;
      delete saved.typewriterMode;
      let markdownPreviewMode: MarkdownPreviewMode =
        (saved.markdownPreviewMode as MarkdownPreviewMode) ?? 'split';
      if (saved.markdownPreviewMode == null && typeof saved.showPreview === 'boolean') {
        markdownPreviewMode = saved.showPreview ? 'split' : 'edit';
      }
      delete saved.showPreview;
      return { ...defaultPreferences, ...saved, editorViewMode, markdownPreviewMode } as AppPreferences;
    }
  } catch {}
  return { ...defaultPreferences };
}

const defaultPreferences: AppPreferences = {
  theme: 'light',
  sidebarWidth: 280,
  editorFontSize: 16,
  editorFontFamily: 'system',
  lineHeight: 1.8,
  letterSpacing: 0,
  markdownPreviewMode: 'split',
  editorViewMode: 'default',
  showWordCount: true,
  sidebarCollapsed: false,
  toolbarCollapsed: false,
  formattingBarCollapsed: false,
  fullscreen: false,
};

function savePreferences(prefs: AppPreferences) {
  localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
}

interface WordCount {
  chinese: number;
  english: number;
  total: number;
}

function countWords(text: string): WordCount {
  const cleaned = text.replace(/[#*`~\[\]()>|\\]/g, '').trim();
  if (!cleaned) return { chinese: 0, english: 0, total: 0 };
  const chineseChars = (cleaned.match(/[\u4e00-\u9fff\u3400-\u4dbf\u{20000}-\u{2a6df}]/gu) || []).length;
  const withoutChinese = cleaned.replace(/[\u4e00-\u9fff\u3400-\u4dbf]/g, ' ');
  const englishWords = withoutChinese.split(/\s+/).filter((w) => /[a-zA-Z0-9]/.test(w)).length;
  return { chinese: chineseChars, english: englishWords, total: chineseChars + englishWords };
}

interface NoteState {
  sheets: Sheet[];
  groups: Group[];
  selectedSheetId: string | null;
  selectedGroupId: string | null;
  preferences: AppPreferences;
  searchQuery: string;

  // Sheet actions
  /** 新建文稿时默认归属的分组（当前选中目录，或当前文稿所在目录） */
  resolveNewSheetParentGroupId: () => string | undefined;
  createSheet: (groupId?: string, type?: SheetType, language?: string | null) => string;
  updateSheet: (id: string, updates: Partial<Sheet>) => void;
  deleteSheet: (id: string) => void;
  deleteSheets: (ids: string[]) => void;
  moveSheet: (id: string, groupId: string | null) => void;
  moveSheets: (ids: string[], groupId: string | null) => void;
  copySheet: (id: string, groupId?: string | null) => string;
  selectSheet: (id: string | null) => void;

  // Group actions
  createGroup: (name?: string, parentId?: string | null) => string;
  updateGroup: (id: string, updates: Partial<Group>) => void;
  deleteGroup: (id: string) => void;
  selectGroup: (id: string | null) => void;

  // Preferences
  updatePreferences: (updates: Partial<AppPreferences>) => void;

  // Search
  setSearchQuery: (query: string) => void;

  // Filtered sheets
  getFilteredSheets: () => Sheet[];
  getSheetsByGroup: (groupId: string | null) => Sheet[];
  getChildGroups: (parentId: string | null) => Group[];
}

export const useNoteStore = create<NoteState>((set, get) => {
  const initial = loadData();
  const initialPrefs = loadPreferences();

  return {
    sheets: initial.sheets,
    groups: initial.groups,
    selectedSheetId: initial.sheets.length > 0 ? initial.sheets[0].id : null,
    selectedGroupId: null,
    preferences: initialPrefs,
    searchQuery: '',

    resolveNewSheetParentGroupId: () => {
      const state = get();
      if (state.selectedGroupId) return state.selectedGroupId;
      if (state.selectedSheetId) {
        return state.sheets.find((s) => s.id === state.selectedSheetId)?.groupId ?? undefined;
      }
      return undefined;
    },

    createSheet: (groupId?: string, type: SheetType = 'plain', language?: string | null) => {
      const before = get();
      if (before.selectedSheetId) {
        const prevSheet = before.sheets.find((s) => s.id === before.selectedSheetId);
        if (prevSheet) void requestCheckpoint(prevSheet, 'sheet_switch');
      }
      const now = Date.now();
      const ext = type === 'code' ? getLanguageExtName(language) : type === 'markdown' ? '.md' : '';
      const baseName = type === 'markdown' ? '未命名文稿' : type === 'code' ? '未命名代码' : '未命名文稿';
      const title = `${baseName}${ext}`;
      const newSheet: Sheet = {
        id: uuidv4(),
        title,
        content: type === 'markdown' ? '# 标题\n\n开始写作...' : '',
        createdAt: now,
        updatedAt: now,
        groupId: groupId ?? null,
        type,
        language: language ?? null,
        wordCount: 0,
        chineseCount: 0,
        englishCount: 0,
      };
      set((state) => {
        const sheets = [newSheet, ...state.sheets];
        saveData(sheets, state.groups);
        return { sheets, selectedSheetId: newSheet.id, selectedGroupId: groupId ?? null };
      });
      return newSheet.id;
    },

    updateSheet: (id, updates) => {
      set((state) => {
        const sheets = state.sheets.map((s) => {
          if (s.id !== id) return s;
          const inferred =
            updates.title !== undefined ? inferTypeAndLanguageFromTitle(updates.title) : null;
          const updated = {
            ...s,
            ...updates,
            updatedAt: Date.now(),
          };
          if (inferred) {
            updated.type = inferred.type;
            updated.language = inferred.language;
          }
          if (updates.content !== undefined) {
            const wc = countWords(updates.content);
            updated.wordCount = wc.total;
            updated.chineseCount = wc.chinese;
            updated.englishCount = wc.english;
          }
          return updated;
        });
        saveData(sheets, state.groups);
        return { sheets };
      });
    },

    deleteSheet: (id) => {
      set((state) => {
        const sheets = state.sheets.filter((s) => s.id !== id);
        saveData(sheets, state.groups);
        return {
          sheets,
          selectedSheetId:
            state.selectedSheetId === id
              ? sheets.length > 0
                ? sheets[0].id
                : null
              : state.selectedSheetId,
        };
      });
      flushPushToServer(() => {
        const st = get();
        return { sheets: st.sheets, groups: st.groups };
      });
    },

    moveSheet: (id, groupId) => {
      set((state) => {
        const sheets = state.sheets.map((s) =>
          s.id === id ? { ...s, groupId, updatedAt: Date.now() } : s
        );
        saveData(sheets, state.groups);
        return { sheets };
      });
    },

    moveSheets: (ids, groupId) => {
      const idSet = new Set(ids);
      set((state) => {
        const sheets = state.sheets.map((s) =>
          idSet.has(s.id) ? { ...s, groupId, updatedAt: Date.now() } : s
        );
        saveData(sheets, state.groups);
        return { sheets };
      });
    },

    deleteSheets: (ids) => {
      const idSet = new Set(ids);
      set((state) => {
        const sheets = state.sheets.filter((s) => !idSet.has(s.id));
        saveData(sheets, state.groups);
        return {
          sheets,
          selectedSheetId: idSet.has(state.selectedSheetId ?? '')
            ? sheets.length > 0 ? sheets[0].id : null
            : state.selectedSheetId,
        };
      });
      flushPushToServer(() => {
        const st = get();
        return { sheets: st.sheets, groups: st.groups };
      });
    },

    copySheet: (id, groupId) => {
      const before = get();
      if (before.selectedSheetId && before.selectedSheetId !== id) {
        const prevSheet = before.sheets.find((s) => s.id === before.selectedSheetId);
        if (prevSheet) void requestCheckpoint(prevSheet, 'sheet_switch');
      }
      const now = Date.now();
      const src = useNoteStore.getState().sheets.find((s) => s.id === id);
      if (!src) return '';
      const copy: Sheet = {
        ...src,
        id: uuidv4(),
        title: `${src.title} (副本)`,
        createdAt: now,
        updatedAt: now,
        groupId: groupId !== undefined ? groupId : src.groupId,
      };
      set((state) => {
        const sheets = [copy, ...state.sheets];
        saveData(sheets, state.groups);
        return { sheets, selectedSheetId: copy.id };
      });
      return copy.id;
    },

    selectSheet: (id) => {
      const state = get();
      const prevId = state.selectedSheetId;
      if (prevId && prevId !== id) {
        const prevSheet = state.sheets.find((s) => s.id === prevId);
        if (prevSheet) void requestCheckpoint(prevSheet, 'sheet_switch');
      }
      set({ selectedSheetId: id });
    },

    createGroup: (name = '新建分组', parentId = null) => {
      const now = Date.now();
      const newGroup: Group = {
        id: uuidv4(),
        name,
        parentId,
        order: now,
      };
      set((state) => {
        const groups = [...state.groups, newGroup];
        saveData(state.sheets, groups);
        return { groups, selectedGroupId: newGroup.id };
      });
      return newGroup.id;
    },

    updateGroup: (id, updates) => {
      set((state) => {
        const groups = state.groups.map((g) => (g.id === id ? { ...g, ...updates } : g));
        saveData(state.sheets, groups);
        return { groups };
      });
    },

    deleteGroup: (id) => {
      set((state) => {
        const groups = state.groups.filter((g) => g.id !== id && g.parentId !== id);
        const sheets = state.sheets.map((s) =>
          s.groupId === id ? { ...s, groupId: null } : s
        );
        saveData(sheets, groups);
        return {
          groups,
          sheets,
          selectedGroupId: state.selectedGroupId === id ? null : state.selectedGroupId,
        };
      });
      flushPushToServer(() => {
        const st = get();
        return { sheets: st.sheets, groups: st.groups };
      });
    },

    selectGroup: (id) => set({ selectedGroupId: id }),

    updatePreferences: (updates) => {
      set((state) => {
        const prefs = { ...state.preferences, ...updates };
        savePreferences(prefs);
        return { preferences: prefs };
      });
    },

    setSearchQuery: (query) => set({ searchQuery: query }),

    getFilteredSheets: () => {
      const state = get();
      const { sheets, searchQuery, selectedGroupId } = state;
      let filtered = sheets;
      // 有搜索词时：在所有文稿中搜索，不受当前选中分组限制（否则会漏掉匹配的文档）
      if (searchQuery.trim()) {
        filtered = filtered.filter(
          (s) => textIncludesQuery(s.title, searchQuery) || textIncludesQuery(s.content, searchQuery)
        );
      } else if (selectedGroupId) {
        filtered = filtered.filter((s) => s.groupId === selectedGroupId);
      }
      return [...filtered].sort((a, b) => b.updatedAt - a.updatedAt);
    },

    getSheetsByGroup: (groupId) => {
      return get()
        .sheets.filter((s) => s.groupId === groupId)
        .sort((a, b) => b.updatedAt - a.updatedAt);
    },

    getChildGroups: (parentId) => {
      return get()
        .groups.filter((g) => g.parentId === parentId)
        .sort((a, b) => a.order - b.order);
    },
  };
});
