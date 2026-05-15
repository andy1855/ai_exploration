export type SheetType = 'plain' | 'markdown' | 'code';

export interface Sheet {
  id: string;
  title: string;
  content: string;
  createdAt: number;
  updatedAt: number;
  groupId: string | null;
  type: SheetType;
  language?: string | null;
  pinned?: boolean;
  wordCount?: number;
  chineseCount?: number;
  englishCount?: number;
}

export const CODE_LANGUAGES = [
  { value: 'javascript', label: 'JavaScript' },
  { value: 'typescript', label: 'TypeScript' },
  { value: 'python', label: 'Python' },
  { value: 'java', label: 'Java' },
  { value: 'go', label: 'Go' },
  { value: 'rust', label: 'Rust' },
  { value: 'cpp', label: 'C++' },
  { value: 'c', label: 'C' },
  { value: 'csharp', label: 'C#' },
  { value: 'php', label: 'PHP' },
  { value: 'ruby', label: 'Ruby' },
  { value: 'swift', label: 'Swift' },
  { value: 'kotlin', label: 'Kotlin' },
  { value: 'sql', label: 'SQL' },
  { value: 'html', label: 'HTML' },
  { value: 'css', label: 'CSS' },
  { value: 'shell', label: 'Shell' },
  { value: 'yaml', label: 'YAML' },
  { value: 'json', label: 'JSON' },
  { value: 'xml', label: 'XML' },
  { value: 'markdown', label: 'Markdown' },
] as const;

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
  editorFontFamily: string;
  lineHeight: number;
  letterSpacing: number;
  showPreview: boolean;
  focusMode: boolean;
  showWordCount: boolean;
  typewriterMode: boolean;
  sidebarCollapsed: boolean;
  toolbarCollapsed: boolean;
  formattingBarCollapsed: boolean;
  fullscreen: boolean;
}
