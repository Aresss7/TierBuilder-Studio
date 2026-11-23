import React, { useMemo, useRef, useState } from 'react';
import {
  Copy,
  Download,
  FileArchive,
  FileJson,
  FolderOpen,
  Layers,
  MoreVertical,
  Pencil,
  Plus,
  Search,
  Sun,
  Moon,
  Trash2,
  Upload,
} from 'lucide-react';
import { createProjectFromTemplate, createUid } from '../core/defaults';
import {
  exportProjectJsonBackup,
  exportProjectTierlistFile,
  importProjectFromFile,
} from '../core/projectIO';
import type { ProjectSummary, TierProject, TierTemplate } from '../core/types';
import type { StorageBridge } from '../storage';
import { ConfirmDialog } from './ConfirmDialog';
import { ContextMenu, ContextMenuItem } from './ContextMenu';
import { NewProjectModal, TextPromptModal } from './Modals';

interface HomeViewProps {
  bridge: StorageBridge;
  projects: ProjectSummary[];
  templates: TierTemplate[];
  loading: boolean;
  darkMode: boolean;
  onToggleTheme: () => void;
  onRefresh: () => Promise<void>;
  onOpenProject: (projectId: string) => void;
  onNotify: (msg: string) => void;
}

function formatDateRu(iso: string): string {
  try {
    return new Intl.DateTimeFormat('ru-RU', {
      day: 'numeric',
      month: 'short',
    }).format(new Date(iso));
  } catch {
    return '';
  }
}

export const HomeView: React.FC<HomeViewProps> = ({
  bridge,
  projects,
  templates,
  loading,
  darkMode,
  onToggleTheme,
  onRefresh,
  onOpenProject,
  onNotify,
}) => {
  const [activeTab, setActiveTab] = useState<'projects' | 'templates'>('projects');
  const [search, setSearch] = useState('');
  const [newModalOpen, setNewModalOpen] = useState(false);
  const [newModalPreselectedTemplate, setNewModalPreselectedTemplate] =
    useState<TierTemplate | null>(null);
  const [renameTarget, setRenameTarget] = useState<{
    type: 'project' | 'template';
    id: string;
    name: string;
  } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{
    type: 'project' | 'template';
    id: string;
    name: string;
  } | null>(null);
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    items: ContextMenuItem[];
  } | null>(null);
  const [isFileDragOver, setIsFileDragOver] = useState(false);
  const importInputRef = useRef<HTMLInputElement>(null);

  const filteredProjects = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return projects;
    return projects.filter((p) => p.name.toLowerCase().includes(q));
  }, [projects, search]);

  const filteredTemplates = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return templates;
    return templates.filter((t) => t.name.toLowerCase().includes(q));
  }, [templates, search]);

  const handleCreateProject = async (name: string, template: TierTemplate) => {
    try {
      const proj = createProjectFromTemplate(name, template);
      await bridge.saveProject(proj);
      setNewModalOpen(false);
      setNewModalPreselectedTemplate(null);
      await onRefresh();
      onOpenProject(proj.id);
    } catch (err) {
      onNotify(`Не удалось создать проект: ${(err as Error).message}`);
    }
  };

  const handleDuplicateProject = async (summary: ProjectSummary) => {
    try {
      const newId = createUid('proj');
      await bridge.duplicateProject(summary.id, newId, `${summary.name} (копия)`);
      await onRefresh();
      onNotify('Создана копия проекта');
    } catch (err) {
      onNotify(`Ошибка дублирования: ${(err as Error).message}`);
    }
  };

  const handleExportPackage = async (
    summary: ProjectSummary,
    kind: 'tierlist' | 'json'
  ) => {
    try {
      const project: TierProject = await bridge.loadProject(summary.id);
      if (kind === 'tierlist') {
        const ok = await exportProjectTierlistFile(bridge, project);
        if (ok) onNotify('Пакет .tierlist сохранён');
      } else {
        const ok = await exportProjectJsonBackup(bridge, project);
        if (ok) onNotify('Резервная копия .json сохранена');
      }
    } catch (err) {
      onNotify(`Ошибка экспорта: ${(err as Error).message}`);
    }
  };

  const handleImportFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    for (const file of Array.from(files)) {
      try {
        const imported = await importProjectFromFile(bridge, file);
        await onRefresh();
        onNotify(`Проект «${imported.name}» импортирован`);
      } catch (err) {
        onNotify(`Ошибка импорта: ${(err as Error).message}`);
      }
    }
  };

  const openProjectContextMenu = (
    x: number,
    y: number,
    project: ProjectSummary
  ) => {
    setContextMenu({
      x,
      y,
      items: [
        {
          id: 'open',
          label: 'Открыть в редакторе',
          icon: <FolderOpen className="h-3.5 w-3.5" />,
          onSelect: () => onOpenProject(project.id),
        },
        {
          id: 'rename',
          label: 'Переименовать',
          icon: <Pencil className="h-3.5 w-3.5" />,
          onSelect: () =>
            setRenameTarget({ type: 'project', id: project.id, name: project.name }),
        },
        {
          id: 'duplicate',
          label: 'Создать копию',
          icon: <Copy className="h-3.5 w-3.5" />,
          onSelect: () => handleDuplicateProject(project),
        },
        {
          id: 'export-tierlist',
          label: 'Экспорт пакета (.tierlist)',
          icon: <FileArchive className="h-3.5 w-3.5" />,
          dividerBefore: true,
          onSelect: () => handleExportPackage(project, 'tierlist'),
        },
        {
          id: 'export-json',
          label: 'Резервная копия (.json)',
          icon: <FileJson className="h-3.5 w-3.5" />,
          onSelect: () => handleExportPackage(project, 'json'),
        },
        {
          id: 'delete',
          label: 'Удалить проект',
          icon: <Trash2 className="h-3.5 w-3.5" />,
          danger: true,
          dividerBefore: true,
          onSelect: () =>
            setDeleteTarget({ type: 'project', id: project.id, name: project.name }),
        },
      ],
    });
  };

  return (
    <div
      onDragOver={(e) => {
        if (e.dataTransfer.types.includes('Files')) {
          e.preventDefault();
          setIsFileDragOver(true);
        }
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) {
          setIsFileDragOver(false);
        }
      }}
      onDrop={(e) => {
        setIsFileDragOver(false);
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
          e.preventDefault();
          handleImportFiles(e.dataTransfer.files);
        }
      }}
      className={`min-h-screen bg-[#F4F6F9] dark:bg-[#0F1115] text-slate-900 dark:text-slate-100 flex flex-col transition-colors ${
        isFileDragOver ? 'ring-4 ring-inset ring-[#4F6BED]/50' : ''
      }`}
    >
      {/* Top Bar Contract: 3 zones */}
      <header className="sticky top-0 z-30 border-b border-slate-200 dark:border-[#272B36] bg-white/95 dark:bg-[#161920]/95 backdrop-blur-sm">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-8 px-6 py-3.5">
          {/* Zone 1: Single-line Brand Wordmark */}
          <span className="font-display text-lg font-bold tracking-tight whitespace-nowrap shrink-0">
            TierBuilder Studio
          </span>

          {/* Zone 2: Clean Typography Nav Links */}
          <nav className="flex items-center gap-6 text-sm font-medium">
            <button
              type="button"
              onClick={() => setActiveTab('projects')}
              className={`whitespace-nowrap shrink-0 pb-0.5 transition-colors border-b-2 ${
                activeTab === 'projects'
                  ? 'border-[#4F6BED] text-slate-900 dark:text-slate-100'
                  : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              Проекты
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('templates')}
              className={`whitespace-nowrap shrink-0 pb-0.5 transition-colors border-b-2 ${
                activeTab === 'templates'
                  ? 'border-[#4F6BED] text-slate-900 dark:text-slate-100'
                  : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              Шаблоны
            </button>
          </nav>

          {/* Zone 3: 1 Primary Action */}
          <button
            type="button"
            onClick={() => {
              setNewModalPreselectedTemplate(null);
              setNewModalOpen(true);
            }}
            className="flex items-center gap-2 rounded-lg bg-[#4F6BED] px-4 py-2 text-xs font-semibold text-white hover:bg-[#435CD9] transition-colors whitespace-nowrap shrink-0"
          >
            <Plus className="h-4 w-4" />
            <span>Новый тир-лист</span>
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto w-full max-w-7xl flex-1 px-6 py-8">
        {/* Workspace Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="font-display text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
              {activeTab === 'projects' ? 'Локальные проекты' : 'Шаблоны оформления'}
            </h1>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              {activeTab === 'projects'
                ? 'Все тир-листы и изображения хранятся локально на вашем компьютере.'
                : 'Переиспользуемые схемы тиров, цветов, отступов и настроек подписей.'}
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Поиск..."
                className="w-52 rounded-lg border border-slate-200 dark:border-[#272B36] bg-white dark:bg-[#161920] pl-8 pr-3 py-1.5 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#4F6BED]"
              />
            </div>

            <input
              ref={importInputRef}
              type="file"
              accept=".tierlist,.json"
              className="hidden"
              onChange={(e) => {
                handleImportFiles(e.target.files);
                e.target.value = '';
              }}
            />

            <button
              type="button"
              onClick={() => importInputRef.current?.click()}
              className="flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-[#272B36] bg-white dark:bg-[#161920] px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-[#1E222B] transition-colors whitespace-nowrap"
            >
              <Upload className="h-3.5 w-3.5" />
              <span>Импорт (.tierlist / .json)</span>
            </button>

            <button
              type="button"
              onClick={onToggleTheme}
              title={darkMode ? 'Светлая тема' : 'Тёмная тема'}
              className="rounded-lg border border-slate-200 dark:border-[#272B36] bg-white dark:bg-[#161920] p-2 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-[#1E222B] transition-colors"
              aria-label="Переключить тему"
            >
              {darkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {/* Projects Grid */}
        {activeTab === 'projects' && (
          <>
            {loading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                {[1, 2, 3, 4].map((idx) => (
                  <div
                    key={idx}
                    className="h-60 rounded-xl border border-slate-200 dark:border-[#272B36] bg-white dark:bg-[#161920] animate-pulse"
                  />
                ))}
              </div>
            ) : filteredProjects.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 dark:border-[#272B36] bg-white/50 dark:bg-[#161920]/50 py-16 px-6 text-center">
                <Layers className="h-10 w-10 text-slate-400 mb-3" />
                <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                  {search ? 'Проекты не найдены' : 'Пока нет созданных тир-листов'}
                </h3>
                <p className="mt-1 max-w-md text-xs text-slate-500 dark:text-slate-400">
                  {search
                    ? 'Попробуйте изменить поисковый запрос.'
                    : 'Создайте новый проект с нуля, выберите готовый шаблон или перетащите сюда файл .tierlist / .json.'}
                </p>
                {!search && (
                  <button
                    type="button"
                    onClick={() => setNewModalOpen(true)}
                    className="mt-4 flex items-center gap-2 rounded-lg bg-[#4F6BED] px-4 py-2 text-xs font-semibold text-white hover:bg-[#435CD9]"
                  >
                    <Plus className="h-4 w-4" />
                    <span>Создать первый тир-лист</span>
                  </button>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                {filteredProjects.map((project) => (
                  <div
                    key={project.id}
                    onClick={() => onOpenProject(project.id)}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      openProjectContextMenu(e.clientX, e.clientY, project);
                    }}
                    className="group relative flex flex-col overflow-hidden rounded-xl border border-slate-200 dark:border-[#272B36] bg-white dark:bg-[#161920] cursor-pointer hover:border-[#4F6BED]/70 transition-colors"
                  >
                    {/* Thumbnail */}
                    <div className="relative aspect-[16/10] w-full overflow-hidden bg-slate-100 dark:bg-[#0B0D11] border-b border-slate-200 dark:border-[#272B36]">
                      {project.hasThumbnail ? (
                        <img
                          src={bridge.getProjectThumbnailUrl(project.id, project.updatedAt)}
                          alt={project.name}
                          referrerPolicy="no-referrer"
                          className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-[1.02]"
                        />
                      ) : (
                        <div className="flex h-full w-full flex-col items-center justify-center gap-1.5 px-4 text-slate-400">
                          <div className="flex gap-1">
                            {['#E55353', '#F08C4B', '#EAC54F', '#66C266', '#5B8DEF'].map(
                              (c) => (
                                <span
                                  key={c}
                                  style={{ backgroundColor: c }}
                                  className="h-3 w-5 rounded-sm opacity-80"
                                />
                              )
                            )}
                          </div>
                          <span className="text-[11px] text-slate-500">
                            Откройте для предпросмотра
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Info */}
                    <div className="flex items-start justify-between gap-2 p-3.5">
                      <div className="min-w-0">
                        <h3 className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
                          {project.name}
                        </h3>
                        <div className="mt-1 flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                          <span>{project.tierCount} тиров</span>
                          <span aria-hidden="true">·</span>
                          <span>{project.itemCount} фото</span>
                          <span aria-hidden="true">·</span>
                          <span>{formatDateRu(project.updatedAt)}</span>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          const rect = e.currentTarget.getBoundingClientRect();
                          openProjectContextMenu(rect.left, rect.bottom + 4, project);
                        }}
                        className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-[#1E222B] hover:text-slate-800 dark:hover:text-slate-100 transition-colors shrink-0"
                        aria-label="Действия с проектом"
                      >
                        <MoreVertical className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* Templates Tab */}
        {activeTab === 'templates' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredTemplates.map((tpl) => (
              <div
                key={tpl.id}
                className="flex flex-col justify-between rounded-xl border border-slate-200 dark:border-[#272B36] bg-white dark:bg-[#161920] p-4"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
                      {tpl.name}
                    </h3>
                    {!tpl.isBuiltIn && (
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() =>
                            setRenameTarget({
                              type: 'template',
                              id: tpl.id,
                              name: tpl.name,
                            })
                          }
                          title="Переименовать шаблон"
                          className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-[#1E222B] hover:text-slate-800 dark:hover:text-slate-200"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setDeleteTarget({
                              type: 'template',
                              id: tpl.id,
                              name: tpl.name,
                            })
                          }
                          title="Удалить шаблон"
                          className="rounded-md p-1.5 text-slate-400 hover:bg-red-500/10 hover:text-red-500"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="mt-1 text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                    {tpl.tiers.length} тиров · карточки {tpl.appearance.defaultCardWidth}×
                    {tpl.appearance.defaultCardHeight}px
                  </div>

                  <div className="mt-3 space-y-1">
                    {tpl.tiers.slice(0, 5).map((row) => (
                      <div
                        key={row.id}
                        className="flex items-center gap-2 rounded border border-slate-200 dark:border-[#272B36] bg-slate-50 dark:bg-[#0F1115] overflow-hidden"
                      >
                        <div
                          style={{ backgroundColor: row.bgColor, color: row.titleColor }}
                          className="w-16 shrink-0 py-1 px-2 text-center text-xs font-bold truncate"
                        >
                          {row.title}
                        </div>
                        <span className="truncate pr-2 text-[11px] text-slate-500 dark:text-slate-400">
                          {row.description || 'Без описания'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setNewModalPreselectedTemplate(tpl);
                    setNewModalOpen(true);
                  }}
                  className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg border border-slate-200 dark:border-[#272B36] bg-slate-50 dark:bg-[#1E222B] py-2 text-xs font-medium text-slate-800 dark:text-slate-100 hover:border-[#4F6BED] transition-colors"
                >
                  <Download className="h-3.5 w-3.5 rotate-180" />
                  <span>Создать проект по шаблону</span>
                </button>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Modals & Context Menu */}
      <NewProjectModal
        open={newModalOpen}
        templates={
          newModalPreselectedTemplate
            ? [
                newModalPreselectedTemplate,
                ...templates.filter((t) => t.id !== newModalPreselectedTemplate.id),
              ]
            : templates
        }
        onCreate={handleCreateProject}
        onClose={() => {
          setNewModalOpen(false);
          setNewModalPreselectedTemplate(null);
        }}
      />

      <TextPromptModal
        open={renameTarget !== null}
        title={
          renameTarget?.type === 'project'
            ? 'Переименовать проект'
            : 'Переименовать шаблон'
        }
        label="Новое название"
        initialValue={renameTarget?.name ?? ''}
        submitLabel="Сохранить"
        onSubmit={async (newName) => {
          if (!renameTarget) return;
          try {
            if (renameTarget.type === 'project') {
              const proj = await bridge.loadProject(renameTarget.id);
              await bridge.saveProject({
                ...proj,
                name: newName,
                updatedAt: new Date().toISOString(),
              });
            } else {
              const tpl = templates.find((t) => t.id === renameTarget.id);
              if (tpl) {
                await bridge.saveTemplate({ ...tpl, name: newName });
              }
            }
            setRenameTarget(null);
            await onRefresh();
            onNotify('Название обновлено');
          } catch (err) {
            onNotify(`Ошибка переименования: ${(err as Error).message}`);
          }
        }}
        onClose={() => setRenameTarget(null)}
      />

      <ConfirmDialog
        open={deleteTarget !== null}
        title={
          deleteTarget?.type === 'project'
            ? 'Удалить проект?'
            : 'Удалить шаблон?'
        }
        description={
          deleteTarget?.type === 'project'
            ? `Проект «${deleteTarget?.name}» и все связанные изображения будут удалены безвозвратно.`
            : `Шаблон «${deleteTarget?.name}» будет удалён из библиотеки.`
        }
        confirmLabel="Удалить"
        onConfirm={async () => {
          if (!deleteTarget) return;
          try {
            if (deleteTarget.type === 'project') {
              await bridge.deleteProject(deleteTarget.id);
              onNotify('Проект удалён');
            } else {
              await bridge.deleteTemplate(deleteTarget.id);
              onNotify('Шаблон удалён');
            }
            setDeleteTarget(null);
            await onRefresh();
          } catch (err) {
            onNotify(`Ошибка удаления: ${(err as Error).message}`);
          }
        }}
        onCancel={() => setDeleteTarget(null)}
      />

      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          items={contextMenu.items}
          onClose={() => setContextMenu(null)}
        />
      )}
    </div>
  );
};
