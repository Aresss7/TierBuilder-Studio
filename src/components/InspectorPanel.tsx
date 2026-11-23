import React from 'react';
import {
  ArrowDown,
  ArrowUp,
  Eraser,
  RotateCcw,
  Trash2,
  Undo2,
  X,
} from 'lucide-react';
import { DEFAULT_APPEARANCE, TIER_COLOR_SWATCHES } from '../core/defaults';
import type {
  AppearanceConfig,
  SelectionTarget,
  TierItem,
  TierProject,
  TierRow,
} from '../core/types';

interface InspectorPanelProps {
  project: TierProject;
  selection: SelectionTarget;
  onClose: () => void;
  onSelectTab: (target: SelectionTarget) => void;
  onUpdateAppearance: (patch: Partial<AppearanceConfig>, coalesceKey?: string) => void;
  onResetAppearanceDefaults: () => void;
  onResetAllCustomSizes: () => void;
  onUpdateTier: (
    tierId: string,
    patch: Partial<Omit<TierRow, 'id' | 'itemIds'>>,
    coalesceKey?: string
  ) => void;
  onMoveTierStep: (tierId: string, direction: -1 | 1) => void;
  onClearTier: (tierId: string) => void;
  onRequestDeleteTier: (tierId: string) => void;
  onUpdateItem: (
    itemId: string,
    patch: Partial<Omit<TierItem, 'id' | 'assetId'>>,
    coalesceKey?: string
  ) => void;
  onMoveItemToContainer: (itemId: string, targetContainer: string) => void;
  onDeleteItem: (itemId: string) => void;
}

const ColorRow: React.FC<{
  label: string;
  value: string;
  onChange: (val: string) => void;
}> = ({ label, value, onChange }) => (
  <div className="flex items-center justify-between gap-2">
    <span className="text-xs text-slate-600 dark:text-slate-300">{label}</span>
    <div className="flex items-center gap-2">
      <span className="font-mono text-[11px] uppercase text-slate-400">{value}</span>
      <input
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-6 w-8 cursor-pointer rounded border border-slate-300 dark:border-[#272B36] bg-transparent p-0"
      />
    </div>
  </div>
);

const RangeRow: React.FC<{
  label: string;
  value: number;
  min: number;
  max: number;
  unit?: string;
  onChange: (val: number) => void;
}> = ({ label, value, min, max, unit = 'px', onChange }) => (
  <div>
    <div className="flex items-center justify-between text-xs mb-1">
      <span className="text-slate-600 dark:text-slate-300">{label}</span>
      <span className="font-mono tabular-nums text-slate-900 dark:text-slate-100">
        {value}
        {unit}
      </span>
    </div>
    <input
      type="range"
      min={min}
      max={max}
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      className="w-full accent-[#4F6BED]"
    />
  </div>
);

export const InspectorPanel: React.FC<InspectorPanelProps> = ({
  project,
  selection,
  onClose,
  onSelectTab,
  onUpdateAppearance,
  onResetAppearanceDefaults,
  onResetAllCustomSizes,
  onUpdateTier,
  onMoveTierStep,
  onClearTier,
  onRequestDeleteTier,
  onUpdateItem,
  onMoveItemToContainer,
  onDeleteItem,
}) => {
  const { appearance } = project;
  const selectedTier =
    selection.type === 'tier'
      ? project.tiers.find((t) => t.id === selection.tierId) ?? null
      : null;
  const selectedItem =
    selection.type === 'item' ? project.items[selection.itemId] ?? null : null;

  const hasAnyCustomSizes = Object.values(project.items).some(
    (it) => it.customWidth !== undefined || it.customHeight !== undefined
  );

  const isAppearanceModified =
    JSON.stringify(appearance) !== JSON.stringify(DEFAULT_APPEARANCE);

  const selectedItemContainer = selectedItem
    ? project.unrankedIds.includes(selectedItem.id)
      ? 'unranked'
      : project.tiers.find((t) => t.itemIds.includes(selectedItem.id))?.id ?? 'unranked'
    : 'unranked';

  const hasCustomItemSize =
    selectedItem?.customWidth !== undefined || selectedItem?.customHeight !== undefined;

  return (
    <aside className="w-76 shrink-0 border-l border-slate-200 dark:border-[#272B36] bg-white dark:bg-[#161920] flex flex-col min-h-0">
      {/* Contextual Switcher + Close */}
      <div className="flex items-center gap-1.5 p-2 border-b border-slate-200 dark:border-[#272B36]">
        <div className="flex-1 grid grid-cols-3 gap-1 rounded-lg bg-slate-100 dark:bg-[#0F1115] p-1">
          <button
            type="button"
            onClick={() => onSelectTab({ type: 'appearance' })}
            className={`rounded-md py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
              selection.type === 'appearance'
                ? 'bg-white dark:bg-[#232834] text-slate-900 dark:text-slate-100 shadow-sm'
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            Оформление
          </button>
          <button
            type="button"
            onClick={() => {
              const firstTier = selectedTier?.id ?? project.tiers[0]?.id;
              if (firstTier) onSelectTab({ type: 'tier', tierId: firstTier });
            }}
            disabled={project.tiers.length === 0}
            className={`rounded-md py-1.5 text-xs font-medium transition-colors whitespace-nowrap disabled:opacity-40 ${
              selection.type === 'tier'
                ? 'bg-white dark:bg-[#232834] text-slate-900 dark:text-slate-100 shadow-sm'
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            Тир
          </button>
          <button
            type="button"
            onClick={() => {
              if (selectedItem) {
                onSelectTab({ type: 'item', itemId: selectedItem.id });
              } else {
                const firstId =
                  project.tiers.flatMap((t) => t.itemIds)[0] ?? project.unrankedIds[0];
                if (firstId) onSelectTab({ type: 'item', itemId: firstId });
              }
            }}
            disabled={Object.keys(project.items).length === 0}
            className={`rounded-md py-1.5 text-xs font-medium transition-colors whitespace-nowrap disabled:opacity-40 ${
              selection.type === 'item'
                ? 'bg-white dark:bg-[#232834] text-slate-900 dark:text-slate-100 shadow-sm'
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            Карточка
          </button>
        </div>

        <button
          type="button"
          onClick={onClose}
          title="Закрыть панель настроек"
          aria-label="Закрыть панель настроек"
          className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-[#1E222B] hover:text-slate-700 dark:hover:text-slate-200 transition-colors shrink-0"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Scrollable Inspector Body */}
      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        {selection.type === 'appearance' && (
          <>
            {/* Section: Canvas & Colors */}
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <h4 className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                  Холст и границы
                </h4>
                {isAppearanceModified && (
                  <button
                    type="button"
                    onClick={onResetAppearanceDefaults}
                    title="Сбросить все настройки оформления по умолчанию"
                    className="flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-medium text-[#4F6BED] hover:bg-[#4F6BED]/10 transition-colors"
                  >
                    <RotateCcw className="h-3 w-3" />
                    <span>По умолчанию</span>
                  </button>
                )}
              </div>
              <ColorRow
                label="Фон тир-листа"
                value={appearance.canvasBg}
                onChange={(canvasBg) =>
                  onUpdateAppearance({ canvasBg }, 'app:canvasBg')
                }
              />
              <ColorRow
                label="Цвет границ"
                value={appearance.borderColor}
                onChange={(borderColor) =>
                  onUpdateAppearance({ borderColor }, 'app:borderColor')
                }
              />
              <RangeRow
                label="Толщина границ"
                value={appearance.borderWidth}
                min={0}
                max={4}
                onChange={(borderWidth) =>
                  onUpdateAppearance({ borderWidth }, 'app:borderWidth')
                }
              />
              <RangeRow
                label="Скругление тиров"
                value={appearance.tierRadius}
                min={0}
                max={20}
                onChange={(tierRadius) =>
                  onUpdateAppearance({ tierRadius }, 'app:tierRadius')
                }
              />
            </div>

            <div className="h-px bg-slate-200 dark:bg-[#272B36]" />

            {/* Section: Global Card Sizes & Fit */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                  Все карточки
                </h4>
                {hasAnyCustomSizes && (
                  <button
                    type="button"
                    onClick={onResetAllCustomSizes}
                    className="flex items-center gap-1 text-[11px] font-medium text-[#4F6BED] hover:underline"
                  >
                    <RotateCcw className="h-3 w-3" />
                    <span>Сбросить особые</span>
                  </button>
                )}
              </div>

              <RangeRow
                label="Ширина всех карточек"
                value={appearance.defaultCardWidth}
                min={56}
                max={220}
                onChange={(defaultCardWidth) =>
                  onUpdateAppearance({ defaultCardWidth }, 'app:cardWidth')
                }
              />
              <RangeRow
                label="Высота всех карточек"
                value={appearance.defaultCardHeight}
                min={56}
                max={220}
                onChange={(defaultCardHeight) =>
                  onUpdateAppearance({ defaultCardHeight }, 'app:cardHeight')
                }
              />
              <RangeRow
                label="Скругление карточек"
                value={appearance.cardRadius}
                min={0}
                max={20}
                onChange={(cardRadius) =>
                  onUpdateAppearance({ cardRadius }, 'app:cardRadius')
                }
              />

              <div>
                <span className="block text-xs text-slate-600 dark:text-slate-300 mb-1.5">
                  Кадрирование изображений
                </span>
                <div className="grid grid-cols-2 gap-1.5 rounded-lg bg-slate-100 dark:bg-[#0F1115] p-1">
                  <button
                    type="button"
                    onClick={() => onUpdateAppearance({ imageFit: 'cover' })}
                    className={`rounded-md py-1.5 text-xs font-medium transition-colors ${
                      appearance.imageFit === 'cover'
                        ? 'bg-white dark:bg-[#232834] text-slate-900 dark:text-slate-100 shadow-sm'
                        : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                    }`}
                  >
                    Обрезать
                  </button>
                  <button
                    type="button"
                    onClick={() => onUpdateAppearance({ imageFit: 'contain' })}
                    className={`rounded-md py-1.5 text-xs font-medium transition-colors ${
                      appearance.imageFit === 'contain'
                        ? 'bg-white dark:bg-[#232834] text-slate-900 dark:text-slate-100 shadow-sm'
                        : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                    }`}
                  >
                    Вписать
                  </button>
                </div>
              </div>
            </div>

            <div className="h-px bg-slate-200 dark:bg-[#272B36]" />

            {/* Section: Spacing */}
            <div className="space-y-3">
              <h4 className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                Отступы и пропорции
              </h4>
              <RangeRow
                label="Ширина названия тира"
                value={appearance.labelColumnWidth}
                min={80}
                max={240}
                onChange={(labelColumnWidth) =>
                  onUpdateAppearance({ labelColumnWidth }, 'app:labelW')
                }
              />
              <RangeRow
                label="Расстояние между тирами"
                value={appearance.tierGap}
                min={0}
                max={28}
                onChange={(tierGap) => onUpdateAppearance({ tierGap }, 'app:tierGap')}
              />
              <RangeRow
                label="Отступ между карточками"
                value={appearance.itemGap}
                min={2}
                max={28}
                onChange={(itemGap) => onUpdateAppearance({ itemGap }, 'app:itemGap')}
              />
            </div>

            <div className="h-px bg-slate-200 dark:bg-[#272B36]" />

            {/* Section: Captions */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                  Подписи под фото
                </h4>
                <label className="relative inline-flex cursor-pointer items-center">
                  <input
                    type="checkbox"
                    checked={appearance.captionsEnabled}
                    onChange={(e) =>
                      onUpdateAppearance({ captionsEnabled: e.target.checked })
                    }
                    className="peer sr-only"
                  />
                  <div className="h-5 w-9 rounded-full bg-slate-300 dark:bg-[#272B36] peer-checked:bg-[#4F6BED] after:absolute after:left-0.5 after:top-0.5 after:h-4 after:w-4 after:rounded-full after:bg-white after:transition-transform peer-checked:after:translate-x-4" />
                </label>
              </div>

              {appearance.captionsEnabled && (
                <div className="space-y-3 pt-1">
                  <ColorRow
                    label="Цвет плашки"
                    value={appearance.captionBg}
                    onChange={(captionBg) =>
                      onUpdateAppearance({ captionBg }, 'app:captionBg')
                    }
                  />
                  <RangeRow
                    label="Прозрачность плашки"
                    value={appearance.captionOpacity}
                    min={15}
                    max={100}
                    unit="%"
                    onChange={(captionOpacity) =>
                      onUpdateAppearance({ captionOpacity }, 'app:captionOpacity')
                    }
                  />
                  <ColorRow
                    label="Цвет текста"
                    value={appearance.captionTextColor}
                    onChange={(captionTextColor) =>
                      onUpdateAppearance({ captionTextColor }, 'app:captionTextColor')
                    }
                  />
                </div>
              )}
            </div>
          </>
        )}

        {selection.type === 'tier' && selectedTier && (
          <>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                  Выбранный тир
                </h4>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => onMoveTierStep(selectedTier.id, -1)}
                    title="Переместить выше"
                    className="rounded-md p-1 text-slate-500 hover:bg-slate-100 dark:hover:bg-[#1E222B] hover:text-slate-900 dark:hover:text-slate-100"
                  >
                    <ArrowUp className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onMoveTierStep(selectedTier.id, 1)}
                    title="Переместить ниже"
                    className="rounded-md p-1 text-slate-500 hover:bg-slate-100 dark:hover:bg-[#1E222B] hover:text-slate-900 dark:hover:text-slate-100"
                  >
                    <ArrowDown className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs text-slate-600 dark:text-slate-300 mb-1">
                  Название тира
                </label>
                <input
                  type="text"
                  value={selectedTier.title}
                  onChange={(e) =>
                    onUpdateTier(selectedTier.id, { title: e.target.value })
                  }
                  className="w-full rounded-lg border border-slate-200 dark:border-[#272B36] bg-slate-50 dark:bg-[#0F1115] px-2.5 py-1.5 text-sm font-medium text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#4F6BED]"
                />
              </div>

              <div>
                <label className="block text-xs text-slate-600 dark:text-slate-300 mb-1">
                  Описание (опционально)
                </label>
                <textarea
                  rows={2}
                  value={selectedTier.description}
                  onChange={(e) =>
                    onUpdateTier(selectedTier.id, { description: e.target.value })
                  }
                  placeholder="Если пусто — не занимает места"
                  className="w-full resize-none rounded-lg border border-slate-200 dark:border-[#272B36] bg-slate-50 dark:bg-[#0F1115] px-2.5 py-1.5 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#4F6BED]"
                />
              </div>
            </div>

            <div className="h-px bg-slate-200 dark:bg-[#272B36]" />

            <div className="space-y-3">
              <h4 className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                Цвета тира
              </h4>
              <div className="flex flex-wrap gap-1.5">
                {TIER_COLOR_SWATCHES.map((swatch) => (
                  <button
                    key={swatch}
                    type="button"
                    onClick={() => onUpdateTier(selectedTier.id, { bgColor: swatch })}
                    style={{ backgroundColor: swatch }}
                    className={`h-6 w-6 rounded-md border transition-transform hover:scale-105 ${
                      selectedTier.bgColor.toLowerCase() === swatch.toLowerCase()
                        ? 'border-white ring-2 ring-[#4F6BED]'
                        : 'border-black/20'
                    }`}
                    aria-label={`Цвет ${swatch}`}
                  />
                ))}
              </div>
              <ColorRow
                label="Цвет фона"
                value={selectedTier.bgColor}
                onChange={(bgColor) =>
                  onUpdateTier(selectedTier.id, { bgColor }, `tier:bg:${selectedTier.id}`)
                }
              />
              <ColorRow
                label="Цвет названия"
                value={selectedTier.titleColor}
                onChange={(titleColor) =>
                  onUpdateTier(
                    selectedTier.id,
                    { titleColor },
                    `tier:tc:${selectedTier.id}`
                  )
                }
              />
              <ColorRow
                label="Цвет описания"
                value={selectedTier.descriptionColor}
                onChange={(descriptionColor) =>
                  onUpdateTier(
                    selectedTier.id,
                    { descriptionColor },
                    `tier:dc:${selectedTier.id}`
                  )
                }
              />
            </div>

            <div className="h-px bg-slate-200 dark:bg-[#272B36]" />

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                  Высота тира
                </h4>
                <button
                  type="button"
                  onClick={() => onUpdateTier(selectedTier.id, { height: 112 })}
                  className="text-[11px] text-[#4F6BED] hover:underline"
                >
                  Сбросить (112px)
                </button>
              </div>
              <RangeRow
                label="Минимальная высота"
                value={selectedTier.height}
                min={48}
                max={420}
                onChange={(height) =>
                  onUpdateTier(selectedTier.id, { height }, `tier:h:${selectedTier.id}`)
                }
              />
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Сохраняется даже для пустых тиров. Также можно тянуть нижний край строки.
              </p>
            </div>

            <div className="h-px bg-slate-200 dark:bg-[#272B36]" />

            <div className="space-y-2">
              <button
                type="button"
                disabled={selectedTier.itemIds.length === 0}
                onClick={() => onClearTier(selectedTier.id)}
                className="flex w-full items-center justify-center gap-2 rounded-lg border border-slate-200 dark:border-[#272B36] px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#1E222B] disabled:opacity-40 transition-colors"
              >
                <Eraser className="h-3.5 w-3.5" />
                <span>Убрать фото в нераспределённые</span>
              </button>
              <button
                type="button"
                onClick={() => onRequestDeleteTier(selectedTier.id)}
                className="flex w-full items-center justify-center gap-2 rounded-lg border border-red-500/30 bg-red-500/8 px-3 py-2 text-xs font-medium text-red-500 hover:bg-red-500/15 transition-colors"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span>Удалить тир</span>
              </button>
            </div>
          </>
        )}

        {selection.type === 'item' && selectedItem && (
          <>
            <div className="space-y-3">
              <h4 className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                Выбранная карточка
              </h4>
              <div className="text-[11px] truncate text-slate-500 dark:text-slate-400">
                {selectedItem.fileName}
              </div>

              <div>
                <label className="block text-xs text-slate-600 dark:text-slate-300 mb-1">
                  Подпись под изображением
                </label>
                <input
                  type="text"
                  value={selectedItem.caption}
                  onChange={(e) =>
                    onUpdateItem(selectedItem.id, { caption: e.target.value })
                  }
                  placeholder="Введите подпись..."
                  className="w-full rounded-lg border border-slate-200 dark:border-[#272B36] bg-slate-50 dark:bg-[#0F1115] px-2.5 py-1.5 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#4F6BED]"
                />
              </div>

              <div>
                <span className="block text-xs text-slate-600 dark:text-slate-300 mb-1.5">
                  Отображение подписи
                </span>
                <div className="grid grid-cols-3 gap-1 rounded-lg bg-slate-100 dark:bg-[#0F1115] p-1">
                  {[
                    { label: 'Общее', value: undefined },
                    { label: 'Показать', value: true },
                    { label: 'Скрыть', value: false },
                  ].map((opt) => {
                    const active = selectedItem.showCaption === opt.value;
                    return (
                      <button
                        key={opt.label}
                        type="button"
                        onClick={() =>
                          onUpdateItem(selectedItem.id, { showCaption: opt.value })
                        }
                        className={`rounded-md py-1 text-[11px] font-medium transition-colors ${
                          active
                            ? 'bg-white dark:bg-[#232834] text-slate-900 dark:text-slate-100 shadow-sm'
                            : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                        }`}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="h-px bg-slate-200 dark:bg-[#272B36]" />

            {/* Individual Card Dimensions */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                  Индивидуальный размер
                </h4>
                <label className="relative inline-flex cursor-pointer items-center">
                  <input
                    type="checkbox"
                    checked={hasCustomItemSize}
                    onChange={(e) => {
                      if (e.target.checked) {
                        onUpdateItem(selectedItem.id, {
                          customWidth: appearance.defaultCardWidth,
                          customHeight: appearance.defaultCardHeight,
                        });
                      } else {
                        onUpdateItem(selectedItem.id, {
                          customWidth: undefined,
                          customHeight: undefined,
                        });
                      }
                    }}
                    className="peer sr-only"
                  />
                  <div className="h-5 w-9 rounded-full bg-slate-300 dark:bg-[#272B36] peer-checked:bg-[#4F6BED] after:absolute after:left-0.5 after:top-0.5 after:h-4 after:w-4 after:rounded-full after:bg-white after:transition-transform peer-checked:after:translate-x-4" />
                </label>
              </div>

              {hasCustomItemSize ? (
                <div className="space-y-3">
                  <RangeRow
                    label="Ширина карточки"
                    value={selectedItem.customWidth ?? appearance.defaultCardWidth}
                    min={48}
                    max={320}
                    onChange={(customWidth) =>
                      onUpdateItem(
                        selectedItem.id,
                        { customWidth },
                        `item:w:${selectedItem.id}`
                      )
                    }
                  />
                  <RangeRow
                    label="Высота карточки"
                    value={selectedItem.customHeight ?? appearance.defaultCardHeight}
                    min={48}
                    max={320}
                    onChange={(customHeight) =>
                      onUpdateItem(
                        selectedItem.id,
                        { customHeight },
                        `item:h:${selectedItem.id}`
                      )
                    }
                  />
                </div>
              ) : (
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Используется общий размер ({appearance.defaultCardWidth} ×{' '}
                  {appearance.defaultCardHeight} px)
                </p>
              )}
            </div>

            <div className="h-px bg-slate-200 dark:bg-[#272B36]" />

            <div className="space-y-2.5">
              <div>
                <label className="block text-xs text-slate-600 dark:text-slate-300 mb-1">
                  Расположение
                </label>
                <select
                  value={selectedItemContainer}
                  onChange={(e) =>
                    onMoveItemToContainer(selectedItem.id, e.target.value)
                  }
                  className="w-full rounded-lg border border-slate-200 dark:border-[#272B36] bg-slate-50 dark:bg-[#0F1115] px-2.5 py-1.5 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#4F6BED]"
                >
                  {project.tiers.map((t) => (
                    <option key={t.id} value={t.id}>
                      Тир: {t.title || 'Без названия'}
                    </option>
                  ))}
                  <option value="unranked">Нераспределённые</option>
                </select>
              </div>

              {selectedItemContainer !== 'unranked' && (
                <button
                  type="button"
                  onClick={() => onMoveItemToContainer(selectedItem.id, 'unranked')}
                  className="flex w-full items-center justify-center gap-2 rounded-lg border border-slate-200 dark:border-[#272B36] px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#1E222B] transition-colors"
                >
                  <Undo2 className="h-3.5 w-3.5" />
                  <span>Вернуть в пул</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => onDeleteItem(selectedItem.id)}
                className="flex w-full items-center justify-center gap-2 rounded-lg border border-red-500/30 bg-red-500/8 px-3 py-2 text-xs font-medium text-red-500 hover:bg-red-500/15 transition-colors"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span>Удалить изображение</span>
              </button>
            </div>
          </>
        )}
      </div>
    </aside>
  );
};
