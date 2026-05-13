import { useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { Editor } from './components/Editor';
import { useNoteStore } from './store/useNoteStore';
import './styles/global.css';

function App() {
  const { preferences } = useNoteStore();

  useEffect(() => {
    // Apply theme on mount
    document.documentElement.setAttribute('data-theme', preferences.theme);
  }, [preferences.theme]);

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
