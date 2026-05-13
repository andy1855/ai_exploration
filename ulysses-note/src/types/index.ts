export interface Sheet {
  id: string;
  title: string;
  content: string;
  createdAt: number;
  updatedAt: number;
  groupId: string | null;
  pinned?: boolean;
  wordCount?: number;
}

export interface Group {
  id: string;
  name: string;
  icon?: string;
  color?: string;
  parentId: string | null;
  order: number;
  collapsed?: boolean;
}

export type ThemeMode = 'light' | 'dark' | 'system';

export interface AppPreferences {
  theme: ThemeMode;
  sidebarWidth: number;
  editorFontSize: number;
  showPreview: boolean;
  focusMode: boolean;
  showWordCount: boolean;
}
