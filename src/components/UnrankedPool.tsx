import React, { useRef, useState } from 'react';
import { ChevronDown, ChevronUp, ImagePlus, Upload } from 'lucide-react';
import type { AppearanceConfig, TierItem } from '../core/types';
import { TierCard } from './TierCard';

interface UnrankedPoolProps {
  projectId: string;
  unrankedIds: string[];
  itemsMap: Record<string, TierItem>;
  appearance: AppearanceConfig;
  selectedItemId: string | null;
  collapsed: boolean;
  poolThumbSize: number;
  getThumbUrl: (projectId: string, assetId: string) => string;
  onToggleCollapse: () => void;
  onChangePoolThumbSize: (size: number) => void;
  onUploadFiles: (files: FileList) => void;
  onSelectItem: (itemId: string) => void;
  onUpdateItemCaption: (itemId: string, caption: string) => void;
  onContextMenuItem: (e: React.MouseEvent, itemId: string, containerId: string) => void;
  onDragStartItem: (
    e: React.DragEvent,
    itemId: string,
    sourceContainer: string
  ) => void;
  onDragEndItem: () => void;
  onDropItemInPool: (
    e: React.DragEvent,
    targetContainer: string,
    targetIndex: number
  ) => void;
}

export const UnrankedPool: React.FC<UnrankedPoolProps> = ({
  projectId,
  unrankedIds,
  itemsMap,
  appearance,
  selectedItemId,
  collapsed,
  poolThumbSize,
  getThumbUrl,
  onToggleCollapse,
  onChangePoolThumbSize,
  onUploadFiles,
  onSelectItem,
  onUpdateItemCaption,
  onContextMenuItem,
  onDragStartItem,
  onDragEndItem,
  onDropItemInPool,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  return (
    <section
      onDragOver={(e) => {
        if (
          e.dataTransfer.types.includes('application/x-tiercraft-item') ||
          e.dataTransfer.types.includes('Files')
        ) {
          e.preventDefault();
          setIsDragOver(true);
        }
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) {
          setIsDragOver(false);
        }
      }}
      onDrop={(e) => {
        setIsDragOver(false);
        if (e.dataTransfer.types.includes('application/x-tiercraft-item')) {
          e.preventDefault();
          onDropItemInPool(e, 'unranked', unrankedIds.length);
        } else if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
          e.preventDefault();
          onUploadFiles(e.dataTransfer.files);
        }
      }}
      className={`shrink-0 border-t border-slate-200 dark:border-[#272B36] bg-white dark:bg-[#161920] transition-colors ${
        isDragOver ? 'ring-2 ring-inset ring-[#4F6BED]/60 bg-[#4F6BED]/5' : ''
      }`}
    >
      {/* Pool Header Bar */}
      <div className="flex items-center justify-between gap-4 px-4 py-2 border-b border-slate-100 dark:border-[#222631]">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onToggleCollapse}
            className="flex items-center gap-1.5 text-xs font-semibold text-slate-800 dark:text-slate-200 hover:text-[#4F6BED] transition-colors whitespace-nowrap"
          >
            {collapsed ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
            <span>Нераспределённые изображения</span>
          </button>
          <span className="font-mono text-xs tabular-nums text-slate-500 dark:text-slate-400">
            {unrankedIds.length}
          </span>
        </div>

        <div className="flex items-center gap-4">
          {!collapsed && (
            <div className="hidden sm:flex items-center gap-2">
              <span className="text-[11px] text-slate-500 dark:text-slate-400 whitespace-nowrap">
                Размер миниатюр
              </span>
              <input
                type="range"
                min={56}
                max={140}
                value={poolThumbSize}
                onChange={(e) => onChangePoolThumbSize(Number(e.target.value))}
                className="w-24 accent-[#4F6BED]"
              />
              <span className="w-10 font-mono text-[11px] tabular-nums text-slate-500 dark:text-slate-400">
                {poolThumbSize}px
              </span>
            </div>
          )}

          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/png,image/jpeg,image/webp,image/gif"
            className="hidden"
            onChange={(e) => {
              if (e.target.files && e.target.files.length > 0) {
                onUploadFiles(e.target.files);
                e.target.value = '';
              }
            }}
          />

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-1.5 rounded-lg bg-[#4F6BED] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#435CD9] transition-colors whitespace-nowrap shrink-0"
          >
            <ImagePlus className="h-3.5 w-3.5" />
            <span>Добавить изображения</span>
          </button>
        </div>
      </div>

      {/* Pool Content */}
      {!collapsed && (
        <div className="max-h-48 min-h-[104px] overflow-y-auto px-4 py-3">
          {unrankedIds.length === 0 ? (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex h-20 w-full flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed border-slate-300 dark:border-[#2E3442] text-slate-500 dark:text-slate-400 hover:border-[#4F6BED] hover:text-slate-800 dark:hover:text-slate-200 transition-colors"
            >
              <Upload className="h-4 w-4 opacity-75" />
              <span className="text-xs">
                Перетащите изображения с компьютера сюда или нажмите, чтобы выбрать файлы
              </span>
            </button>
          ) : (
            <div className="flex flex-wrap items-start gap-2.5">
              {unrankedIds.map((itemId, index) => {
                const item = itemsMap[itemId];
                if (!item) return null;
                return (
                  <TierCard
                    key={item.id}
                    item={item}
                    containerId="unranked"
                    index={index}
                    thumbUrl={getThumbUrl(projectId, item.assetId)}
                    appearance={appearance}
                    selected={selectedItemId === item.id}
                    overrideSize={poolThumbSize}
                    onSelect={onSelectItem}
                    onUpdateCaption={onUpdateItemCaption}
                    onContextMenu={onContextMenuItem}
                    onDragStartItem={onDragStartItem}
                    onDragEndItem={onDragEndItem}
                    onDropBeforeItem={onDropItemInPool}
                  />
                );
              })}
            </div>
          )}
        </div>
      )}
    </section>
  );
};
