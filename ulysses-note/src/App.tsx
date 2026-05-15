import { useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { Editor } from './components/Editor';
import { useNoteStore } from './store/useNoteStore';
import './styles/global.css';

function applyTheme(theme: string) {
  if (theme === 'system') {
    const dark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
  } else {
    document.documentElement.setAttribute('data-theme', theme);
  }
}

function App() {
  const { preferences } = useNoteStore();

  useEffect(() => {
    applyTheme(preferences.theme);

    if (preferences.theme === 'system') {
      const mq = window.matchMedia('(prefers-color-scheme: dark)');
      const handler = (e: MediaQueryListEvent) => {
        document.documentElement.setAttribute('data-theme', e.matches ? 'dark' : 'light');
      };
      mq.addEventListener('change', handler);
      return () => mq.removeEventListener('change', handler);
    }
  }, [preferences.theme]);

  useEffect(() => {
    document.documentElement.style.setProperty(
      '--editor-font-size',
      `${preferences.editorFontSize}px`
    );
  }, [preferences.editorFontSize]);

  return (
    <div className="app">
      <Sidebar />
      <main className="main-content">
        <Editor />
      </main>
    </div>
  );
}

export default App;
