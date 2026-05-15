import { useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { Editor } from './components/Editor';
import { AuthPage } from './components/AuthModal';
import { useNoteStore } from './store/useNoteStore';
import { useAuthStore } from './store/useAuthStore';
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
  const isLoggedIn = useAuthStore((s) => s.isLoggedIn);

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
    document.documentElement.style.setProperty('--editor-font-size', `${preferences.editorFontSize}px`);
  }, [preferences.editorFontSize]);

  useEffect(() => {
    const fontMap: Record<string, string> = {
      system: 'system-ui, -apple-system, BlinkMacSystemFont, sans-serif',
      serif: 'Georgia, "Times New Roman", serif',
      mono: '"JetBrains Mono", "Fira Code", Consolas, "Courier New", monospace',
      chinese: '"PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", system-ui, sans-serif',
    };
    const family = fontMap[preferences.editorFontFamily ?? 'system'] ?? fontMap.system;
    document.documentElement.style.setProperty('--editor-font-family', family);
  }, [preferences.editorFontFamily]);

  if (!isLoggedIn) return <AuthPage />;

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
