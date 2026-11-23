import React, { useEffect, useRef, useState } from 'react';
import { ImageOff } from 'lucide-react';
import type { AppearanceConfig, TierItem } from '../core/types';

function hexToRgbaCss(hex: string, opacityPercent: number): string {
  const clean = hex.replace('#', '');
  const alpha = Math.max(0, Math.min(1, opacityPercent / 100));
  if (clean.length === 3) {
    const r = parseInt(clean[0] + clean[0], 16);
    const g = parseInt(clean[1] + clean[1], 16);
    const b = parseInt(clean[2] + clean[2], 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }
  if (clean.length === 6) {
    const r = parseInt(clean.slice(0, 2), 16);
    const g = parseInt(clean.slice(2, 4), 16);
    const b = parseInt(clean.slice(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }
  return `rgba(11, 13, 17, ${alpha})`;
}

interface TierCardProps {
  item: TierItem;
  containerId: string;
  index: number;
  thumbUrl: string;
  appearance: AppearanceConfig;
  selected: boolean;
  overrideSize?: number; // Used inside UnrankedPool
  hideCustomSizeBadge?: boolean;
  onSelect: (itemId: string) => void;
  onUpdateCaption: (itemId: string, caption: string) => void;
  onContextMenu: (e: React.MouseEvent, itemId: string, containerId: string) => void;
  onDragStartItem: (
    e: React.DragEvent,
    itemId: string,
    sourceContainer: string
  ) => void;
  onDragEndItem: () => void;
  onDropBeforeItem: (
    e: React.DragEvent,
    targetContainer: string,
    targetIndex: number
  ) => void;
}

export const TierCard: React.FC<TierCardProps> = React.memo(
  ({
    item,
    containerId,
    index,
    thumbUrl,
    appearance,
    selected,
    overrideSize,
    onSelect,
    onUpdateCaption,
    onContextMenu,
    onDragStartItem,
    onDragEndItem,
    onDropBeforeItem,
  }) => {
    const [imgError, setImgError] = useState(false);
    const [editingCaption, setEditingCaption] = useState(false);
    const [draftCaption, setDraftCaption] = useState(item.caption);
    const [dropEdge, setDropEdge] = useState<'left' | 'right' | null>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
      setDraftCaption(item.caption);
    }, [item.caption]);

    useEffect(() => {
      setImgError(false);
    }, [thumbUrl]);

    useEffect(() => {
      if (editingCaption && inputRef.current) {
        inputRef.current.focus();
        inputRef.current.select();
      }
    }, [editingCaption]);

    const width = overrideSize ?? item.customWidth ?? appearance.defaultCardWidth;
    const height = overrideSize ?? item.customHeight ?? appearance.defaultCardHeight;
    const showCaption =
      (item.showCaption ?? appearance.captionsEnabled) &&
      (editingCaption || item.caption.trim().length > 0);

    const commitCaption = () => {
      setEditingCaption(false);
      if (draftCaption !== item.caption) {
        onUpdateCaption(item.id, draftCaption);
      }
    };

    return (
      <div
        draggable={!editingCaption}
        onDragStart={(e) => {
          e.stopPropagation();
          onDragStartItem(e, item.id, containerId);
        }}
        onDragEnd={() => {
          setDropEdge(null);
          onDragEndItem();
        }}
        onDragOver={(e) => {
          if (!e.dataTransfer.types.includes('application/x-tiercraft-item')) return;
          e.preventDefault();
          e.stopPropagation();
          const rect = e.currentTarget.getBoundingClientRect();
          const isRight = e.clientX - rect.left > rect.width / 2;
          setDropEdge(isRight ? 'right' : 'left');
        }}
        onDragLeave={() => setDropEdge(null)}
        onDrop={(e) => {
          if (!e.dataTransfer.types.includes('application/x-tiercraft-item')) return;
          e.preventDefault();
          e.stopPropagation();
          const rect = e.currentTarget.getBoundingClientRect();
          const isRight = e.clientX - rect.left > rect.width / 2;
          setDropEdge(null);
          onDropBeforeItem(e, containerId, isRight ? index + 1 : index);
        }}
        onClick={(e) => {
          e.stopPropagation();
          onSelect(item.id);
        }}
        onDoubleClick={(e) => {
          e.stopPropagation();
          setEditingCaption(true);
        }}
        onContextMenu={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onSelect(item.id);
          onContextMenu(e, item.id, containerId);
        }}
        style={{
          width: `${width}px`,
          borderRadius: `${appearance.cardRadius}px`,
          borderWidth: appearance.borderWidth > 0 ? `${Math.max(1, Math.round(appearance.borderWidth * 0.75))}px` : '0px',
          borderColor: selected ? '#4F6BED' : appearance.borderColor,
          borderStyle: 'solid',
        }}
        className={`group relative flex flex-col shrink-0 select-none overflow-hidden bg-[#0B0D11] transition-shadow duration-150 cursor-grab active:cursor-grabbing ${
          selected ? 'ring-2 ring-[#4F6BED] ring-offset-1 ring-offset-transparent shadow-lg' : 'hover:brightness-105'
        }`}
        title={item.caption || item.fileName}
      >
        {dropEdge === 'left' && (
          <div className="pointer-events-none absolute inset-y-0 left-0 z-20 w-1 bg-[#4F6BED]" />
        )}
        {dropEdge === 'right' && (
          <div className="pointer-events-none absolute inset-y-0 right-0 z-20 w-1 bg-[#4F6BED]" />
        )}

        {/* Image frame (never overlapped by caption bar) */}
        <div
          style={{ width: '100%', height: `${height}px` }}
          className="relative overflow-hidden bg-[#0B0D11] flex items-center justify-center shrink-0"
        >
          {!imgError ? (
            <img
              src={thumbUrl}
              alt={item.caption || item.fileName}
              loading="lazy"
              decoding="async"
              referrerPolicy="no-referrer"
              draggable={false}
              onError={() => setImgError(true)}
              className={`h-full w-full pointer-events-none ${
                appearance.imageFit === 'contain' ? 'object-contain' : 'object-cover'
              }`}
            />
          ) : (
            <div className="flex flex-col items-center justify-center gap-1 p-2 text-center text-slate-500">
              <ImageOff className="h-5 w-5 opacity-70" />
              <span className="max-w-full truncate text-[10px]">{item.fileName}</span>
            </div>
          )}
        </div>

        {/* Caption bar directly below image */}
        {showCaption && (
          <div
            style={{
              backgroundColor: hexToRgbaCss(
                appearance.captionBg,
                appearance.captionOpacity
              ),
              color: appearance.captionTextColor,
            }}
            className="w-full px-1.5 py-1 text-center shrink-0"
          >
            {editingCaption ? (
              <input
                ref={inputRef}
                type="text"
                value={draftCaption}
                onChange={(e) => setDraftCaption(e.target.value)}
                onBlur={commitCaption}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') commitCaption();
                  if (e.key === 'Escape') {
                    setDraftCaption(item.caption);
                    setEditingCaption(false);
                  }
                }}
                onClick={(e) => e.stopPropagation()}
                className="w-full bg-transparent text-center text-[11px] font-medium leading-tight focus:outline-none"
              />
            ) : (
              <div className="truncate text-[11.5px] font-medium leading-tight">
                {item.caption}
              </div>
            )}
          </div>
        )}
      </div>
    );
  }
);

TierCard.displayName = 'TierCard';
