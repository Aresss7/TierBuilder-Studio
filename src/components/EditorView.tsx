import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  BookmarkPlus,
  Check,
  Download,
  Eraser,
  FileArchive,
  FileJson,
  Loader2,
  Moon,
  Plus,
  Redo2,
  SlidersHorizontal,
  Sun,
  Trash2,
  Undo2,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { createUid } from '../core/defaults';
import {
  computeProjectRevision,
  createInitialHistory,
  dispatchHistory,
  HistoryState,
  ProjectAction,
  redoHistory,
  undoHistory,
} from '../core/history';
import {
  generateProjectPreviewThumbnail,
  isSupportedImageFile,
  processImageFile,
  stripExtension,
} from '../core/imageOptimizer';
import {
  exportProjectJsonBackup,
  exportProjectTierlistFile,
} from '../core/projectIO';
import type {
  AssetMeta,
  SaveStatus,
  SelectionTarget,
  TierItem,
  TierProject,
  TierTemplate,
} from '../core/types';
import type { StorageBridge } from '../storage';
import { ConfirmDialog } from './ConfirmDialog';
import { ContextMenu, ContextMenuItem } from './ContextMenu';
import { ExportModal } from './ExportModal';
import { InspectorPanel } from './InspectorPanel';
import { TextPromptModal } from './Modals';
import { TierRowView } from './TierRowView';
import { UnrankedPool } from './UnrankedPool';

interface EditorViewProps {
  initialProject: TierProject;
  bridge: StorageBridge;
  darkMode: boolean;
  onToggleTheme: () => void;
  onSaveTemplate: (template: TierTemplate) => Promise<void>;
  onBackHome: () => Promise<void>;
  onNotify: (msg: string) => void;
}

export const EditorView: React.FC<EditorViewProps> = ({
  initialProject,
  bridge,
  darkMode,
  onToggleTheme,
  onSaveTemplate,
  onBackHome,
  onNotify,
}) => {
  const [history, setHistory] = useState<HistoryState>(() =>
    createInitialHistory(initialProject)
  );
  const project = history.present;

  const [selection, setSelection] = useState<SelectionTarget>({ type: 'appearance' });
  const [inspectorOpen, setInspectorOpen] = useState(true);
  const [zoom, setZoom] = useState(1);
  const [poolCollapsed, setPoolCollapsed] = useState(false);
  const [poolThumbSize, setPoolThumbSize] = useState(86);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('saved');
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [saveTemplateOpen, setSaveTemplateOpen] = useState(false);
  const [confirmState, setConfirmState] = useState<{
    title: string;
    description: string;
    confirmLabel: string;
    secondaryLabel?: string;
    onConfirm: () => void;
    onSecondary?: () => void;
  } | null>(null);
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    items: ContextMenuItem[];
  } | null>(null);

  // Refs for coalesced autosave and guaranteed flush on exit
  const latestProjectRef = useRef<TierProject>(project);
  latestProjectRef.current = project;
  const lastSavedRevisionRef = useRef<string>(computeProjectRevision(initialProject));
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const maxWaitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savingPromiseRef = useRef<Promise<void> | null>(null);

  const dispatchAction = useCallback(
    (
      action: ProjectAction,
      options?: { recordHistory?: boolean; coalesceKey?: string }
    ) => {
      setHistory((prev) => dispatchHistory(prev, action, options));
    },
    []
  );

  const performSaveNow = useCallback(
    async (withThumbnail = false) => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }
      if (maxWaitTimerRef.current) {
        clearTimeout(maxWaitTimerRef.current);
        maxWaitTimerRef.current = null;
      }

      const snapshot = latestProjectRef.current;
      const rev = computeProjectRevision(snapshot);
      if (rev === lastSavedRevisionRef.current && !withThumbnail) {
        setSaveStatus('saved');
        return;
      }

      setSaveStatus('saving');
      const run = (async () => {
        try {
          await bridge.saveProject(snapshot);
          lastSavedRevisionRef.current = rev;
          if (withThumbnail) {
            const thumbBytes = await generateProjectPreviewThumbnail(
              snapshot,
              (assetId) => bridge.getAssetUrl(snapshot.id, assetId, 'thumb')
            );
            if (thumbBytes) {
              await bridge.saveProjectThumbnail(snapshot.id, thumbBytes);
            }
          }
          setSaveStatus('saved');
        } catch {
          setSaveStatus('error');
        }
      })();

      savingPromiseRef.current = run;
      await run;
      savingPromiseRef.current = null;
    },
    [bridge]
  );

  // Coalesced Autosave (800ms trailing + 3000ms maxWait + dirty revision check)
  useEffect(() => {
    const rev = computeProjectRevision(project);
    if (rev === lastSavedRevisionRef.current) {
      setSaveStatus('saved');
      return;
    }

    setSaveStatus('dirty');

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    debounceTimerRef.current = setTimeout(() => {
      void performSaveNow(true);
    }, 800);

    if (!maxWaitTimerRef.current) {
      maxWaitTimerRef.current = setTimeout(() => {
        void performSaveNow(false);
      }, 3000);
    }
  }, [project, performSaveNow]);

  // Guaranteed flush on Electron close & browser beforeunload
  useEffect(() => {
    const unsubscribeElectron = bridge.onFlushBeforeClose(async () => {
      await performSaveNow(true);
    });

    const handleBeforeUnload = () => {
      const rev = computeProjectRevision(latestProjectRef.current);
      if (rev !== lastSavedRevisionRef.current) {
        bridge.beaconFlushProject(latestProjectRef.current);
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('pagehide', handleBeforeUnload);

    return () => {
      unsubscribeElectron();
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('pagehide', handleBeforeUnload);
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      if (maxWaitTimerRef.current) clearTimeout(maxWaitTimerRef.current);
    };
  }, [bridge, performSaveNow]);

  // Generate thumbnail right after opening if none saved yet
  useEffect(() => {
    const timer = setTimeout(() => {
      void generateProjectPreviewThumbnail(
        latestProjectRef.current,
        (assetId) => bridge.getAssetUrl(latestProjectRef.current.id, assetId, 'thumb')
      ).then((bytes) => {
        if (bytes) {
          void bridge.saveProjectThumbnail(latestProjectRef.current.id, bytes);
        }
      });
    }, 500);
    return () => clearTimeout(timer);
  }, [bridge]);

  const handleRequestDeleteTier = useCallback(
    (tierId: string) => {
      const tier = latestProjectRef.current.tiers.find((t) => t.id === tierId);
      if (!tier) return;
      if (tier.itemIds.length === 0) {
        dispatchAction({
          type: 'DELETE_TIER',
          tierId,
          moveItemsToUnranked: true,
        });
        setSelection({ type: 'appearance' });
        return;
      }

      setConfirmState({
        title: `Удалить тир «${tier.title || 'Без названия'}»?`,
        description: `В этом тире находится ${tier.itemIds.length} изображений. Вы можете вернуть их в область нераспределённых или удалить вместе с тиром.`,
        confirmLabel: 'Удалить с фото',
        secondaryLabel: 'Вернуть фото в пул',
        onConfirm: () => {
          dispatchAction({
            type: 'DELETE_TIER',
            tierId,
            moveItemsToUnranked: false,
          });
          setSelection({ type: 'appearance' });
          setConfirmState(null);
        },
        onSecondary: () => {
          dispatchAction({
            type: 'DELETE_TIER',
            tierId,
            moveItemsToUnranked: true,
          });
          setSelection({ type: 'appearance' });
          setConfirmState(null);
        },
      });
    },
    [dispatchAction]
  );

  // Keyboard shortcuts
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isTextInput =
        target &&
        ((target.tagName === 'INPUT' &&
          !['range', 'color', 'checkbox', 'radio', 'button'].includes(
            (target as HTMLInputElement).type
          )) ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable);

      const mod = e.ctrlKey || e.metaKey;
      if (e.key === 'Escape' && !isTextInput) {
        setSelection({ type: 'appearance' });
        return;
      }
      if (mod && e.key.toLowerCase() === 'z' && !e.shiftKey) {
        if (!isTextInput) {
          e.preventDefault();
          setHistory((prev) => undoHistory(prev));
        }
        return;
      }
      if (
        (mod && e.key.toLowerCase() === 'y') ||
        (mod && e.shiftKey && e.key.toLowerCase() === 'z')
      ) {
        if (!isTextInput) {
          e.preventDefault();
          setHistory((prev) => redoHistory(prev));
        }
        return;
      }
      if (mod && e.key.toLowerCase() === 's') {
        e.preventDefault();
        void performSaveNow(true).then(() => onNotify('Проект сохранён'));
        return;
      }
      if (mod && e.key.toLowerCase() === 'e') {
        e.preventDefault();
        setExportModalOpen(true);
        return;
      }
      if (mod && (e.key === '=' || e.key === '+')) {
        e.preventDefault();
        setZoom((z) => Math.min(1.5, Number((z + 0.1).toFixed(2))));
        return;
      }
      if (mod && e.key === '-') {
        e.preventDefault();
        setZoom((z) => Math.max(0.5, Number((z - 0.1).toFixed(2))));
        return;
      }
      if (!isTextInput && (e.key === 'Delete' || e.key === 'Backspace')) {
        if (selection.type === 'item') {
          e.preventDefault();
          dispatchAction({ type: 'DELETE_ITEM', itemId: selection.itemId });
          setSelection({ type: 'appearance' });
        } else if (selection.type === 'tier') {
          e.preventDefault();
          handleRequestDeleteTier(selection.tierId);
        }
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [dispatchAction, handleRequestDeleteTier, onNotify, performSaveNow, selection]);

  const handleUploadFiles = useCallback(
    async (files: FileList, targetTierId?: string | null) => {
      const validFiles = Array.from(files).filter(isSupportedImageFile);
      if (validFiles.length === 0) {
        onNotify('Выберите файлы изображений (PNG, JPEG, WebP, GIF)');
        return;
      }

      const addedEntries: Array<{ item: TierItem; asset: AssetMeta }> = [];
      for (const file of validFiles) {
        try {
          const processed = await processImageFile(file);
          const assetId = createUid('ast');
          const itemId = createUid('itm');

          await bridge.saveAsset(
            project.id,
            assetId,
            processed.mimeType,
            processed.originalBytes,
            processed.thumbnailBytes,
            processed.thumbnailMimeType
          );

          addedEntries.push({
            asset: {
              assetId,
              mimeType: processed.mimeType,
              fileName: processed.fileName,
              width: processed.width,
              height: processed.height,
            },
            item: {
              id: itemId,
              assetId,
              fileName: processed.fileName,
              caption: stripExtension(processed.fileName),
            },
          });
        } catch {
          // Skip broken image file without halting batch
        }
      }

      if (addedEntries.length > 0) {
        dispatchAction({
          type: 'ADD_ITEMS',
          items: addedEntries,
          targetTierId,
        });
        onNotify(`Добавлено изображений: ${addedEntries.length}`);
      }
    },
    [bridge, dispatchAction, onNotify, project.id]
  );

  // Drag & Drop handlers
  const handleDragStartItem = useCallback(
    (e: React.DragEvent, itemId: string, sourceContainer: string) => {
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData(
        'application/x-tiercraft-item',
        JSON.stringify({ itemId, sourceContainer })
      );
    },
    []
  );

  const handleDragEndItem = useCallback(() => {}, []);

  const handleDropItem = useCallback(
    (e: React.DragEvent, targetContainer: string, targetIndex: number) => {
      const raw = e.dataTransfer.getData('application/x-tiercraft-item');
      if (!raw) return;
      try {
        const parsed = JSON.parse(raw) as { itemId: string; sourceContainer: string };
        dispatchAction({
          type: 'MOVE_ITEM',
          itemId: parsed.itemId,
          sourceContainer: parsed.sourceContainer,
          targetContainer,
          targetIndex,
        });
      } catch {
        // ignore invalid dnd payload
      }
    },
    [dispatchAction]
  );

  const handleDragStartTier = useCallback((e: React.DragEvent, index: number) => {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('application/x-tiercraft-tier', String(index));
  }, []);

  const handleDropTierOnRow = useCallback(
    (e: React.DragEvent, targetIndex: number) => {
      const raw = e.dataTransfer.getData('application/x-tiercraft-tier');
      const fromIndex = parseInt(raw, 10);
      if (!Number.isNaN(fromIndex)) {
        dispatchAction({ type: 'REORDER_TIERS', fromIndex, toIndex: targetIndex });
      }
    },
    [dispatchAction]
  );

  const getThumbUrl = useCallback(
    (projId: string, assetId: string) => bridge.getAssetUrl(projId, assetId, 'thumb'),
    [bridge]
  );

  const handleContextMenuTier = useCallback(
    (e: React.MouseEvent, tierId: string) => {
      const tier = project.tiers.find((t) => t.id === tierId);
      const tierIndex = project.tiers.findIndex((t) => t.id === tierId);
      if (!tier) return;

      setContextMenu({
        x: e.clientX,
        y: e.clientY,
        items: [
          {
            id: 'inspect_tier',
            label: 'Настроить тир',
            icon: <SlidersHorizontal className="h-3.5 w-3.5" />,
            onSelect: () => {
              setSelection({ type: 'tier', tierId });
              setInspectorOpen(true);
            },
          },
          {
            id: 'up',
            label: 'Переместить выше',
            icon: <ArrowUp className="h-3.5 w-3.5" />,
            dividerBefore: true,
            disabled: tierIndex <= 0,
            onSelect: () =>
              dispatchAction({ type: 'MOVE_TIER_STEP', tierId, direction: -1 }),
          },
          {
            id: 'down',
            label: 'Переместить ниже',
            icon: <ArrowDown className="h-3.5 w-3.5" />,
            disabled: tierIndex >= project.tiers.length - 1,
            onSelect: () =>
              dispatchAction({ type: 'MOVE_TIER_STEP', tierId, direction: 1 }),
          },
          {
            id: 'clear',
            label: 'Убрать фото в пул',
            icon: <Eraser className="h-3.5 w-3.5" />,
            disabled: tier.itemIds.length === 0,
            dividerBefore: true,
            onSelect: () => dispatchAction({ type: 'CLEAR_TIER', tierId }),
          },
          {
            id: 'delete',
            label: 'Удалить тир',
            icon: <Trash2 className="h-3.5 w-3.5" />,
            danger: true,
            dividerBefore: true,
            onSelect: () => handleRequestDeleteTier(tierId),
          },
        ],
      });
    },
    [dispatchAction, handleRequestDeleteTier, project.tiers]
  );

  const handleContextMenuItem = useCallback(
    (e: React.MouseEvent, itemId: string, containerId: string) => {
      const moveItems: ContextMenuItem[] = project.tiers
        .filter((t) => t.id !== containerId)
        .map((t) => ({
          id: `move_${t.id}`,
          label: `В тир: ${t.title || 'Без названия'}`,
          onSelect: () =>
            dispatchAction({
              type: 'MOVE_ITEM',
              itemId,
              sourceContainer: containerId,
              targetContainer: t.id,
              targetIndex: t.itemIds.length,
            }),
        }));

      if (containerId !== 'unranked') {
        moveItems.push({
          id: 'move_unranked',
          label: 'Вернуть в нераспределённые',
          icon: <Undo2 className="h-3.5 w-3.5" />,
          dividerBefore: moveItems.length > 0,
          onSelect: () =>
            dispatchAction({
              type: 'MOVE_ITEM',
              itemId,
              sourceContainer: containerId,
              targetContainer: 'unranked',
              targetIndex: project.unrankedIds.length,
            }),
        });
      }

      setContextMenu({
        x: e.clientX,
        y: e.clientY,
        items: [
          {
            id: 'inspect_item',
            label: 'Настроить карточку',
            icon: <SlidersHorizontal className="h-3.5 w-3.5" />,
            onSelect: () => {
              setSelection({ type: 'item', itemId });
              setInspectorOpen(true);
            },
          },
          ...moveItems,
          {
            id: 'delete_item',
            label: 'Удалить изображение',
            icon: <Trash2 className="h-3.5 w-3.5" />,
            danger: true,
            dividerBefore: moveItems.length > 0,
            onSelect: () => {
              dispatchAction({ type: 'DELETE_ITEM', itemId });
              if (selection.type === 'item' && selection.itemId === itemId) {
                setSelection({ type: 'appearance' });
              }
            },
          },
        ],
      });
    },
    [dispatchAction, project.tiers, project.unrankedIds.length, selection]
  );

  const handleBackClick = async () => {
    await performSaveNow(true);
    await onBackHome();
  };

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-[#F4F6F9] dark:bg-[#0F1115] text-slate-900 dark:text-slate-100">
      {/* Editor Studio Top Toolbar */}
      <header className="flex h-13 shrink-0 items-center justify-between gap-4 border-b border-slate-200 dark:border-[#272B36] bg-white dark:bg-[#161920] px-4">
        {/* Left: Back + Editable Title + Autosave Status */}
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={handleBackClick}
            className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#1E222B] hover:text-slate-900 dark:hover:text-slate-100 transition-colors shrink-0"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Проекты</span>
          </button>

          <div className="h-4 w-px bg-slate-200 dark:bg-[#272B36]" />

          <input
            type="text"
            value={project.name}
            onChange={(e) =>
              dispatchAction({ type: 'RENAME_PROJECT', name: e.target.value })
            }
            className="w-52 sm:w-64 truncate rounded-md bg-transparent px-2 py-1 font-display text-sm font-semibold text-slate-900 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-[#1E222B] focus:bg-slate-100 dark:focus:bg-[#0F1115] focus:outline-none focus:ring-2 focus:ring-[#4F6BED]"
          />

          <span className="hidden md:inline-flex items-center gap-1 text-[11px] text-slate-400 whitespace-nowrap shrink-0">
            {saveStatus === 'saving' && (
              <>
                <Loader2 className="h-3 w-3 animate-spin" />
                <span>Сохранение...</span>
              </>
            )}
            {saveStatus === 'saved' && (
              <>
                <Check className="h-3 w-3 text-emerald-500" />
                <span>Сохранено</span>
              </>
            )}
            {saveStatus === 'dirty' && <span>Есть изменения</span>}
            {saveStatus === 'error' && (
              <span className="text-red-500">Ошибка сохранения</span>
            )}
          </span>
        </div>

        {/* Center: Undo/Redo + Zoom */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-0.5 rounded-lg border border-slate-200 dark:border-[#272B36] bg-slate-50 dark:bg-[#0F1115] p-0.5">
            <button
              type="button"
              disabled={history.past.length === 0}
              onClick={() => setHistory((prev) => undoHistory(prev))}
              title="Отменить (Ctrl+Z)"
              className="rounded-md p-1.5 text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-[#1E222B] disabled:opacity-35 transition-colors"
            >
              <Undo2 className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              disabled={history.future.length === 0}
              onClick={() => setHistory((prev) => redoHistory(prev))}
              title="Повторить (Ctrl+Y)"
              className="rounded-md p-1.5 text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-[#1E222B] disabled:opacity-35 transition-colors"
            >
              <Redo2 className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="hidden sm:flex items-center gap-0.5 rounded-lg border border-slate-200 dark:border-[#272B36] bg-slate-50 dark:bg-[#0F1115] p-0.5">
            <button
              type="button"
              onClick={() =>
                setZoom((z) => Math.max(0.5, Number((z - 0.1).toFixed(2))))
              }
              title="Уменьшить масштаб"
              className="rounded-md p-1.5 text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-[#1E222B]"
            >
              <ZoomOut className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setZoom(1)}
              title="Сбросить масштаб к 100%"
              className="px-2 py-1 font-mono text-[11px] font-medium tabular-nums text-slate-700 dark:text-slate-200 hover:bg-white dark:hover:bg-[#1E222B] rounded-md"
            >
              {Math.round(zoom * 100)}%
            </button>
            <button
              type="button"
              onClick={() =>
                setZoom((z) => Math.min(1.5, Number((z + 0.1).toFixed(2))))
              }
              title="Увеличить масштаб"
              className="rounded-md p-1.5 text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-[#1E222B]"
            >
              <ZoomIn className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* Right: Package export, Save Template, Theme, Primary Export */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={async () => {
              await performSaveNow(true);
              const ok = await exportProjectTierlistFile(bridge, project);
              if (ok) onNotify('Пакет .tierlist экспортирован');
            }}
            title="Экспорт проекта (.tierlist)"
            className="hidden lg:flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-[#272B36] px-2.5 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#1E222B] transition-colors whitespace-nowrap"
          >
            <FileArchive className="h-3.5 w-3.5" />
            <span>.tierlist</span>
          </button>

          <button
            type="button"
            onClick={async () => {
              await performSaveNow(false);
              const ok = await exportProjectJsonBackup(bridge, project);
              if (ok) onNotify('Резервная копия .json сохранена');
            }}
            title="Резервная копия JSON"
            className="hidden xl:flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-[#272B36] px-2.5 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#1E222B] transition-colors whitespace-nowrap"
          >
            <FileJson className="h-3.5 w-3.5" />
            <span>JSON</span>
          </button>

          <button
            type="button"
            onClick={() => setSaveTemplateOpen(true)}
            title="Сохранить текущее оформление как шаблон"
            className="hidden md:flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-[#272B36] px-2.5 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#1E222B] transition-colors whitespace-nowrap"
          >
            <BookmarkPlus className="h-3.5 w-3.5" />
            <span>В шаблон</span>
          </button>

          <button
            type="button"
            onClick={onToggleTheme}
            title={darkMode ? 'Светлая тема' : 'Тёмная тема'}
            className="rounded-lg border border-slate-200 dark:border-[#272B36] p-1.5 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#1E222B]"
            aria-label="Переключить тему"
          >
            {darkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>

          <button
            type="button"
            onClick={() => setInspectorOpen((open) => !open)}
            title={inspectorOpen ? 'Скрыть панель настроек' : 'Показать панель настроек'}
            className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
              inspectorOpen
                ? 'border-[#4F6BED]/50 bg-[#4F6BED]/10 text-[#4F6BED]'
                : 'border-slate-200 dark:border-[#272B36] text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#1E222B]'
            }`}
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
            <span>Настройки</span>
          </button>

          <button
            type="button"
            onClick={() => setExportModalOpen(true)}
            className="flex items-center gap-1.5 rounded-lg bg-[#4F6BED] px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-[#435CD9] transition-colors whitespace-nowrap"
          >
            <Download className="h-3.5 w-3.5" />
            <span>Экспорт</span>
          </button>
        </div>
      </header>

      {/* Main Studio Area */}
      <div className="flex flex-1 min-h-0">
        {/* Center Column: Canvas + Collapsible Unranked Pool */}
        <div className="flex flex-1 flex-col min-w-0 min-h-0">
          {/* Scrollable Zoomable Canvas */}
          <div
            onClick={() => setSelection({ type: 'appearance' })}
            className="flex-1 overflow-auto p-6"
          >
            <div
              style={
                zoom === 1
                  ? { width: '100%' }
                  : {
                      width: '1120px',
                      transform: `scale(${zoom})`,
                      transformOrigin: 'top center',
                    }
              }
              className="mx-auto transition-transform duration-100"
            >
              {/* Actual Tier List Frame (mirrors Export Canvas 2D geometry) */}
              <div
                style={{
                  backgroundColor: project.appearance.canvasBg,
                  gap: `${project.appearance.tierGap}px`,
                }}
                className="flex w-full flex-col rounded-xl p-6 shadow-xl"
              >
                {project.tiers.map((tier, index) => (
                  <TierRowView
                    key={tier.id}
                    tier={tier}
                    index={index}
                    projectId={project.id}
                    itemsMap={project.items}
                    appearance={project.appearance}
                    selectedTierId={
                      selection.type === 'tier' ? selection.tierId : null
                    }
                    selectedItemId={
                      selection.type === 'item' ? selection.itemId : null
                    }
                    zoom={zoom}
                    getThumbUrl={getThumbUrl}
                    onSelectTier={(tierId) => setSelection({ type: 'tier', tierId })}
                    onSelectItem={(itemId) => setSelection({ type: 'item', itemId })}
                    onUpdateItemCaption={(itemId, caption) =>
                      dispatchAction({
                        type: 'UPDATE_ITEM',
                        itemId,
                        patch: { caption },
                      })
                    }
                    onResizeTierHeight={(tierId, height, commitHistory) =>
                      dispatchAction(
                        {
                          type: 'UPDATE_TIER',
                          tierId,
                          patch: { height },
                        },
                        { recordHistory: commitHistory }
                      )
                    }
                    onContextMenuTier={handleContextMenuTier}
                    onContextMenuItem={handleContextMenuItem}
                    onDragStartItem={handleDragStartItem}
                    onDragEndItem={handleDragEndItem}
                    onDropItemInTier={handleDropItem}
                    onDropExternalFilesInTier={handleUploadFiles}
                    onDragStartTier={handleDragStartTier}
                    onDropTierOnRow={handleDropTierOnRow}
                  />
                ))}

                {project.tiers.length === 0 && (
                  <div className="rounded-lg border border-dashed border-slate-600/60 py-12 text-center text-sm text-slate-400">
                    В тир-листе пока нет тиров. Добавьте первый тир ниже.
                  </div>
                )}
              </div>

              {/* Editor-only Add Tier button (never exported) */}
              <div className="mt-4 flex justify-center">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    dispatchAction({ type: 'ADD_TIER' });
                  }}
                  className="flex items-center gap-1.5 rounded-lg border border-slate-300 dark:border-[#272B36] bg-white dark:bg-[#161920] px-4 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 hover:border-[#4F6BED] transition-colors"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Добавить тир</span>
                </button>
              </div>
            </div>
          </div>

          {/* Collapsible Unranked Images Pool */}
          <UnrankedPool
            projectId={project.id}
            unrankedIds={project.unrankedIds}
            itemsMap={project.items}
            appearance={project.appearance}
            selectedItemId={selection.type === 'item' ? selection.itemId : null}
            collapsed={poolCollapsed}
            poolThumbSize={poolThumbSize}
            getThumbUrl={getThumbUrl}
            onToggleCollapse={() => setPoolCollapsed((c) => !c)}
            onChangePoolThumbSize={setPoolThumbSize}
            onUploadFiles={(files) => handleUploadFiles(files, null)}
            onSelectItem={(itemId) => setSelection({ type: 'item', itemId })}
            onUpdateItemCaption={(itemId, caption) =>
              dispatchAction({ type: 'UPDATE_ITEM', itemId, patch: { caption } })
            }
            onContextMenuItem={handleContextMenuItem}
            onDragStartItem={handleDragStartItem}
            onDragEndItem={handleDragEndItem}
            onDropItemInPool={handleDropItem}
          />
        </div>

        {/* Contextual Right Inspector (closable for full-width presentation) */}
        {inspectorOpen && (
          <InspectorPanel
            project={project}
            selection={selection}
            onClose={() => setInspectorOpen(false)}
            onSelectTab={setSelection}
            onUpdateAppearance={(patch, coalesceKey) =>
              dispatchAction(
                { type: 'UPDATE_APPEARANCE', patch },
                { coalesceKey }
              )
            }
            onResetAppearanceDefaults={() => {
              dispatchAction({ type: 'RESET_APPEARANCE_DEFAULTS' });
              onNotify('Настройки оформления сброшены по умолчанию');
            }}
            onResetAllCustomSizes={() => {
              dispatchAction({ type: 'RESET_ALL_CUSTOM_SIZES' });
              onNotify('Индивидуальные размеры сброшены к общим');
            }}
            onUpdateTier={(tierId, patch, coalesceKey) =>
              dispatchAction(
                { type: 'UPDATE_TIER', tierId, patch },
                { coalesceKey }
              )
            }
            onMoveTierStep={(tierId, direction) =>
              dispatchAction({ type: 'MOVE_TIER_STEP', tierId, direction })
            }
            onClearTier={(tierId) => dispatchAction({ type: 'CLEAR_TIER', tierId })}
            onRequestDeleteTier={handleRequestDeleteTier}
            onUpdateItem={(itemId, patch, coalesceKey) =>
              dispatchAction(
                { type: 'UPDATE_ITEM', itemId, patch },
                { coalesceKey }
              )
            }
            onMoveItemToContainer={(itemId, targetContainer) => {
              const source = project.unrankedIds.includes(itemId)
                ? 'unranked'
                : project.tiers.find((t) => t.itemIds.includes(itemId))?.id ??
                  'unranked';
              const targetIndex =
                targetContainer === 'unranked'
                  ? project.unrankedIds.length
                  : project.tiers.find((t) => t.id === targetContainer)?.itemIds.length ??
                    0;
              dispatchAction({
                type: 'MOVE_ITEM',
                itemId,
                sourceContainer: source,
                targetContainer,
                targetIndex,
              });
            }}
            onDeleteItem={(itemId) => {
              dispatchAction({ type: 'DELETE_ITEM', itemId });
              setSelection({ type: 'appearance' });
            }}
          />
        )}
      </div>

      {/* Export Preview & Save Modal */}
      <ExportModal
        open={exportModalOpen}
        project={project}
        bridge={bridge}
        onClose={() => setExportModalOpen(false)}
        onNotify={onNotify}
      />

      {/* Save Template Modal */}
      <TextPromptModal
        open={saveTemplateOpen}
        title="Сохранить как шаблон оформления"
        label="Название шаблона"
        initialValue={`${project.name} (шаблон)`}
        submitLabel="Сохранить шаблон"
        onSubmit={async (name) => {
          const tpl: TierTemplate = {
            id: createUid('tpl'),
            name,
            createdAt: new Date().toISOString(),
            tiers: project.tiers.map(({ itemIds: _ids, ...rest }) => ({ ...rest })),
            appearance: { ...project.appearance },
          };
          await onSaveTemplate(tpl);
          setSaveTemplateOpen(false);
          onNotify(`Шаблон «${name}» сохранён`);
        }}
        onClose={() => setSaveTemplateOpen(false)}
      />

      {/* Confirmation Dialog */}
      <ConfirmDialog
        open={confirmState !== null}
        title={confirmState?.title ?? ''}
        description={confirmState?.description ?? ''}
        confirmLabel={confirmState?.confirmLabel}
        secondaryLabel={confirmState?.secondaryLabel}
        onConfirm={() => confirmState?.onConfirm()}
        onSecondary={confirmState?.onSecondary}
        onCancel={() => setConfirmState(null)}
      />

      {/* Context Menu */}
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
