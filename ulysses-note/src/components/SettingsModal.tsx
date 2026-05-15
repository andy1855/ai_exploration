import { useState } from 'react';
import { X, Sun, Moon, Monitor, Type, Hash, Sliders, Keyboard, Database, AlignJustify, Space } from 'lucide-react';
import { useNoteStore } from '../store/useNoteStore';
import type { ThemeMode } from '../types';

interface Props {
  onClose: () => void;
}

type Tab = 'appearance' | 'style' | 'shortcuts' | 'data';

const FONT_SIZES = [12, 13, 14, 15, 16, 17, 18, 20, 22, 24];

const FONT_FAMILIES: { value: string; label: string; preview: string }[] = [
  { value: 'system', label: '系统默认', preview: 'system-ui, -apple-system, sans-serif' },
  { value: 'serif', label: '衬线体', preview: 'Georgia, "Times New Roman", serif' },
  { value: 'mono', label: '等宽体', preview: '"JetBrains Mono", "Fira Code", Consolas, monospace' },
  { value: 'chinese', label: '中文优先', preview: '"PingFang SC", "Microsoft YaHei", system-ui, sans-serif' },
];

const CSS_FONT_MAP: Record<string, string> = {
  system: 'system-ui, -apple-system, BlinkMacSystemFont, sans-serif',
  serif: 'Georgia, "Times New Roman", serif',
  mono: '"JetBrains Mono", "Fira Code", Consolas, "Courier New", monospace',
  chinese: '"PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", system-ui, sans-serif',
};

const LINE_HEIGHTS = [1.4, 1.6, 1.8, 2.0, 2.2];
const LETTER_SPACINGS = [0, 0.5, 1, 1.5, 2];

const SHORTCUTS = [
  { keys: '⌘ S / Ctrl S', desc: '保存文档' },
  { keys: '⌘ F / Ctrl F', desc: '搜索文稿' },
  { keys: '⌘ B / Ctrl B', desc: '加粗（Markdown）' },
  { keys: '⌘ I / Ctrl I', desc: '斜体（Markdown）' },
  { keys: '⌘ K / Ctrl K', desc: '插入链接（Markdown）' },
  { keys: 'Esc', desc: '退出全屏模式' },
  { keys: '双击分组名', desc: '重命名分组' },
  { keys: '右键文稿/分组', desc: '上下文菜单' },
  { keys: '拖拽文稿', desc: '移动文稿到分组' },
  { keys: '⌘ 点击', desc: '多选文稿（进入批量模式）' },
];

export function SettingsModal({ onClose }: Props) {
  const { preferences, updatePreferences } = useNoteStore();
  const [activeTab, setActiveTab] = useState<Tab>('appearance');

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

  const setFontFamily = (value: string) => {
    updatePreferences({ editorFontFamily: value });
    document.documentElement.style.setProperty('--editor-font-family', CSS_FONT_MAP[value] ?? CSS_FONT_MAP.system);
  };

  const setLineHeight = (lh: number) => {
    updatePreferences({ lineHeight: lh });
    document.documentElement.style.setProperty('--editor-line-height', String(lh));
  };

  const setLetterSpacing = (ls: number) => {
    updatePreferences({ letterSpacing: ls });
    document.documentElement.style.setProperty('--editor-letter-spacing', `${ls}px`);
  };

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'appearance', label: '外观', icon: <Sun size={14} /> },
    { id: 'style', label: '样式', icon: <Type size={14} /> },
    { id: 'shortcuts', label: '快捷键', icon: <Keyboard size={14} /> },
    { id: 'data', label: '数据', icon: <Database size={14} /> },
  ];

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

        {/* Tabs */}
        <div className="settings-tabs">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              className={`settings-tab-btn${activeTab === tab.id ? ' active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.icon}
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        <div className="modal-body settings-body">

          {/* ── Appearance tab ── */}
          {activeTab === 'appearance' && (
            <>
              <section className="settings-section">
                <h4 className="settings-section-title">主题</h4>
                <div className="settings-item">
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

              <section className="settings-section">
                <h4 className="settings-section-title">编辑模式</h4>
                <div className="settings-item settings-item-row">
                  <div className="settings-item-label">
                    <Type size={15} />
                    <span>打字机模式</span>
                    <span className="settings-desc">保持光标行居中</span>
                  </div>
                  <button
                    className={`toggle-btn ${preferences.typewriterMode ? 'on' : 'off'}`}
                    onClick={() => updatePreferences({ typewriterMode: !preferences.typewriterMode })}
                  >
                    <span className="toggle-thumb" />
                  </button>
                </div>
                <div className="settings-item settings-item-row">
                  <div className="settings-item-label">
                    <Hash size={15} />
                    <span>显示字数统计</span>
                  </div>
                  <button
                    className={`toggle-btn ${preferences.showWordCount ? 'on' : 'off'}`}
                    onClick={() => updatePreferences({ showWordCount: !preferences.showWordCount })}
                  >
                    <span className="toggle-thumb" />
                  </button>
                </div>
              </section>
            </>
          )}

          {/* ── Style tab ── */}
          {activeTab === 'style' && (
            <>
              <section className="settings-section">
                <h4 className="settings-section-title">字体</h4>
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

                <div className="settings-item">
                  <div className="settings-item-label">
                    <Type size={15} />
                    <span>字体族</span>
                  </div>
                  <div className="font-family-options">
                    {FONT_FAMILIES.map((f) => (
                      <button
                        key={f.value}
                        className={`font-family-btn ${(preferences.editorFontFamily ?? 'system') === f.value ? 'active' : ''}`}
                        style={{ fontFamily: f.preview }}
                        onClick={() => setFontFamily(f.value)}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>
                </div>
              </section>

              <section className="settings-section">
                <h4 className="settings-section-title">间距</h4>
                <div className="settings-item">
                  <div className="settings-item-label">
                    <AlignJustify size={15} />
                    <span>行间距</span>
                    <span className="settings-value-badge">{preferences.lineHeight ?? 1.8}</span>
                  </div>
                  <div className="spacing-options">
                    {LINE_HEIGHTS.map((lh) => (
                      <button
                        key={lh}
                        className={`spacing-btn ${(preferences.lineHeight ?? 1.8) === lh ? 'active' : ''}`}
                        onClick={() => setLineHeight(lh)}
                      >
                        {lh}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="settings-item">
                  <div className="settings-item-label">
                    <Space size={15} />
                    <span>字间距</span>
                    <span className="settings-value-badge">{preferences.letterSpacing ?? 0}px</span>
                  </div>
                  <div className="spacing-options">
                    {LETTER_SPACINGS.map((ls) => (
                      <button
                        key={ls}
                        className={`spacing-btn ${(preferences.letterSpacing ?? 0) === ls ? 'active' : ''}`}
                        onClick={() => setLetterSpacing(ls)}
                      >
                        {ls === 0 ? '默认' : `${ls}px`}
                      </button>
                    ))}
                  </div>
                </div>
              </section>
            </>
          )}

          {/* ── Shortcuts tab ── */}
          {activeTab === 'shortcuts' && (
            <section className="settings-section">
              <h4 className="settings-section-title">常用快捷键</h4>
              <div className="shortcuts-list">
                {SHORTCUTS.map((s, i) => (
                  <div key={i} className="shortcut-item">
                    <kbd className="shortcut-keys">{s.keys}</kbd>
                    <span className="shortcut-desc">{s.desc}</span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* ── Data tab ── */}
          {activeTab === 'data' && (
            <section className="settings-section">
              <h4 className="settings-section-title">数据管理</h4>
              <div className="settings-item settings-item-row">
                <div className="settings-item-label">
                  <span>导出所有数据</span>
                  <span className="settings-desc">将文稿导出为 JSON 文件</span>
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
          )}

          <div className="settings-footer">
            <span>Ulysses Note v1.1.0 · 数据存储于本地浏览器</span>
          </div>
        </div>
      </div>
    </div>
  );
}
