import { useCallback, useEffect, useMemo, useRef } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { EditorView, Decoration, DecorationSet, StateEffect, StateField } from '@codemirror/view';
import { getLanguageExtension } from '../utils/languageUtils';
import { escapeRegExp } from '../utils/searchUtils';

interface CodeEditorProps {
  value: string;
  onChange: (value: string) => void;
  language: string | null | undefined;
  isDark: boolean;
  fontSize?: number;
  searchQuery?: string;
}

/** 搜索高亮标记样式 */
const searchHighlightDeco = Decoration.mark({ class: 'editor-search-hl' });

/** 效果：设置搜索高亮 decorations */
const setSearchHighlights = StateEffect.define<DecorationSet>();

/** StateField：根据效果计算 decorations */
const searchHighlightField = StateField.define<DecorationSet>({
  create() {
    return Decoration.none;
  },
  update(deco, tr) {
    for (const e of tr.effects) {
      if (e.is(setSearchHighlights)) {
        return e.value;
      }
    }
    return deco.map(tr.changes);
  },
  provide: (f) => EditorView.decorations.from(f),
});

/** 计算搜索高亮 decorations */
function buildSearchDecorations(doc: string, query: string): DecorationSet {
  if (!query.trim()) return Decoration.none;
  const decos: ReturnType<typeof Decoration.mark>[] = [];
  try {
    const re = new RegExp(escapeRegExp(query), 'gi');
    let match;
    while ((match = re.exec(doc)) !== null) {
      const from = match.index;
      const to = from + match[0].length;
      decos.push(searchHighlightDeco.range(from, to));
    }
  } catch {
    // ignore invalid regex
  }
  return Decoration.set(decos);
}

export function CodeEditor({ value, onChange, language, isDark, fontSize = 14, searchQuery = '' }: CodeEditorProps) {
  const viewRef = useRef<EditorView | null>(null);

  const extensions = useMemo(() => {
    return [
      ...getLanguageExtension(language),
      EditorView.theme({
        '&': {
          height: '100%',
          fontSize: `${fontSize}px`,
        },
        '.cm-scroller': {
          fontFamily: "'JetBrains Mono', 'SF Mono', 'Fira Code', monospace",
          lineHeight: '1.7',
          overflow: 'auto',
        },
        '.cm-content': {
          padding: '20px 24px',
          minHeight: '200px',
        },
        '.cm-gutters': {
          background: 'transparent',
          border: 'none',
          paddingRight: '8px',
        },
        '.cm-lineNumbers .cm-gutterElement': {
          padding: '0 8px 0 4px',
          minWidth: '32px',
          textAlign: 'right',
          color: 'var(--text-muted)',
          fontSize: '12px',
        },
        '.cm-activeLine': {
          backgroundColor: 'transparent',
        },
        '.cm-activeLineGutter': {
          backgroundColor: 'transparent',
        },
        '.cm-focused': {
          outline: 'none',
        },
        '&.cm-focused': {
          outline: 'none',
        },
        '.cm-cursor': {
          borderLeftColor: 'var(--accent)',
        },
        '.cm-selectionBackground': {
          background: 'var(--accent-light) !important',
        },
        '&.cm-focused .cm-selectionBackground': {
          background: 'var(--accent-light) !important',
        },
      }),
      EditorView.lineWrapping,
      searchHighlightField,
    ];
  }, [language, fontSize]);

  // 当 searchQuery 或编辑器内容变化时，重新计算并应用高亮
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const decos = buildSearchDecorations(view.state.doc.toString(), searchQuery ?? '');
    view.dispatch({ effects: setSearchHighlights.of(decos) });
  }, [searchQuery]);

  const handleChange = useCallback((val: string) => {
    onChange(val);
  }, [onChange]);

  // 在首次创建时记录 view 引用；searchQuery 变化由 useEffect 处理
  const handleCreateEditor = useCallback((view: EditorView) => {
    viewRef.current = view;
  }, []);

  return (
    <CodeMirror
      value={value}
      onChange={handleChange}
      extensions={extensions}
      onCreateEditor={handleCreateEditor}
      theme={isDark ? 'dark' : 'light'}
      basicSetup={{
        lineNumbers: true,
        highlightActiveLine: false,
        highlightActiveLineGutter: false,
        foldGutter: false,
        dropCursor: false,
        allowMultipleSelections: false,
        indentOnInput: true,
        bracketMatching: true,
        closeBrackets: true,
        autocompletion: false,
        crosshairCursor: false,
        highlightSelectionMatches: false,
      }}
      style={{ height: '100%' }}
    />
  );
}
