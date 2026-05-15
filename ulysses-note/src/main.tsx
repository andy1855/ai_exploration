import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { initNotePersistence, tryHydrateFromDisk } from './storage/notePersistence';
import { useNoteStore } from './store/useNoteStore';

async function boot() {
  await initNotePersistence();
  const fromDisk = await tryHydrateFromDisk();
  if (fromDisk) {
    useNoteStore.setState({
      sheets: fromDisk.sheets,
      groups: fromDisk.groups,
      selectedSheetId: fromDisk.sheets[0]?.id ?? null,
    });
  }

  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>
  );
}

void boot();
