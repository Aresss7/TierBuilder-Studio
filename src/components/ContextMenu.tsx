import React, { useEffect, useRef } from 'react';

export interface ContextMenuItem {
  id: string;
  label: string;
  icon?: React.ReactNode;
  danger?: boolean;
  disabled?: boolean;
  dividerBefore?: boolean;
  onSelect: () => void;
}

interface ContextMenuProps {
  x: number;
  y: number;
  items: ContextMenuItem[];
  onClose: () => void;
}

export const ContextMenu: React.FC<ContextMenuProps> = ({ x, y, items, onClose }) => {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('mousedown', handleClick);
    window.addEventListener('keydown', handleKey);
    window.addEventListener('scroll', onClose, true);
    return () => {
      window.removeEventListener('mousedown', handleClick);
      window.removeEventListener('keydown', handleKey);
      window.removeEventListener('scroll', onClose, true);
    };
  }, [onClose]);

  const clampedX = typeof window !== 'undefined' ? Math.min(x, window.innerWidth - 220) : x;
  const clampedY =
    typeof window !== 'undefined'
      ? Math.min(y, window.innerHeight - items.length * 36 - 24)
      : y;

  return (
    <div
      ref={menuRef}
      style={{ left: Math.max(8, clampedX), top: Math.max(8, clampedY) }}
      className="fixed z-50 min-w-[200px] rounded-xl border border-slate-200 dark:border-[#272B36] bg-white dark:bg-[#161920] p-1.5 shadow-xl"
      onContextMenu={(e) => e.preventDefault()}
    >
      {items.map((item) => (
        <React.Fragment key={item.id}>
          {item.dividerBefore && (
            <div className="my-1 h-px bg-slate-200 dark:bg-[#272B36]" />
          )}
          <button
            type="button"
            disabled={item.disabled}
            onClick={() => {
              if (!item.disabled) {
                item.onSelect();
                onClose();
              }
            }}
            className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left text-xs font-medium transition-colors ${
              item.disabled
                ? 'cursor-not-allowed opacity-40 text-slate-400'
                : item.danger
                  ? 'text-red-500 hover:bg-red-500/10'
                  : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#1E222B]'
            }`}
          >
            {item.icon && <span className="shrink-0 opacity-80">{item.icon}</span>}
            <span className="truncate">{item.label}</span>
          </button>
        </React.Fragment>
      ))}
    </div>
  );
};
