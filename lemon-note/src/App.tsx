import { useEffect, useState } from 'react';
import { Sidebar } from './components/Sidebar';
import { Editor } from './components/Editor';
import { AuthPage, LoginLogsPanel } from './components/AuthModal';
import { LemonLogo } from './components/LemonLogo';
import { AccountPanel } from './components/AccountPanel';
import { SettingsModal } from './components/SettingsModal';
import { GlobalSearchModal } from './components/GlobalSearchModal';
import { useNoteStore } from './store/useNoteStore';
import { useAuthStore } from './store/useAuthStore';
import {
  Sun, Moon, Settings, LogOut, User, Shield, PanelLeftOpen, PanelLeftClose,
} from 'lucide-react';
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
  const { preferences, updatePreferences } = useNoteStore();
  const { isLoggedIn, nickname, target, logout } = useAuthStore();

  const [showSettings, setShowSettings] = useState(false);
  const [showAccount, setShowAccount] = useState(false);
  const [showLogs, setShowLogs] = useState(false);
  const [showGlobalSearch, setShowGlobalSearch] = useState(false);

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
    document.documentElement.style.setProperty('--editor-line-height', String(preferences.lineHeight ?? 1.8));
  }, [preferences.lineHeight]);

  useEffect(() => {
    document.documentElement.style.setProperty('--editor-letter-spacing', `${preferences.letterSpacing ?? 0}px`);
  }, [preferences.letterSpacing]);

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

  // Fullscreen: escape key exits（有弹层时交由弹层处理）
  useEffect(() => {
    if (!preferences.fullscreen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && document.querySelector('.modal-overlay')) return;
      if (e.key === 'Escape') updatePreferences({ fullscreen: false });
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [preferences.fullscreen, updatePreferences]);

  // 全局搜索（⌘/Ctrl + F）
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'f') {
        e.preventDefault();
        setShowGlobalSearch(true);
      }
    };
    window.addEventListener('keydown', handler, true);
    return () => window.removeEventListener('keydown', handler, true);
  }, []);

  if (!isLoggedIn) return <AuthPage />;

  const isDark = preferences.theme === 'dark' ||
    (preferences.theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);

  const toggleTheme = () => {
    const next = isDark ? 'light' : 'dark';
    updatePreferences({ theme: next });
    document.documentElement.setAttribute('data-theme', next);
  };

  const toggleSidebar = () => {
    updatePreferences({ sidebarCollapsed: !preferences.sidebarCollapsed });
  };

  const displayName = nickname || target || '';

  return (
    <div className={`app-wrapper${preferences.fullscreen ? ' app-fullscreen' : ''}`}>
      {/* Top bar */}
      <header className="app-topbar">
        <div className="topbar-left">
          <button className="icon-btn" onClick={toggleSidebar} title={preferences.sidebarCollapsed ? '展开侧边栏' : '收起侧边栏'}>
            {preferences.sidebarCollapsed ? <PanelLeftOpen size={17} /> : <PanelLeftClose size={17} />}
          </button>
          <span className="topbar-brand"><LemonLogo size={20} /> Lemon Note</span>
        </div>
        <div className="topbar-right">
          <button className="icon-btn" onClick={toggleTheme} title={isDark ? '切换亮色' : '切换暗色'}>
            {isDark ? <Sun size={16} /> : <Moon size={16} />}
          </button>
          <button className="icon-btn" onClick={() => setShowLogs(true)} title="登录记录">
            <Shield size={16} />
          </button>
          <button
            type="button"
            className="topbar-user-btn"
            onClick={() => setShowAccount(true)}
            title={displayName ? `账户信息：${displayName}` : '账户信息'}
          >
            <User size={15} className="topbar-user-icon" />
            <span className="topbar-username">{displayName}</span>
          </button>
          <button className="icon-btn" onClick={() => setShowSettings(true)} title="设置">
            <Settings size={16} />
          </button>
          <button className="icon-btn topbar-logout" onClick={logout} title="退出登录">
            <LogOut size={16} />
          </button>
        </div>
      </header>

      {/* Body: sidebar + editor */}
      <div className="app-body">
        <Sidebar />
        <main className="main-content">
          <Editor />
        </main>
      </div>

      {/* Global modals */}
      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}
      {showAccount && <AccountPanel onClose={() => setShowAccount(false)} />}
      {showLogs && <LoginLogsPanel onClose={() => setShowLogs(false)} />}
      {showGlobalSearch && <GlobalSearchModal onClose={() => setShowGlobalSearch(false)} />}
    </div>
  );
}

export default App;
