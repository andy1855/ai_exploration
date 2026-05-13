import { useEffect, useRef, useState, useCallback } from 'react';
import MDEditor from '@uiw/react-md-editor';
import { useNoteStore } from '../store/useNoteStore';
import {
  Sun,
  Moon,
  Eye,
  EyeOff,
  Maximize2,
  Minimize2,
  Trash2,
  FileText,
  Type,
  AlertCircle,
} from 'lucide-react';

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
  const titleRef = useRef<HTMLInputElement>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sync local state when switching sheets
  useEffect(() => {
    setTitle(sheet?.title ?? '');
    setContent(sheet?.content ?? '');
  }, [sheet?.id, sheet?.title, sheet?.content]);

  // Auto-save with debounce
  const save = useCallback(
    (newTitle: string, newContent: string) => {
      if (!selectedSheetId) return;
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => {
        updateSheet(selectedSheetId, { title: newTitle, content: newContent });
      }, 500);
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

  const togglePreview = () => {
    updatePreferences({ showPreview: !preferences.showPreview });
  };

  const toggleFocusMode = () => {
    updatePreferences({ focusMode: !preferences.focusMode });
  };

  const handleDelete = () => {
    if (!selectedSheetId) return;
    if (confirm('确定删除此文稿？')) {
      deleteSheet(selectedSheetId);
    }
  };

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

  return (
    <div className={`editor-container ${preferences.focusMode ? 'focus-mode' : ''}`}>
      {/* Toolbar */}
      <div className="editor-toolbar">
        <div className="toolbar-left">
          <span className="toolbar-wordcount">
            {sheet.wordCount ?? 0} 字
          </span>
          {preferences.focusMode && (
            <span className="focus-badge">
              <AlertCircle size={12} />
              专注模式
            </span>
          )}
        </div>
        <div className="toolbar-right">
          <button
            className={`toolbar-btn ${preferences.showPreview ? 'active' : ''}`}
            onClick={togglePreview}
            title={preferences.showPreview ? '隐藏预览' : '显示预览'}
          >
            {preferences.showPreview ? <Eye size={16} /> : <EyeOff size={16} />}
          </button>
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

      {/* Markdown Editor */}
      <div className="editor-content" data-color-mode={isDark ? 'dark' : 'light'}>
        <MDEditor
          value={content}
          onChange={handleContentChange}
          preview={preferences.showPreview ? 'preview' : 'edit'}
          height="100%"
          visibleDragbar={false}
          highlightEnable={true}
          textareaProps={{
            placeholder: '开始写作...',
          }}
        />
      </div>
    </div>
  );
}
