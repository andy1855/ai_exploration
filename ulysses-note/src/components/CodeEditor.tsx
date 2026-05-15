import { useCallback, useMemo } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { EditorView } from '@codemirror/view';
import { getLanguageExtension } from '../utils/languageUtils';

interface CodeEditorProps {
  value: string;
  onChange: (value: string) => void;
  language: string | null | undefined;
  isDark: boolean;
  fontSize?: number;
}

export function CodeEditor({ value, onChange, language, isDark, fontSize = 14 }: CodeEditorProps) {
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
    ];
  }, [language, fontSize]);

  const handleChange = useCallback((val: string) => {
    onChange(val);
  }, [onChange]);

  return (
    <CodeMirror
      value={value}
      onChange={handleChange}
      extensions={extensions}
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
