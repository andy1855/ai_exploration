import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';
import type { Sheet, Group, AppPreferences } from '../types';

const STORAGE_KEY = 'ulysses-note-data';
const PREFS_KEY = 'ulysses-note-preferences';

function loadData(): { sheets: Sheet[]; groups: Group[] } {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return { sheets: [], groups: [] };
}

function saveData(sheets: Sheet[], groups: Group[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ sheets, groups }));
}

function loadPreferences(): AppPreferences {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return {
    theme: 'light',
    sidebarWidth: 280,
    editorFontSize: 16,
    showPreview: true,
    focusMode: false,
    showWordCount: true,
  };
}

function savePreferences(prefs: AppPreferences) {
  localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
}

function countWords(text: string): number {
  const cleaned = text.replace(/[#*`~\[\]()>|\\]/g, '').trim();
  if (!cleaned) return 0;
  // Count Chinese characters + English words
  const chineseChars = (cleaned.match(/[\u4e00-\u9fff\u3400-\u4dbf]/g) || []).length;
  const englishText = cleaned.replace(/[\u4e00-\u9fff\u3400-\u4dbf]/g, ' ');
  const englishWords = englishText.split(/\s+/).filter(Boolean).length;
  return chineseChars + englishWords;
}

interface NoteState {
  sheets: Sheet[];
  groups: Group[];
  selectedSheetId: string | null;
  selectedGroupId: string | null;
  preferences: AppPreferences;
  searchQuery: string;

  // Sheet actions
  createSheet: (groupId?: string) => string;
  updateSheet: (id: string, updates: Partial<Sheet>) => void;
  deleteSheet: (id: string) => void;
  moveSheet: (id: string, groupId: string | null) => void;
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

    createSheet: (groupId?: string) => {
      const now = Date.now();
      const newSheet: Sheet = {
        id: uuidv4(),
        title: '未命名文稿',
        content: '',
        createdAt: now,
        updatedAt: now,
        groupId: groupId ?? null,
        wordCount: 0,
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
          const updated = {
            ...s,
            ...updates,
            updatedAt: Date.now(),
          };
          if (updates.content !== undefined) {
            updated.wordCount = countWords(updates.content);
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

    selectSheet: (id) => set({ selectedSheetId: id }),

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
      if (selectedGroupId) {
        filtered = filtered.filter((s) => s.groupId === selectedGroupId);
      }
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        filtered = filtered.filter(
          (s) =>
            s.title.toLowerCase().includes(q) ||
            s.content.toLowerCase().includes(q)
        );
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
