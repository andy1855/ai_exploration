import { useEffect, useState } from 'react';
import { X, Clock, RotateCcw } from 'lucide-react';
import { notesApi } from '../api/notes';
import { useNoteStore } from '../store/useNoteStore';
import { onChangeSync } from '../storage/notePersistence';
import type { SheetVersion } from '../api/notes';

interface Props {
  sheetId: string;
  onClose: () => void;
}

export function VersionHistory({ sheetId, onClose }: Props) {
  const [versions, setVersions] = useState<SheetVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [restoring, setRestoring] = useState<number | null>(null);

  useEffect(() => {
    notesApi.getVersions(sheetId)
      .then((r) => setVersions(r.versions))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [sheetId]);

  const handleRestore = async (v: SheetVersion) => {
    if (!confirm(`确定恢复到 ${new Date(v.created_at).toLocaleString('zh-CN')} 的版本？当前内容将被覆盖。`)) return;
    setRestoring(v.id);
    try {
      const r = await notesApi.restoreVersion(v.id);
      // 更新本地 store
      const { sheets, groups } = useNoteStore.getState();
      const updated = sheets.map((s) =>
        s.id === r.sheetId
          ? { ...s, title: v.title, content: v.content, type: v.type, language: v.language, wordCount: v.word_count, chineseCount: v.chinese_count, englishCount: v.english_count, updatedAt: Date.now() }
          : s
      );
      useNoteStore.setState({ sheets: updated });
      onChangeSync(updated, groups);
      onClose();
    } catch {
      alert('恢复失败');
    } finally {
      setRestoring(null);
    }
  };

  return (
    <div className="modal-overlay modal-overlay--glass" onClick={onClose}>
      <div className="modal-content modal-panel version-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-header-title">
            <Clock size={16} />
            <h3>版本历史</h3>
            <span className="logs-total">最近 {versions.length} 个版本</span>
          </div>
          <button className="icon-btn modal-close-btn" onClick={onClose} aria-label="关闭">
            <X size={18} />
          </button>
        </div>
        <div className="modal-body version-body">
          {loading && <p className="logs-loading">加载中...</p>}
          {!loading && versions.length === 0 && (
            <p className="logs-empty">暂无版本记录。编辑文稿时将自动保存历史版本。</p>
          )}
          {versions.map((v, i) => (
            <div key={v.id} className="version-row">
              <div className="version-info">
                <span className="version-num">v{versions.length - i}</span>
                <span className="version-time">
                  {new Date(v.created_at).toLocaleString('zh-CN')}
                </span>
                <span className="version-meta">
                  {v.word_count} 字
                </span>
              </div>
              <div className="version-title">{v.title || '未命名'}</div>
              <div className="version-actions">
                <button
                  className="settings-action-btn compact"
                  onClick={() => handleRestore(v)}
                  disabled={restoring === v.id}
                  title="恢复到该版本"
                >
                  <RotateCcw size={12} />
                  {restoring === v.id ? '恢复中...' : '恢复'}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
