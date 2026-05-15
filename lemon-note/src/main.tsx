import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { initNotePersistence, tryHydrateFromDisk, initialSync, loadNotesFromLocalStorage } from './storage/notePersistence';
import { useNoteStore } from './store/useNoteStore';

async function boot() {
  await initNotePersistence();

  // 1) 优先从本地目录加载（File System API）
  const fromDisk = await tryHydrateFromDisk();
  if (fromDisk) {
    useNoteStore.setState({
      sheets: fromDisk.sheets,
      groups: fromDisk.groups,
      selectedSheetId: fromDisk.sheets[0]?.id ?? null,
    });
  } else {
    // 2) 无本地目录 → 尝试服务端同步（仅在已登录时）
    const token = localStorage.getItem('lemon-token');
    if (token) {
      const synced = await initialSync();
      if (synced) {
        useNoteStore.setState({
          sheets: synced.sheets,
          groups: synced.groups,
          selectedSheetId: synced.sheets[0]?.id ?? null,
        });
      }
    } else {
      // 3) 未登录 → 仅从 localStorage 加载
      const local = loadNotesFromLocalStorage();
      useNoteStore.setState({ sheets: local.sheets, groups: local.groups, selectedSheetId: local.sheets[0]?.id ?? null });
    }
  }

  const el = document.getElementById('root');
  if (!el) {
    console.error('[boot] #root missing');
    return;
  }
  createRoot(el).render(
    <StrictMode>
      <App />
    </StrictMode>
  );
}

void boot().catch((e) => {
  console.error('[boot] failed', e);
  const el = document.getElementById('root');
  if (el) {
    el.textContent = '加载失败，请刷新页面或稍后重试。';
  }
});
