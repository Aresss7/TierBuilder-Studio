import React, { useEffect } from 'react';
import { AlertTriangle, X } from 'lucide-react';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  secondaryLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onSecondary?: () => void;
  onCancel: () => void;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  open,
  title,
  description,
  confirmLabel = 'Удалить',
  secondaryLabel,
  cancelLabel = 'Отмена',
  danger = true,
  onConfirm,
  onSecondary,
  onCancel,
}) => {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-[2px] p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div className="w-full max-w-md rounded-xl border border-slate-200 dark:border-[#272B36] bg-white dark:bg-[#161920] p-5 shadow-2xl">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div
              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                danger
                  ? 'bg-red-500/12 text-red-500'
                  : 'bg-indigo-500/12 text-indigo-500'
              }`}
            >
              <AlertTriangle className="h-4.5 w-4.5" />
            </div>
            <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
              {title}
            </h3>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-[#1E222B] hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
            aria-label="Закрыть"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <p className="mt-3 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
          {description}
        </p>

        <div className="mt-5 flex flex-wrap items-center justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="px-3.5 py-2 text-xs font-medium rounded-lg border border-slate-200 dark:border-[#272B36] text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#1E222B] transition-colors whitespace-nowrap"
          >
            {cancelLabel}
          </button>
          {secondaryLabel && onSecondary && (
            <button
              type="button"
              onClick={onSecondary}
              className="px-3.5 py-2 text-xs font-medium rounded-lg bg-slate-200 dark:bg-[#232834] text-slate-900 dark:text-slate-100 hover:bg-slate-300 dark:hover:bg-[#2C3241] transition-colors whitespace-nowrap"
            >
              {secondaryLabel}
            </button>
          )}
          <button
            type="button"
            onClick={onConfirm}
            className={`px-3.5 py-2 text-xs font-medium rounded-lg text-white transition-colors whitespace-nowrap ${
              danger
                ? 'bg-red-600 hover:bg-red-500'
                : 'bg-[#4F6BED] hover:bg-[#435CD9]'
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};
