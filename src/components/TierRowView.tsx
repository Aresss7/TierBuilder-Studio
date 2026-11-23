import React, { useState } from 'react';
import { GripVertical } from 'lucide-react';
import type { AppearanceConfig, TierItem, TierRow } from '../core/types';
import { TierCard } from './TierCard';

interface TierRowViewProps {
  tier: TierRow;
  index: number;
  projectId: string;
  itemsMap: Record<string, TierItem>;
  appearance: AppearanceConfig;
  selectedTierId: string | null;
  selectedItemId: string | null;
  zoom: number;
  getThumbUrl: (projectId: string, assetId: string) => string;
  onSelectTier: (tierId: string) => void;
  onSelectItem: (itemId: string) => void;
  onUpdateItemCaption: (itemId: string, caption: string) => void;
  onResizeTierHeight: (tierId: string, height: number, commitHistory: boolean) => void;
  onContextMenuTier: (e: React.MouseEvent, tierId: string) => void;
  onContextMenuItem: (e: React.MouseEvent, itemId: string, containerId: string) => void;
  onDragStartItem: (
    e: React.DragEvent,
    itemId: string,
    sourceContainer: string
  ) => void;
  onDragEndItem: () => void;
  onDropItemInTier: (
    e: React.DragEvent,
    tierId: string,
    targetIndex: number
  ) => void;
  onDropExternalFilesInTier: (files: FileList, tierId: string) => void;
  onDragStartTier: (e: React.DragEvent, index: number) => void;
  onDropTierOnRow: (e: React.DragEvent, targetIndex: number) => void;
}

export const TierRowView: React.FC<TierRowViewProps> = React.memo(
  ({
    tier,
    index,
    projectId,
    itemsMap,
    appearance,
    selectedTierId,
    selectedItemId,
    zoom,
    getThumbUrl,
    onSelectTier,
    onSelectItem,
    onUpdateItemCaption,
    onResizeTierHeight,
    onContextMenuTier,
    onContextMenuItem,
    onDragStartItem,
    onDragEndItem,
    onDropItemInTier,
    onDropExternalFilesInTier,
    onDragStartTier,
    onDropTierOnRow,
  }) => {
    const [isItemDragOver, setIsItemDragOver] = useState(false);
    const [isTierDragOver, setIsTierDragOver] = useState(false);
    const [resizingHeight, setResizingHeight] = useState<number | null>(null);

    const isSelected = selectedTierId === tier.id;
    const effectiveHeight = resizingHeight ?? tier.height;
    const hasDescription = tier.description.trim().length > 0;

    const handleResizeMouseDown = (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const startY = e.clientY;
      const startHeight = tier.height;
      let latestHeight = startHeight;

      const onMove = (moveEvent: MouseEvent) => {
        const delta = (moveEvent.clientY - startY) / zoom;
        latestHeight = Math.max(48, Math.min(480, Math.round(startHeight + delta)));
        setResizingHeight(latestHeight);
        onResizeTierHeight(tier.id, latestHeight, false);
      };

      const onUp = () => {
        window.removeEventListener('mousemove', onMove);
        window.removeEventListener('mouseup', onUp);
        setResizingHeight(null);
        if (latestHeight !== startHeight) {
          onResizeTierHeight(tier.id, latestHeight, true);
        }
      };

      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onUp);
    };

    const titleSizeClass =
      tier.title.length > 8
        ? 'text-base'
        : tier.title.length > 3
          ? 'text-xl'
          : 'text-2xl';

    return (
      <div
        onClick={(e) => {
          e.stopPropagation();
          onSelectTier(tier.id);
        }}
        onContextMenu={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onSelectTier(tier.id);
          onContextMenuTier(e, tier.id);
        }}
        onDragOver={(e) => {
          if (e.dataTransfer.types.includes('application/x-tiercraft-tier')) {
            e.preventDefault();
            setIsTierDragOver(true);
          }
        }}
        onDragLeave={() => setIsTierDragOver(false)}
        onDrop={(e) => {
          if (e.dataTransfer.types.includes('application/x-tiercraft-tier')) {
            e.preventDefault();
            setIsTierDragOver(false);
            onDropTierOnRow(e, index);
          }
        }}
        style={{
          minHeight: `${effectiveHeight}px`,
          borderRadius: `${appearance.tierRadius}px`,
          borderWidth: `${appearance.borderWidth}px`,
          borderColor: isSelected
            ? '#4F6BED'
            : isTierDragOver
              ? '#4F6BED'
              : appearance.borderColor,
          borderStyle: 'solid',
        }}
        className={`tier-row-optimize group/tier relative flex items-stretch overflow-hidden bg-[#181C24] transition-shadow duration-150 ${
          isSelected ? 'ring-2 ring-[#4F6BED]/70' : ''
        }`}
      >
        {/* Left Unified Label & Description Block */}
        <div
          style={{
            width: `${appearance.labelColumnWidth}px`,
            backgroundColor: tier.bgColor,
            borderRightWidth: `${appearance.borderWidth}px`,
            borderRightColor: appearance.borderColor,
            borderRightStyle: 'solid',
          }}
          className="relative flex shrink-0 flex-col items-center justify-center px-3 py-2.5 text-center select-none"
        >
          {/* Tier Drag Handle */}
          <div
            draggable
            onDragStart={(e) => {
              e.stopPropagation();
              onDragStartTier(e, index);
            }}
            title="Перетащите для изменения порядка тира"
            className="absolute left-1 top-1/2 -translate-y-1/2 cursor-grab active:cursor-grabbing rounded p-0.5 opacity-0 group-hover/tier:opacity-65 hover:!opacity-100 transition-opacity"
            style={{ color: tier.titleColor }}
          >
            <GripVertical className="h-4 w-4" />
          </div>

          <div
            style={{ color: tier.titleColor }}
            className={`font-display font-bold leading-tight break-words max-w-full ${titleSizeClass}`}
          >
            {tier.title || '—'}
          </div>

          {hasDescription && (
            <div
              style={{ color: tier.descriptionColor }}
              className="mt-1 text-[11.5px] leading-snug font-normal opacity-85 break-words max-w-full"
            >
              {tier.description}
            </div>
          )}
        </div>

        {/* Cards Drop Area */}
        <div
          onDragOver={(e) => {
            if (
              e.dataTransfer.types.includes('application/x-tiercraft-item') ||
              e.dataTransfer.types.includes('Files')
            ) {
              e.preventDefault();
              e.stopPropagation();
              setIsItemDragOver(true);
            }
          }}
          onDragLeave={(e) => {
            if (!e.currentTarget.contains(e.relatedTarget as Node)) {
              setIsItemDragOver(false);
            }
          }}
          onDrop={(e) => {
            setIsItemDragOver(false);
            if (e.dataTransfer.types.includes('application/x-tiercraft-item')) {
              e.preventDefault();
              e.stopPropagation();
              onDropItemInTier(e, tier.id, tier.itemIds.length);
            } else if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
              e.preventDefault();
              e.stopPropagation();
              onDropExternalFilesInTier(e.dataTransfer.files, tier.id);
            }
          }}
          style={{ gap: `${appearance.itemGap}px` }}
          className={`flex flex-1 flex-wrap items-center p-2.5 transition-colors duration-150 ${
            isItemDragOver ? 'bg-[#4F6BED]/12' : ''
          }`}
        >
          {tier.itemIds.map((itemId, cardIndex) => {
            const item = itemsMap[itemId];
            if (!item) return null;
            return (
              <TierCard
                key={item.id}
                item={item}
                containerId={tier.id}
                index={cardIndex}
                thumbUrl={getThumbUrl(projectId, item.assetId)}
                appearance={appearance}
                selected={selectedItemId === item.id}
                onSelect={onSelectItem}
                onUpdateCaption={onUpdateItemCaption}
                onContextMenu={onContextMenuItem}
                onDragStartItem={onDragStartItem}
                onDragEndItem={onDragEndItem}
                onDropBeforeItem={onDropItemInTier}
              />
            );
          })}
        </div>

        {/* Manual Bottom Tier Height Drag Handle (works even on empty tiers) */}
        <div
          onMouseDown={handleResizeMouseDown}
          title="Потяните, чтобы изменить высоту тира"
          className="absolute inset-x-0 bottom-0 h-1.5 cursor-ns-resize opacity-0 group-hover/tier:opacity-100 hover:bg-[#4F6BED]/60 transition-opacity z-10"
        />
      </div>
    );
  }
);

TierRowView.displayName = 'TierRowView';
