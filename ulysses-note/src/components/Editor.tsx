import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import MDEditor from '@uiw/react-md-editor';
import { useNoteStore } from '../store/useNoteStore';
import {
  Eye,
  EyeOff,
  Maximize2,
  Minimize2,
  Trash2,
  FileText,
  AlertCircle,
  FileType,
  File,
  Check,
  Loader2,
  ChevronDown,
  ChevronUp,
  Bold,
  Italic,
  Code,
  Link,
  List,
  ListOrdered,
  Quote,
  Minus,
  Heading1,
  Heading2,
  Heading3,
  Strikethrough,
  Type,
} from 'lucide-react';
import { CodeEditor } from './CodeEditor';
import { ConfirmDialog } from './ConfirmDialog';
import { LanguageIcon } from '../utils/languageUtils';

function formatWordCount(chinese: number, english: number): string {
  if (chinese > 0 && english > 0) return `${chinese} 字 · ${english} 词`;
  if (chinese > 0) return `${chinese} 字`;
  if (english > 0) return `${english} 词`;
  return '0 字';
}

// Scroll a textarea so the character at `idx` is centered in view
function scrollTextareaToIndex(ta: HTMLTextAreaElement, idx: number) {
  const lineHeight = parseFloat(getComputedStyle(ta).lineHeight) || 24;
  const lines = ta.value.slice(0, idx).split('\n').length - 1;
  ta.scrollTop = Math.max(0, lines * lineHeight - ta.clientHeight / 3);
}

// Inject <mark> highlights into the markdown preview pane and scroll to first match
function highlightPreviewPane(query: string, container: Element | null) {
  if (!container) return;
  const preview = container.querySelector('.wmde-markdown');
  if (!preview) return;

  // Remove old highlights
  preview.querySelectorAll('mark.editor-search-hl').forEach((m) => {
    const parent = m.parentNode;
    if (parent) {
      parent.replaceChild(document.createTextNode(m.textContent ?? ''), m);
      parent.normalize();
    }
  });

  if (!query) return;

  const lowerQ = query.toLowerCase();
  const walker = document.createTreeWalker(preview, NodeFilter.SHOW_TEXT, {
    acceptNode: (node) => {
      const tag = (node.parentElement?.tagName ?? '').toUpperCase();
      if (['SCRIPT', 'STYLE', 'MARK', 'CODE'].includes(tag)) return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    },
  });

  const textNodes: Text[] = [];
  let n: Node | null;
  while ((n = walker.nextNode())) textNodes.push(n as Text);

  let firstMark: Element | null = null;

  for (const tn of textNodes) {
    const text = tn.textContent ?? '';
    const lower = text.toLowerCase();
    if (!lower.includes(lowerQ)) continue;

    const frag = document.createDocumentFragment();
    let last = 0;
    let pos = lower.indexOf(lowerQ, 0);

    while (pos !== -1) {
      if (pos > last) frag.appendChild(document.createTextNode(text.slice(last, pos)));
      const mark = document.createElement('mark');
      mark.className = 'editor-search-hl';
      mark.textContent = text.slice(pos, pos + query.length);
      frag.appendChild(mark);
      if (!firstMark) firstMark = mark;
      last = pos + query.length;
      pos = lower.indexOf(lowerQ, last);
    }
    if (last < text.length) frag.appendChild(document.createTextNode(text.slice(last)));
    tn.parentNode?.replaceChild(frag, tn);
  }

  firstMark?.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

export function Editor() {
  const {
    sheets,
    selectedSheetId,
    preferences,
    searchQuery,
    updateSheet,
    deleteSheet,
    updatePreferences,
  } = useNoteStore();

  const sheet = sheets.find((s) => s.id === selectedSheetId);
  const [title, setTitle] = useState(sheet?.title ?? '');
  const [content, setContent] = useState(sheet?.content ?? '');
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const titleRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const editorContainerRef = useRef<HTMLDivElement>(null);

  const isMarkdown = sheet?.type === 'markdown';
  const isCode = sheet?.type === 'code';

  // Sync local state when switching sheets
  useEffect(() => {
    setTitle(sheet?.title ?? '');
    setContent(sheet?.content ?? '');
  }, [sheet?.id, sheet?.title, sheet?.content]);

  // Jump to search match when opening a document from search results
  useEffect(() => {
    if (!searchQuery || !sheet) return;

    const jumpToMatch = () => {
      const text = sheet.content;
      const lower = text.toLowerCase();
      const idx = lower.indexOf(searchQuery.toLowerCase());
      if (idx === -1) return;
      const endIdx = idx + searchQuery.length;

      if (isMarkdown) {
        // Highlight in preview pane (if visible)
        highlightPreviewPane(searchQuery, editorContainerRef.current);
        // Select in edit pane
        const ta = editorContainerRef.current?.querySelector(
          '.w-md-editor-text-input'
        ) as HTMLTextAreaElement | null;
        if (ta) {
          ta.setSelectionRange(idx, endIdx);
          scrollTextareaToIndex(ta, idx);
        }
      } else if (!isCode && textareaRef.current) {
        const ta = textareaRef.current;
        ta.setSelectionRange(idx, endIdx);
        scrollTextareaToIndex(ta, idx);
      }
    };

    // Delay slightly so the editor DOM is ready after sheet switch
    const t = setTimeout(jumpToMatch, 200);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sheet?.id, searchQuery]);

  // Clear preview highlights when search is cleared
  useEffect(() => {
    if (!searchQuery) {
      highlightPreviewPane('', editorContainerRef.current);
    }
  }, [searchQuery]);

  // Apply line-height and letter-spacing CSS variables
  useEffect(() => {
    document.documentElement.style.setProperty('--editor-line-height', String(preferences.lineHeight ?? 1.8));
    document.documentElement.style.setProperty('--editor-letter-spacing', `${preferences.letterSpacing ?? 0}px`);
  }, [preferences.lineHeight, preferences.letterSpacing]);

  const flushSave = useCallback((newTitle: string, newContent: string) => {
    if (!selectedSheetId) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
    updateSheet(selectedSheetId, { title: newTitle, content: newContent });
    setSaveStatus('saved');
    savedTimerRef.current = setTimeout(() => setSaveStatus('idle'), 2000);
  }, [selectedSheetId, updateSheet]);

  // Block Cmd/Ctrl+S
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        flushSave(title, content);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [flushSave, title, content]);

  const save = useCallback(
    (newTitle: string, newContent: string) => {
      if (!selectedSheetId) return;
      setSaveStatus('saving');
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
      saveTimerRef.current = setTimeout(() => {
        updateSheet(selectedSheetId, { title: newTitle, content: newContent });
        setSaveStatus('saved');
        savedTimerRef.current = setTimeout(() => setSaveStatus('idle'), 2000);
      }, 600);
    },
    [selectedSheetId, updateSheet]
  );

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTitle = e.target.value;
    setTitle(newTitle);
    save(newTitle, content);
  };

  const handleContentChange = (value: string | undefined) => {
    const newContent = value ?? '';
    setContent(newContent);
    save(title, newContent);
  };

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newContent = e.target.value;
    setContent(newContent);
    save(title, newContent);
  };

  // Typewriter mode: keep cursor line centered in textarea
  const handleTextareaKeyUp = useCallback(() => {
    if (!preferences.typewriterMode || !textareaRef.current) return;
    const ta = textareaRef.current;
    const lineHeight = parseInt(getComputedStyle(ta).lineHeight) || 28;
    const lines = ta.value.slice(0, ta.selectionStart).split('\n').length;
    const cursorY = lines * lineHeight;
    const targetScroll = cursorY - ta.clientHeight / 2;
    ta.scrollTop = Math.max(0, targetScroll);
  }, [preferences.typewriterMode]);

  // Insert markdown formatting at cursor
  const insertMarkdown = useCallback((before: string, after: string = '', placeholder = '') => {
    const ta = editorContainerRef.current?.querySelector('.w-md-editor-text-input') as HTMLTextAreaElement
      ?? textareaRef.current;
    if (!ta) return;
    const start = ta.selectionStart ?? 0;
    const end = ta.selectionEnd ?? 0;
    const selected = ta.value.slice(start, end) || placeholder;
    const newContent = ta.value.slice(0, start) + before + selected + after + ta.value.slice(end);
    handleContentChange(newContent);
    requestAnimationFrame(() => {
      ta.focus();
      const newCursor = start + before.length + selected.length;
      ta.setSelectionRange(
        start + before.length,
        newCursor
      );
    });
  }, [handleContentChange]);

  const togglePreview = () => updatePreferences({ showPreview: !preferences.showPreview });
  const toggleFocusMode = () => updatePreferences({ focusMode: !preferences.focusMode });
  const toggleFullscreen = () => updatePreferences({ fullscreen: !preferences.fullscreen });
  const toggleFormattingBar = () => updatePreferences({ formattingBarCollapsed: !preferences.formattingBarCollapsed });

  const handleDelete = () => {
    if (!selectedSheetId) return;
    setShowDeleteConfirm(true);
  };

  // Live word count from current content (no save needed)
  const liveWordCount = useMemo(() => {
    const cleaned = content.replace(/[#*`~\[\]()>|\\]/g, '').trim();
    if (!cleaned) return { chinese: 0, english: 0 };
    const chinese = (cleaned.match(/[\u4e00-\u9fff\u3400-\u4dbf]/g) || []).length;
    const withoutChinese = cleaned.replace(/[\u4e00-\u9fff\u3400-\u4dbf]/g, ' ');
    const english = withoutChinese.split(/\s+/).filter((w: string) => /[a-zA-Z0-9]/.test(w)).length;
    return { chinese, english };
  }, [content]);

  const typeIcon = useMemo(() => {
    if (!sheet) return null;
    switch (sheet.type) {
      case 'code': return <LanguageIcon language={sheet.language} size={16} />;
      case 'markdown': return <FileType size={14} />;
      default: return <File size={14} />;
    }
  }, [sheet]);

  if (!sheet) {
    return (
      <div className="editor-empty">
        <div className="empty-icon">
          <FileText size={48} />
        </div>
        <h2>Ulysses Note</h2>
        <p>选择一个文稿开始编辑，或创建一个新文稿</p>
        <button
          className="primary-btn"
          onClick={() => useNoteStore.getState().createSheet()}
        >
          新建文稿
        </button>
      </div>
    );
  }

  const isDark = preferences.theme === 'dark';
  const showFormattingBar = isMarkdown && !preferences.formattingBarCollapsed;
  const chineseCount = liveWordCount.chinese;
  const englishCount = liveWordCount.english;

  return (
    <div
      className={`editor-container${preferences.focusMode ? ' focus-mode' : ''}${preferences.fullscreen ? ' fullscreen-editor' : ''}${preferences.typewriterMode ? ' typewriter-mode' : ''}`}
      ref={editorContainerRef}
    >
      {/* Info toolbar */}
      <div className="editor-toolbar">
        <div className="toolbar-left">
          {typeIcon}
          <span className="toolbar-type-badge">
            {isCode ? sheet.language || '代码' : isMarkdown ? 'Markdown' : '纯文本'}
          </span>
          {preferences.showWordCount && (
            <>
              <span className="toolbar-divider">|</span>
              <span className="toolbar-wordcount">
                {formatWordCount(chineseCount, englishCount)}
              </span>
            </>
          )}
          {saveStatus === 'saving' && (
            <span className="save-status saving">
              <Loader2 size={11} className="save-spin" />
              保存中
            </span>
          )}
          {saveStatus === 'saved' && (
            <span className="save-status saved">
              <Check size={11} />
              已保存
            </span>
          )}
          {preferences.focusMode && (
            <span className="focus-badge">
              <AlertCircle size={12} />
              专注模式
            </span>
          )}
          {preferences.typewriterMode && (
            <span className="focus-badge" style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}>
              <Type size={12} />
              打字机
            </span>
          )}
        </div>
        <div className="toolbar-right">
          {isMarkdown && (
            <button
              className={`toolbar-btn${preferences.formattingBarCollapsed ? '' : ' active'}`}
              onClick={toggleFormattingBar}
              title={preferences.formattingBarCollapsed ? '展开快捷菜单栏' : '收起快捷菜单栏'}
            >
              {preferences.formattingBarCollapsed ? <ChevronDown size={15} /> : <ChevronUp size={15} />}
            </button>
          )}
          {isMarkdown && (
            <button
              className={`toolbar-btn ${preferences.showPreview ? 'active' : ''}`}
              onClick={togglePreview}
              title={preferences.showPreview ? '隐藏预览' : '显示预览'}
            >
              {preferences.showPreview ? <Eye size={16} /> : <EyeOff size={16} />}
            </button>
          )}
          <button
            className={`toolbar-btn ${preferences.focusMode ? 'active' : ''}`}
            onClick={toggleFocusMode}
            title={preferences.focusMode ? '退出专注模式' : '专注模式'}
          >
            {preferences.focusMode ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
          </button>
          <button
            className={`toolbar-btn ${preferences.fullscreen ? 'active' : ''}`}
            onClick={toggleFullscreen}
            title={preferences.fullscreen ? '退出全屏 (Esc)' : '全屏模式'}
          >
            {preferences.fullscreen
              ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3"/></svg>
              : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/></svg>
            }
          </button>
          <button
            className="toolbar-btn danger"
            onClick={handleDelete}
            title="删除文稿"
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>

      {/* Formatting toolbar (markdown only) */}
      {showFormattingBar && (
        <div className="formatting-bar">
          <button className="fmt-btn" onClick={() => insertMarkdown('**', '**', '加粗文字')} title="加粗 (⌘B)"><Bold size={14} /></button>
          <button className="fmt-btn" onClick={() => insertMarkdown('*', '*', '斜体文字')} title="斜体 (⌘I)"><Italic size={14} /></button>
          <button className="fmt-btn" onClick={() => insertMarkdown('~~', '~~', '删除文字')} title="删除线"><Strikethrough size={14} /></button>
          <div className="fmt-divider" />
          <button className="fmt-btn" onClick={() => insertMarkdown('# ', '', '标题')} title="一级标题"><Heading1 size={14} /></button>
          <button className="fmt-btn" onClick={() => insertMarkdown('## ', '', '标题')} title="二级标题"><Heading2 size={14} /></button>
          <button className="fmt-btn" onClick={() => insertMarkdown('### ', '', '标题')} title="三级标题"><Heading3 size={14} /></button>
          <div className="fmt-divider" />
          <button className="fmt-btn" onClick={() => insertMarkdown('`', '`', '代码')} title="行内代码"><Code size={14} /></button>
          <button className="fmt-btn" onClick={() => insertMarkdown('\n```\n', '\n```\n', '代码块')} title="代码块">
            <span className="fmt-text">```</span>
          </button>
          <button className="fmt-btn" onClick={() => insertMarkdown('[', '](url)', '链接文字')} title="插入链接 (⌘K)"><Link size={14} /></button>
          <div className="fmt-divider" />
          <button className="fmt-btn" onClick={() => insertMarkdown('> ', '', '引用内容')} title="引用"><Quote size={14} /></button>
          <button className="fmt-btn" onClick={() => insertMarkdown('- ', '', '列表项')} title="无序列表"><List size={14} /></button>
          <button className="fmt-btn" onClick={() => insertMarkdown('1. ', '', '列表项')} title="有序列表"><ListOrdered size={14} /></button>
          <button className="fmt-btn" onClick={() => insertMarkdown('\n---\n', '')} title="分割线"><Minus size={14} /></button>
        </div>
      )}

      {/* Title */}
      <div className="editor-title-area">
        <input
          ref={titleRef}
          type="text"
          className="editor-title-input"
          placeholder="无标题文稿"
          value={title}
          onChange={handleTitleChange}
        />
      </div>

      {/* Editor body */}
      {isMarkdown ? (
        <div className="editor-content" data-color-mode={isDark ? 'dark' : 'light'}>
          <MDEditor
            value={content}
            onChange={handleContentChange}
            preview={preferences.showPreview ? 'live' : 'edit'}
            height="100%"
            visibleDragbar={false}
            highlightEnable={true}
            textareaProps={{
              placeholder: '开始写作...',
            }}
          />
        </div>
      ) : isCode ? (
        <div className="editor-content-code">
          <CodeEditor
            value={content}
            onChange={handleContentChange}
            language={sheet.language}
            isDark={isDark}
            fontSize={preferences.editorFontSize - 2}
          />
        </div>
      ) : (
        <div className="editor-content-plain">
          <textarea
            ref={textareaRef}
            className="editor-textarea"
            placeholder="开始写作..."
            value={content}
            onChange={handleTextareaChange}
            onKeyUp={handleTextareaKeyUp}
            spellCheck
          />
        </div>
      )}

      {showDeleteConfirm && (
        <ConfirmDialog
          title="删除文稿"
          message={`确定要删除「${sheet.title || '未命名文稿'}」吗？此操作不可恢复。`}
          confirmText="删除"
          danger
          onConfirm={() => { setShowDeleteConfirm(false); deleteSheet(selectedSheetId!); }}
          onCancel={() => setShowDeleteConfirm(false)}
        />
      )}
    </div>
  );
}
