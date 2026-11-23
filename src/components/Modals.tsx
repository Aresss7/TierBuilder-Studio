import React, { useEffect, useState } from 'react';
import { Layers, X } from 'lucide-react';
import type { TierTemplate } from '../core/types';

interface NewProjectModalProps {
  open: boolean;
  templates: TierTemplate[];
  onCreate: (name: string, template: TierTemplate) => void;
  onClose: () => void;
}

export const NewProjectModal: React.FC<NewProjectModalProps> = ({
  open,
  templates,
  onCreate,
  onClose,
}) => {
  const [name, setName] = useState('Мой тир-лист');
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>(
    templates[0]?.id ?? ''
  );

  useEffect(() => {
    if (open) {
      setName('Новый тир-лист');
      setSelectedTemplateId(templates[0]?.id ?? '');
    }
  }, [open, templates]);

  if (!open) return null;

  const selectedTemplate =
    templates.find((t) => t.id === selectedTemplateId) ?? templates[0];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTemplate) return;
    onCreate(name.trim() || 'Новый тир-лист', selectedTemplate);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-[2px] p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-lg rounded-xl border border-slate-200 dark:border-[#272B36] bg-white dark:bg-[#161920] p-5 shadow-2xl"
      >
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
            Создать новый тир-лист
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-[#1E222B] transition-colors"
            aria-label="Закрыть"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-4 space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">
              Название проекта
            </label>
            <input
              type="text"
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Например: Топ фильмов 2026"
              className="w-full rounded-lg border border-slate-200 dark:border-[#272B36] bg-slate-50 dark:bg-[#0F1115] px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#4F6BED]"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">
              Шаблон оформления и структуры
            </label>
            <div className="grid grid-cols-1 gap-2 max-h-60 overflow-y-auto pr-1">
              {templates.map((tpl) => {
                const active = tpl.id === selectedTemplate?.id;
                return (
                  <button
                    key={tpl.id}
                    type="button"
                    onClick={() => setSelectedTemplateId(tpl.id)}
                    className={`flex items-center justify-between rounded-lg border px-3 py-2.5 text-left transition-colors ${
                      active
                        ? 'border-[#4F6BED] bg-[#4F6BED]/10'
                        : 'border-slate-200 dark:border-[#272B36] bg-slate-50 dark:bg-[#1E222B]/60 hover:border-slate-300 dark:hover:border-slate-600'
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <Layers className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                        <span className="truncate text-sm font-medium text-slate-900 dark:text-slate-100">
                          {tpl.name}
                        </span>
                      </div>
                      <div className="mt-1 flex items-center gap-1.5">
                        {tpl.tiers.slice(0, 6).map((row) => (
                          <span
                            key={row.id}
                            style={{ backgroundColor: row.bgColor, color: row.titleColor }}
                            className="inline-flex h-4 min-w-[18px] items-center justify-center rounded px-1 text-[10px] font-bold"
                          >
                            {row.title.slice(0, 3)}
                          </span>
                        ))}
                        {tpl.tiers.length > 6 && (
                          <span className="text-[11px] text-slate-400">
                            +{tpl.tiers.length - 6}
                          </span>
                        )}
                      </div>
                    </div>
                    <span className="ml-3 text-xs text-slate-500 dark:text-slate-400 tabular-nums shrink-0">
                      {tpl.tiers.length} тиров
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium rounded-lg border border-slate-200 dark:border-[#272B36] text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#1E222B] transition-colors"
          >
            Отмена
          </button>
          <button
            type="submit"
            className="px-4 py-2 text-xs font-medium rounded-lg bg-[#4F6BED] text-white hover:bg-[#435CD9] transition-colors"
          >
            Создать
          </button>
        </div>
      </form>
    </div>
  );
};

interface TextPromptModalProps {
  open: boolean;
  title: string;
  label: string;
  initialValue: string;
  submitLabel: string;
  onSubmit: (value: string) => void;
  onClose: () => void;
}

export const TextPromptModal: React.FC<TextPromptModalProps> = ({
  open,
  title,
  label,
  initialValue,
  submitLabel,
  onSubmit,
  onClose,
}) => {
  const [value, setValue] = useState(initialValue);

  useEffect(() => {
    if (open) setValue(initialValue);
  }, [open, initialValue]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-[2px] p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const trimmed = value.trim();
          if (trimmed) onSubmit(trimmed);
        }}
        className="w-full max-w-md rounded-xl border border-slate-200 dark:border-[#272B36] bg-white dark:bg-[#161920] p-5 shadow-2xl"
      >
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
            {title}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-[#1E222B]"
            aria-label="Закрыть"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="mt-4">
          <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">
            {label}
          </label>
          <input
            type="text"
            autoFocus
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className="w-full rounded-lg border border-slate-200 dark:border-[#272B36] bg-slate-50 dark:bg-[#0F1115] px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#4F6BED]"
          />
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium rounded-lg border border-slate-200 dark:border-[#272B36] text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#1E222B]"
          >
            Отмена
          </button>
          <button
            type="submit"
            disabled={!value.trim()}
            className="px-4 py-2 text-xs font-medium rounded-lg bg-[#4F6BED] text-white hover:bg-[#435CD9] disabled:opacity-50"
          >
            {submitLabel}
          </button>
        </div>
      </form>
    </div>
  );
};
