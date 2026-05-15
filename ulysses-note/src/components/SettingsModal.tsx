import { X, Sun, Moon, Monitor, Type, Hash, Sliders } from 'lucide-react';
import { useNoteStore } from '../store/useNoteStore';
import type { ThemeMode } from '../types';

interface Props {
  onClose: () => void;
}

const FONT_SIZES = [12, 13, 14, 15, 16, 17, 18, 20, 22, 24];

export function SettingsModal({ onClose }: Props) {
  const { preferences, updatePreferences } = useNoteStore();

  const setTheme = (theme: ThemeMode) => {
    updatePreferences({ theme });
    if (theme === 'system') {
      const dark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
    } else {
      document.documentElement.setAttribute('data-theme', theme);
    }
  };

  const setFontSize = (size: number) => {
    updatePreferences({ editorFontSize: size });
    document.documentElement.style.setProperty('--editor-font-size', `${size}px`);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content settings-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-header-title">
            <Sliders size={18} />
            <h3>设置</h3>
          </div>
          <button className="icon-btn" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div className="modal-body settings-body">
          {/* Appearance */}
          <section className="settings-section">
            <h4 className="settings-section-title">外观</h4>

            <div className="settings-item">
              <div className="settings-item-label">
                <Sun size={15} />
                <span>主题</span>
              </div>
              <div className="theme-options">
                <button
                  className={`theme-option-btn ${preferences.theme === 'light' ? 'active' : ''}`}
                  onClick={() => setTheme('light')}
                >
                  <Sun size={14} />
                  <span>浅色</span>
                </button>
                <button
                  className={`theme-option-btn ${preferences.theme === 'dark' ? 'active' : ''}`}
                  onClick={() => setTheme('dark')}
                >
                  <Moon size={14} />
                  <span>深色</span>
                </button>
                <button
                  className={`theme-option-btn ${preferences.theme === 'system' ? 'active' : ''}`}
                  onClick={() => setTheme('system')}
                >
                  <Monitor size={14} />
                  <span>跟随系统</span>
                </button>
              </div>
            </div>
          </section>

          {/* Editor */}
          <section className="settings-section">
            <h4 className="settings-section-title">编辑器</h4>

            <div className="settings-item">
              <div className="settings-item-label">
                <Type size={15} />
                <span>字体大小</span>
                <span className="settings-value-badge">{preferences.editorFontSize}px</span>
              </div>
              <div className="font-size-options">
                {FONT_SIZES.map((size) => (
                  <button
                    key={size}
                    className={`font-size-btn ${preferences.editorFontSize === size ? 'active' : ''}`}
                    onClick={() => setFontSize(size)}
                  >
                    {size}
                  </button>
                ))}
              </div>
            </div>

            <div className="settings-item settings-item-row">
              <div className="settings-item-label">
                <Hash size={15} />
                <span>显示字数统计</span>
              </div>
              <button
                className={`toggle-btn ${preferences.showWordCount ? 'on' : 'off'}`}
                onClick={() => updatePreferences({ showWordCount: !preferences.showWordCount })}
                aria-label="切换字数统计"
              >
                <span className="toggle-thumb" />
              </button>
            </div>
          </section>

          {/* Data */}
          <section className="settings-section">
            <h4 className="settings-section-title">数据</h4>
            <div className="settings-item settings-item-row">
              <div className="settings-item-label">
                <span>导出所有数据</span>
              </div>
              <button
                className="settings-action-btn"
                onClick={() => {
                  const data = {
                    sheets: useNoteStore.getState().sheets,
                    groups: useNoteStore.getState().groups,
                    exportedAt: new Date().toISOString(),
                  };
                  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `ulysses-note-backup-${new Date().toLocaleDateString('zh-CN').replace(/\//g, '-')}.json`;
                  a.click();
                  URL.revokeObjectURL(url);
                }}
              >
                导出 JSON
              </button>
            </div>
          </section>

          <div className="settings-footer">
            <span>Ulysses Note · 数据存储于本地浏览器</span>
          </div>
        </div>
      </div>
    </div>
  );
}
