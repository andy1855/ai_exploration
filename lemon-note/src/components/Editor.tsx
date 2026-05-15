import { useEffect, useLayoutEffect, useRef, useState, useCallback, useMemo } from 'react';
import MDEditor from '@uiw/react-md-editor';
import { LemonLogo } from './LemonLogo';
import { useNoteStore } from '../store/useNoteStore';
import type { EditorViewMode } from '../types';
import {
  Eye,
  EyeOff,
  Trash2,
  FileText,
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
  LayoutTemplate,
  Focus,
  Clock,
} from 'lucide-react';
import { CodeEditor } from './CodeEditor';
import { ConfirmDialog } from './ConfirmDialog';
import { LanguageIcon } from '../utils/languageUtils';
import { escapeRegExp } from '../utils/searchUtils';
import { MarkdownMIcon } from './MarkdownMIcon';
import { VersionHistory } from './VersionHistory';

function formatWordCount(chinese: number, english: number): string {
  if (chinese > 0 && english > 0) return `${chinese} 字 · ${english} 词`;
  if (chinese > 0) return `${chinese} 字`;
  if (english > 0) return `${english} 词`;
  return '0 字';
}

function scrollTextareaToIndex(ta: HTMLTextAreaElement, idx: number) {
  const lh = parseFloat(getComputedStyle(ta).lineHeight) || 24;
  const before = ta.value.slice(0, idx);
  const lineIndex = Math.max(0, before.split('\n').length - 1);
  const cursorMidY = lineIndex * lh + lh / 2;
  ta.scrollTop = Math.max(0, cursorMidY - ta.clientHeight / 2);
}

/** 代码块 / 行内代码 / pre 内的文字不参与正文搜索高亮 */
function inSkippableContext(textNode: Text, boundary: Element): boolean {
  let el: Element | null = textNode.parentElement;
  while (el && el !== boundary) {
    const tag = el.tagName;
    if (tag === 'SCRIPT' || tag === 'STYLE') return true;
    if (tag === 'CODE') return true;
    if (tag === 'PRE') return true;
    const cls = typeof el.className === 'string' ? el.className : '';
    if (/\btoken\.(code|code-block)\b/.test(cls)) return true;
    el = el.parentElement;
  }
  return false;
}

function injectSearchMarksIntoRoot(root: Element, query: string, rejectTextNode: (t: Text) => boolean): Element | null {
  root.querySelectorAll('mark.editor-search-hl').forEach((m) => {
    m.replaceWith(document.createTextNode(m.textContent ?? ''));
  });
  root.normalize();

  const q = query.trim();
  if (!q) return null;

  let re: RegExp;
  try {
    re = new RegExp(escapeRegExp(q), 'gi');
  } catch {
    return null;
  }

  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode: (node) => (rejectTextNode(node as Text) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT),
  });

  const textNodes: Text[] = [];
  let wn: Node | null;
  while ((wn = walker.nextNode())) textNodes.push(wn as Text);

  let firstMark: Element | null = null;
  for (const tn of textNodes) {
    const text = tn.textContent ?? '';
    const matches = [...text.matchAll(re)];
    if (!matches.length) continue;

    const frag = document.createDocumentFragment();
    let last = 0;
    for (const m of matches) {
      const mi = m.index ?? 0;
      if (mi > last) frag.appendChild(document.createTextNode(text.slice(last, mi)));
      const mark = document.createElement('mark');
      mark.className = 'editor-search-hl';
      mark.textContent = m[0];
      frag.appendChild(mark);
      if (!firstMark) firstMark = mark;
      last = mi + m[0].length;
    }
    if (last < text.length) frag.appendChild(document.createTextNode(text.slice(last)));
    tn.parentNode?.replaceChild(frag, tn);
  }
  return firstMark;
}

function findFirstMatchIndex(text: string, needle: string): number {
  const q = needle.trim();
  if (!q) return -1;
  let idx = text.indexOf(q);
  if (idx >= 0) return idx;
  const nt = text.normalize('NFKC').toLowerCase();
  const nq = q.normalize('NFKC').toLowerCase();
  idx = nt.indexOf(nq);
  return idx;
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
  const [showVersionHistory, setShowVersionHistory] = useState(false);
  const titleRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const editorContainerRef = useRef<HTMLDivElement>(null);
  const plainMirrorRef = useRef<HTMLPreElement>(null);
  const searchScrollKeyRef = useRef<string>('');
  const mutationObserverRef = useRef<MutationObserver | null>(null);
  const applyMarksTimerRef = useRef<ReturnType<typeof requestAnimationFrame> | null>(null);

  const isMarkdown = sheet?.type === 'markdown';
  const isCode = sheet?.type === 'code';

  const plainSearchParts = useMemo(() => {
    const q = searchQuery.trim();
    if (!q) return null;
    try {
      return content.split(new RegExp(`(${escapeRegExp(q)})`, 'gi'));
    } catch {
      return null;
    }
  }, [content, searchQuery]);

  const syncPlainMirrorScroll = useCallback(() => {
    const ta = textareaRef.current;
    const m = plainMirrorRef.current;
    if (ta && m) {
      m.scrollTop = ta.scrollTop;
      m.scrollLeft = ta.scrollLeft;
    }
  }, []);

  // Sync local state when switching sheets
  useEffect(() => {
    setTitle(sheet?.title ?? '');
    setContent(sheet?.content ?? '');
  }, [sheet?.id, sheet?.title, sheet?.content]);

  /** 在 Markdown 编辑器的预览区 / 编辑区注入搜索高亮 */
  const applyMarkdownSearchMarks = useCallback(() => {
    const root = editorContainerRef.current;
    if (!root || !isMarkdown) return;
    const q = searchQuery.trim();
    if (!q) return;

    if (preferences.showPreview) {
      const preview = root.querySelector('.wmde-markdown');
      if (preview) {
        injectSearchMarksIntoRoot(preview, q, (t) => inSkippableContext(t, preview));
      }
    }

    const pre = root.querySelector('.w-md-editor-text-pre');
    if (pre) {
      injectSearchMarksIntoRoot(pre as Element, q, (t) => inSkippableContext(t, pre as Element));
    }
  }, [isMarkdown, searchQuery, preferences.showPreview]);

  // Markdown / 预览：注入全部黄色高亮（随正文编辑刷新）
  // 使用 useLayoutEffect 确保在浏览器绘制前注入
  useLayoutEffect(() => {
    if (!sheet || !isMarkdown) return;
    applyMarkdownSearchMarks();
  }, [content, searchQuery, sheet, isMarkdown, preferences.showPreview, applyMarkdownSearchMarks]);

  // 由于 @uiw/react-md-editor 的预览是异步渲染的，会在 useLayoutEffect 之后
  // 重新渲染 DOM，清除掉我们注入的 <mark>。用 MutationObserver 兜底。
  useEffect(() => {
    const root = editorContainerRef.current;
    if (!root || !isMarkdown || !searchQuery.trim()) return;

    // 断开旧的 observer
    if (mutationObserverRef.current) {
      mutationObserverRef.current.disconnect();
    }

    const observer = new MutationObserver(() => {
      // 防抖：500ms 内多次 DOM 变化只做一次
      if (applyMarksTimerRef.current) {
        cancelAnimationFrame(applyMarksTimerRef.current);
      }
      applyMarksTimerRef.current = requestAnimationFrame(() => {
        applyMarkdownSearchMarks();
      });
    });

    observer.observe(root, {
      childList: true,
      subtree: true,
      characterData: false,
    });

    mutationObserverRef.current = observer;

    return () => {
      observer.disconnect();
      if (applyMarksTimerRef.current) {
        cancelAnimationFrame(applyMarksTimerRef.current);
      }
    };
  }, [isMarkdown, searchQuery, sheet?.id, preferences.showPreview, applyMarkdownSearchMarks]);

  // 切换文档或搜索词变化时：滚动到第一处匹配（避免每次输入内容时重滚）
  useLayoutEffect(() => {
    const root = editorContainerRef.current;
    if (!root || !sheet) return;

    const q = searchQuery.trim();
    if (!q) {
      searchScrollKeyRef.current = '';
      return;
    }

    const key = `${sheet.id}\0${q}`;
    if (searchScrollKeyRef.current === key) return;
    searchScrollKeyRef.current = key;

    const run = () => {
      if (isMarkdown) {
        if (preferences.showPreview) {
          const first = root.querySelector('.wmde-markdown mark.editor-search-hl');
          first?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
        const ta = root.querySelector('.w-md-editor-text-input') as HTMLTextAreaElement | null;
        const hasPreviewMark = !!root.querySelector('.wmde-markdown mark.editor-search-hl');
        if (ta && (!preferences.showPreview || !hasPreviewMark)) {
          const idx = findFirstMatchIndex(ta.value, q);
          if (idx >= 0) scrollTextareaToIndex(ta, idx);
        }
      } else if (!isCode && textareaRef.current) {
        const ta = textareaRef.current;
        const idx = findFirstMatchIndex(ta.value, q);
        if (idx >= 0) scrollTextareaToIndex(ta, idx);
      }
    };

    if (isMarkdown) {
      requestAnimationFrame(() => requestAnimationFrame(run));
    } else {
      run();
    }
  }, [sheet?.id, searchQuery, isMarkdown, isCode, preferences.showPreview]);

  // 纯文本：搜索高亮层与 textarea 滚动同步
  useEffect(() => {
    if (!plainSearchParts) return;
    syncPlainMirrorScroll();
  }, [plainSearchParts, content, syncPlainMirrorScroll]);

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

  const applyTypewriterScroll = useCallback((ta: HTMLTextAreaElement) => {
    if (preferences.editorViewMode !== 'typewriter') return;
    const lh = parseFloat(getComputedStyle(ta).lineHeight) || 24;
    const before = ta.value.slice(0, ta.selectionStart);
    const lineIndex = Math.max(0, before.split('\n').length - 1);
    const cursorMidY = lineIndex * lh + lh / 2;
    ta.scrollTop = Math.max(0, cursorMidY - ta.clientHeight / 2);
    const mirror = plainMirrorRef.current;
    if (mirror) mirror.scrollTop = ta.scrollTop;
  }, [preferences.editorViewMode]);

  // Typewriter：切换文档或模式后把光标行滚到中部
  useLayoutEffect(() => {
    if (preferences.editorViewMode !== 'typewriter' || !sheet) return;
    if (isMarkdown) {
      const ta = editorContainerRef.current?.querySelector('.w-md-editor-text-input') as HTMLTextAreaElement | null;
      if (ta) requestAnimationFrame(() => applyTypewriterScroll(ta));
      return;
    }
    if (!isCode && textareaRef.current) {
      requestAnimationFrame(() => applyTypewriterScroll(textareaRef.current!));
    }
  }, [sheet?.id, preferences.editorViewMode, isMarkdown, isCode, applyTypewriterScroll]);

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
      applyTypewriterScroll(ta);
    });
  }, [handleContentChange, applyTypewriterScroll]);

  const togglePreview = () => updatePreferences({ showPreview: !preferences.showPreview });
  const setEditorViewMode = (editorViewMode: EditorViewMode) => updatePreferences({ editorViewMode });
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
      case 'markdown': return <MarkdownMIcon className="toolbar-md-icon" />;
      default: return <File size={14} />;
    }
  }, [sheet]);

  if (!sheet) {
    return (
      <div className="editor-empty">
        <div className="empty-icon">
          <LemonLogo size={56} />
        </div>
        <h2>Lemon Note</h2>
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
  const viewMode = preferences.editorViewMode;

  return (
    <div
      className={`editor-container${viewMode === 'focus' ? ' focus-mode' : ''}${preferences.fullscreen ? ' fullscreen-editor' : ''}${viewMode === 'typewriter' ? ' typewriter-mode' : ''}`}
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
          <button
            className="toolbar-btn"
            onClick={() => setShowVersionHistory(true)}
            title="版本历史"
            style={{ marginLeft: 6 }}
          >
            <Clock size={14} />
          </button>
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
          {viewMode === 'focus' && (
            <span className="focus-badge" title="专注模式：弱化工具栏与边距，突出正文">
              <Focus size={12} />
              专注
            </span>
          )}
          {viewMode === 'typewriter' && (
            <span className="focus-badge focus-badge--muted" title="打字机模式：当前编辑行保持在视区中部">
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
          <div className="editor-mode-switch" title="专注：界面极简；打字机：光标行居中">
            <button
              type="button"
              className={`mode-chip${viewMode === 'default' ? ' active' : ''}`}
              onClick={() => setEditorViewMode('default')}
            >
              <LayoutTemplate size={14} />
              <span>默认</span>
            </button>
            <button
              type="button"
              className={`mode-chip${viewMode === 'focus' ? ' active' : ''}`}
              onClick={() => setEditorViewMode('focus')}
            >
              <Focus size={14} />
              <span>专注</span>
            </button>
            <button
              type="button"
              className={`mode-chip${viewMode === 'typewriter' ? ' active' : ''}`}
              onClick={() => setEditorViewMode('typewriter')}
            >
              <Type size={14} />
              <span>打字机</span>
            </button>
          </div>
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
              onInput: (e) => applyTypewriterScroll(e.currentTarget as HTMLTextAreaElement),
              onKeyUp: (e) => applyTypewriterScroll(e.currentTarget as HTMLTextAreaElement),
              onClick: (e) => applyTypewriterScroll(e.currentTarget as HTMLTextAreaElement),
              onSelect: (e) => applyTypewriterScroll(e.currentTarget as HTMLTextAreaElement),
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
            searchQuery={searchQuery}
          />
        </div>
      ) : (
        <div className="editor-content-plain">
          {plainSearchParts ? (
            <div className="editor-plain-stack">
              <pre
                ref={plainMirrorRef}
                className="editor-plain-mirror"
                aria-hidden
              >
                {plainSearchParts.map((part, i) =>
                  i % 2 === 1 ? (
                    <mark key={i} className="editor-search-hl">{part}</mark>
                  ) : (
                    part
                  )
                )}
              </pre>
              <textarea
                ref={textareaRef}
                className="editor-textarea editor-textarea--search-underlay"
                placeholder="开始写作..."
                value={content}
                onChange={handleTextareaChange}
                onKeyUp={(e) => applyTypewriterScroll(e.currentTarget)}
                onInput={(e) => applyTypewriterScroll(e.currentTarget)}
                onSelect={(e) => applyTypewriterScroll(e.currentTarget)}
                onScroll={syncPlainMirrorScroll}
                spellCheck
              />
            </div>
          ) : (
            <textarea
              ref={textareaRef}
              className="editor-textarea"
              placeholder="开始写作..."
              value={content}
              onChange={handleTextareaChange}
              onKeyUp={(e) => applyTypewriterScroll(e.currentTarget)}
              onInput={(e) => applyTypewriterScroll(e.currentTarget)}
              onSelect={(e) => applyTypewriterScroll(e.currentTarget)}
              spellCheck
            />
          )}
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
      {showVersionHistory && selectedSheetId && (
        <VersionHistory
          sheetId={selectedSheetId}
          onClose={() => setShowVersionHistory(false)}
        />
      )}
    </div>
  );
}
