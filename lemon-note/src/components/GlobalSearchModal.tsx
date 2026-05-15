import { useEffect, useMemo, useRef, useState } from 'react';
import { X, Search, File } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useNoteStore } from '../store/useNoteStore';
import type { Sheet } from '../types';
import { textIncludesQuery, escapeRegExp } from '../utils/searchUtils';
import { LanguageIcon } from '../utils/languageUtils';
import { MarkdownMIcon } from './MarkdownMIcon';

interface Props {
  onClose: () => void;
}

function matchSheets(sheets: Sheet[], q: string): Sheet[] {
  const t = q.trim();
  if (!t) return [];
  return sheets.filter(
    (s) => textIncludesQuery(s.title, t) || textIncludesQuery(s.content, t)
  ).sort((a, b) => b.updatedAt - a.updatedAt);
}

function HighlightInline({ text, query }: { text: string; query: string }) {
  const q = query.trim();
  if (!q) return <>{text}</>;
  try {
    const parts = text.split(new RegExp(`(${escapeRegExp(q)})`, 'gi'));
    return (
      <>
        {parts.map((part, i) =>
          i % 2 === 1 ? (
            <mark key={i} className="global-search-hl">{part}</mark>
          ) : (
            <span key={i}>{part}</span>
          )
        )}
      </>
    );
  } catch {
    return <>{text}</>;
  }
}

function previewSnippet(content: string, query: string, maxLen = 1200): string {
  const q = query.trim();
  if (!q) return content.slice(0, maxLen);
  const nc = content.normalize('NFKC');
  const nq = q.normalize('NFKC');
  const idx = nc.toLowerCase().indexOf(nq.toLowerCase());
  if (idx === -1) return content.slice(0, maxLen);
  const start = Math.max(0, idx - 120);
  return (start > 0 ? '…' : '') + nc.slice(start, start + maxLen) + (start + maxLen < nc.length ? '…' : '');
}

function sheetIcon(s: Sheet) {
  if (s.type === 'code') return <LanguageIcon language={s.language} size={14} />;
  if (s.type === 'markdown') return <MarkdownMIcon />;
  return <File size={14} />;
}

export function GlobalSearchModal({ onClose }: Props) {
  const { sheets, selectSheet, setSearchQuery } = useNoteStore();
  const [draft, setDraft] = useState('');
  const [appliedQuery, setAppliedQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const matched = useMemo(() => matchSheets(sheets, appliedQuery), [sheets, appliedQuery]);
  const [activeId, setActiveId] = useState<string | null>(null);

  const active = matched.find((s) => s.id === activeId) ?? matched[0] ?? null;

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!matched.length) {
      setActiveId(null);
      return;
    }
    setActiveId((prev) => (prev && matched.some((s) => s.id === prev) ? prev : matched[0].id));
  }, [matched]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const runSearch = () => {
    setAppliedQuery(draft.trim());
  };

  const openInEditor = (id: string) => {
    const term = appliedQuery.trim();
    if (term) setSearchQuery(term);
    selectSheet(id);
    onClose();
  };

  const snippet = active ? previewSnippet(active.content, appliedQuery) : '';

  return (
    <div className="modal-overlay modal-overlay--glass" onClick={onClose}>
      <div className="modal-content modal-panel global-search-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header global-search-header">
          <div className="global-search-input-wrap">
            <Search size={16} className="global-search-icon" />
            <input
              ref={inputRef}
              className="global-search-input"
              placeholder="输入关键词，按回车搜索…"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  runSearch();
                }
              }}
            />
            {draft && (
              <button type="button" className="global-search-clear" onClick={() => setDraft('')} aria-label="清空">
                <X size={14} />
              </button>
            )}
          </div>
          <button type="button" className="icon-btn modal-close-btn" onClick={onClose} aria-label="关闭">
            <X size={18} />
          </button>
        </div>

        <div className="global-search-body">
          <div className="global-search-list">
            {appliedQuery.trim() && matched.length === 0 && (
              <div className="global-search-empty">没有匹配的文稿</div>
            )}
            {!appliedQuery.trim() && (
              <div className="global-search-hint">输入关键词后按 <kbd className="global-search-kbd">Enter</kbd> 搜索，浏览匹配文稿与预览</div>
            )}
            {matched.map((s) => (
              <button
                key={s.id}
                type="button"
                className={`global-search-row${active?.id === s.id ? ' active' : ''}`}
                onClick={() => setActiveId(s.id)}
                onDoubleClick={() => openInEditor(s.id)}
              >
                <span className="global-search-row-icon">{sheetIcon(s)}</span>
                <span className="global-search-row-title">
                  <HighlightInline text={s.title || '未命名'} query={appliedQuery} />
                </span>
                <span className="global-search-row-meta">{s.type === 'markdown' ? 'MD' : s.type === 'code' ? '代码' : '文本'}</span>
              </button>
            ))}
          </div>

          <div className="global-search-preview">
            {!active && <div className="global-search-preview-empty">选择左侧文稿查看预览</div>}
            {active && (
              <>
                <div className="global-search-preview-head">
                  <span className="global-search-preview-type-icon">{sheetIcon(active)}</span>
                  <span className="global-search-preview-title">
                    <HighlightInline text={active.title || '未命名'} query={appliedQuery} />
                  </span>
                  <button type="button" className="primary-btn compact-btn" onClick={() => openInEditor(active.id)}>
                    打开编辑
                  </button>
                </div>
                <div className="global-search-preview-content">
                  {active.type === 'markdown' ? (
                    <div className="wmde-markdown global-search-md" data-color-mode="inherit">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {snippet.slice(0, 6000)}
                      </ReactMarkdown>
                    </div>
                  ) : (
                    <pre className="global-search-plain">
                      <HighlightInline text={snippet} query={appliedQuery} />
                    </pre>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
