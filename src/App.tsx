import { useCallback, useEffect, useState } from 'react';
import { getStorageBridge } from './storage';
import type { ProjectSummary, TierProject, TierTemplate } from './core/types';
import { HomeView } from './components/HomeView';
import { EditorView } from './components/EditorView';

const THEME_STORAGE_KEY = 'tiercraft-theme';

export default function App() {
  const bridge = getStorageBridge();

  const [darkMode, setDarkMode] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem(THEME_STORAGE_KEY);
      return saved ? saved === 'dark' : true; // Studio dark by default
    } catch {
      return true;
    }
  });

  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [templates, setTemplates] = useState<TierTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeProject, setActiveProject] = useState<TierProject | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    const root = document.documentElement;
    if (darkMode) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    try {
      localStorage.setItem(THEME_STORAGE_KEY, darkMode ? 'dark' : 'light');
    } catch {
      // ignore storage quota errors
    }
  }, [darkMode]);

  const notify = useCallback((msg: string) => {
    setToast(msg);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3200);
    return () => clearTimeout(t);
  }, [toast]);

  const refreshData = useCallback(async () => {
    setLoading(true);
    try {
      const [projList, tplList] = await Promise.all([
        bridge.listProjects(),
        bridge.listTemplates(),
      ]);
      setProjects(projList);
      setTemplates(tplList);
    } catch (err) {
      notify(`Ошибка загрузки данных: ${(err as Error).message}`);
    } finally {
      setLoading(false);
    }
  }, [bridge, notify]);

  useEffect(() => {
    void refreshData();
  }, [refreshData]);

  const handleOpenProject = async (projectId: string) => {
    try {
      const loaded = await bridge.loadProject(projectId);
      setActiveProject(loaded);
    } catch (err) {
      notify(`Не удалось открыть проект: ${(err as Error).message}`);
    }
  };

  const handleSaveTemplate = async (tpl: TierTemplate) => {
    const next = await bridge.saveTemplate(tpl);
    setTemplates(next);
  };

  const handleBackHome = async () => {
    setActiveProject(null);
    await refreshData();
  };

  return (
    <>
      {activeProject ? (
        <EditorView
          key={activeProject.id}
          initialProject={activeProject}
          bridge={bridge}
          darkMode={darkMode}
          onToggleTheme={() => setDarkMode((d) => !d)}
          onSaveTemplate={handleSaveTemplate}
          onBackHome={handleBackHome}
          onNotify={notify}
        />
      ) : (
        <HomeView
          bridge={bridge}
          projects={projects}
          templates={templates}
          loading={loading}
          darkMode={darkMode}
          onToggleTheme={() => setDarkMode((d) => !d)}
          onRefresh={refreshData}
          onOpenProject={handleOpenProject}
          onNotify={notify}
        />
      )}

      {/* Subtle Toast Notification */}
      {toast && (
        <div className="fixed bottom-5 right-5 z-50 rounded-lg border border-slate-200 dark:border-[#272B36] bg-white dark:bg-[#1E222B] px-4 py-2.5 text-xs font-medium text-slate-900 dark:text-slate-100 shadow-xl">
          {toast}
        </div>
      )}
    </>
  );
}
