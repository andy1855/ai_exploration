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
} from 'lucide-react';
import { CodeEditor } from './CodeEditor';
import { ConfirmDialog } from './ConfirmDialog';
import { LanguageIcon } from '../utils/languageUtils';

export function Editor() {
  const {
    sheets,
    selectedSheetId,
    preferences,
    updateSheet,
    deleteSheet,
    selectSheet,
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

  // Sync local state when switching sheets
  useEffect(() => {
    setTitle(sheet?.title ?? '');
    setContent(sheet?.content ?? '');
  }, [sheet?.id, sheet?.title, sheet?.content]);

  // Flush save and show status
  const flushSave = useCallback((newTitle: string, newContent: string) => {
    if (!selectedSheetId) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
    updateSheet(selectedSheetId, { title: newTitle, content: newContent });
    setSaveStatus('saved');
    savedTimerRef.current = setTimeout(() => setSaveStatus('idle'), 2000);
  }, [selectedSheetId, updateSheet]);

  // Block Cmd/Ctrl+S to prevent browser save dialog; trigger immediate save instead
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

  // Auto-save with debounce
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

  const togglePreview = () => {
    updatePreferences({ showPreview: !preferences.showPreview });
  };

  const toggleFocusMode = () => {
    updatePreferences({ focusMode: !preferences.focusMode });
  };

  const handleDelete = () => {
    if (!selectedSheetId) return;
    setShowDeleteConfirm(true);
  };

  // Determine sheet type icon
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
  const isMarkdown = sheet.type === 'markdown';
  const isCode = sheet.type === 'code';

  return (
    <div className={`editor-container ${preferences.focusMode ? 'focus-mode' : ''}`} ref={editorContainerRef}>
      {/* Toolbar */}
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
                {sheet.wordCount ?? 0} 字
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
        </div>
        <div className="toolbar-right">
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
            className="toolbar-btn danger"
            onClick={handleDelete}
            title="删除文稿"
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>

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

      {/* Editor body — variant based on sheet type */}
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
