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

/** 默认：完整界面；专注：弱化工具栏与标题栏干扰；打字机：当前行保持在视区中部 */
export type EditorViewMode = 'default' | 'focus' | 'typewriter';

/** Markdown：仅编辑 / 分栏编辑+预览 / 仅预览 */
export type MarkdownPreviewMode = 'edit' | 'split' | 'preview';

export interface AppPreferences {
  theme: ThemeMode;
  sidebarWidth: number;
  editorFontSize: number;
  editorFontFamily: string;
  lineHeight: number;
  letterSpacing: number;
  markdownPreviewMode: MarkdownPreviewMode;
  editorViewMode: EditorViewMode;
  showWordCount: boolean;
  sidebarCollapsed: boolean;
  toolbarCollapsed: boolean;
  formattingBarCollapsed: boolean;
  fullscreen: boolean;
}
