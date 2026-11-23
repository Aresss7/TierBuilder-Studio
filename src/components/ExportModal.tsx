import React, { useEffect, useMemo, useState } from 'react';
import { Download, Loader2, X } from 'lucide-react';
import {
  computeTierListExportDimensions,
  exportCanvasToBlob,
  renderTierListToCanvas,
} from '../core/canvasExporter';
import type { TierProject } from '../core/types';
import type { StorageBridge } from '../storage';

interface ExportModalProps {
  open: boolean;
  project: TierProject;
  bridge: StorageBridge;
  onClose: () => void;
  onNotify: (msg: string) => void;
}

const PRESET_WIDTHS = [
  { label: 'FHD (1920 px)', value: 1920 },
  { label: '2K (2560 px)', value: 2560 },
  { label: '4K (3840 px)', value: 3840 },
];

export const ExportModal: React.FC<ExportModalProps> = ({
  open,
  project,
  bridge,
  onClose,
  onNotify,
}) => {
  const [format, setFormat] = useState<'png' | 'jpeg'>('png');
  const [jpegQuality, setJpegQuality] = useState(92);
  const [widthMode, setWidthMode] = useState<'preset' | 'custom'>('preset');
  const [targetWidth, setTargetWidth] = useState(2560);
  const [customWidthInput, setCustomWidthInput] = useState('2048');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [renderingPreview, setRenderingPreview] = useState(false);
  const [exporting, setExporting] = useState(false);

  const effectiveWidth = useMemo(() => {
    if (widthMode === 'preset') return targetWidth;
    const parsed = parseInt(customWidthInput, 10);
    if (Number.isNaN(parsed)) return 1920;
    return Math.max(800, Math.min(7680, parsed));
  }, [widthMode, targetWidth, customWidthInput]);

  const exportDimensions = useMemo(
    () => computeTierListExportDimensions(project, effectiveWidth),
    [project, effectiveWidth]
  );

  // Render pure preview canvas (zero editor UI, completely independent of editor zoom)
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setRenderingPreview(true);

    const previewWidth = Math.min(1400, effectiveWidth);
    renderTierListToCanvas(
      project,
      (assetId) => bridge.getAssetUrl(project.id, assetId, 'orig'),
      { width: previewWidth }
    )
      .then((canvas) => {
        if (cancelled) return;
        const mime = format === 'jpeg' ? 'image/jpeg' : 'image/png';
        const q = format === 'jpeg' ? jpegQuality / 100 : undefined;
        setPreviewUrl(canvas.toDataURL(mime, q));
      })
      .catch(() => {
        if (!cancelled) setPreviewUrl(null);
      })
      .finally(() => {
        if (!cancelled) setRenderingPreview(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, project, bridge, format, jpegQuality, effectiveWidth]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const handleExport = async () => {
    setExporting(true);
    try {
      const canvas = await renderTierListToCanvas(
        project,
        (assetId) => bridge.getAssetUrl(project.id, assetId, 'orig'),
        { width: effectiveWidth }
      );
      const blob = await exportCanvasToBlob(canvas, {
        format,
        width: effectiveWidth,
        jpegQuality: jpegQuality / 100,
      });
      const bytes = new Uint8Array(await blob.arrayBuffer());
      const safeName =
        project.name.replace(/[<>:"/\\|?*]+/g, '_').trim() || 'tier-list';
      const ext = format === 'jpeg' ? 'jpg' : 'png';
      const saved = await bridge.saveExportFile(
        `${safeName}.${ext}`,
        [
          {
            name: format === 'jpeg' ? 'Изображение JPEG' : 'Изображение PNG',
            extensions: format === 'jpeg' ? ['jpg', 'jpeg'] : ['png'],
          },
        ],
        bytes,
        format === 'jpeg' ? 'image/jpeg' : 'image/png'
      );
      if (saved) {
        onNotify(`Изображение экспортировано (${canvas.width} × ${canvas.height} px)`);
        onClose();
      }
    } catch (err) {
      onNotify(`Ошибка экспорта: ${(err as Error).message}`);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-[2px] p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-xl border border-slate-200 dark:border-[#272B36] bg-white dark:bg-[#161920] shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-[#272B36] px-5 py-3.5">
          <div>
            <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
              Предпросмотр и экспорт изображения
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Итоговый рендер без элементов редактора и вне зависимости от масштаба холста
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-[#1E222B]"
            aria-label="Закрыть"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex flex-1 min-h-0 flex-col lg:flex-row">
          {/* Pure Export Preview */}
          <div className="flex-1 overflow-auto bg-slate-100 dark:bg-[#0B0D11] p-6 flex items-start justify-center">
            {renderingPreview && !previewUrl ? (
              <div className="flex h-64 items-center gap-2 text-sm text-slate-400">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Подготовка чистого предпросмотра...</span>
              </div>
            ) : previewUrl ? (
              <div className="relative max-w-full">
                <img
                  src={previewUrl}
                  alt="Предпросмотр экспортируемого тир-листа"
                  className="max-w-full rounded-lg border border-slate-300 dark:border-[#272B36] shadow-lg"
                />
                {renderingPreview && (
                  <div className="absolute right-3 top-3 flex items-center gap-1.5 rounded-md bg-black/75 px-2.5 py-1 text-xs text-slate-200">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    <span>Обновление...</span>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-sm text-slate-500">Не удалось построить превью</div>
            )}
          </div>

          {/* Export Controls */}
          <div className="w-full lg:w-80 shrink-0 border-t lg:border-t-0 lg:border-l border-slate-200 dark:border-[#272B36] p-5 flex flex-col justify-between gap-5 overflow-y-auto">
            <div className="space-y-5">
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-2">
                  Формат файла
                </label>
                <div className="grid grid-cols-2 gap-1.5 rounded-lg bg-slate-100 dark:bg-[#0F1115] p-1">
                  {(['png', 'jpeg'] as const).map((fmt) => (
                    <button
                      key={fmt}
                      type="button"
                      onClick={() => setFormat(fmt)}
                      className={`rounded-md py-1.5 text-xs font-semibold uppercase transition-colors ${
                        format === fmt
                          ? 'bg-white dark:bg-[#232834] text-slate-900 dark:text-slate-100 shadow-sm'
                          : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                      }`}
                    >
                      {fmt}
                    </button>
                  ))}
                </div>
              </div>

              {format === 'jpeg' && (
                <div>
                  <div className="flex items-center justify-between text-xs mb-1.5">
                    <span className="font-medium text-slate-600 dark:text-slate-400">
                      Качество JPEG
                    </span>
                    <span className="font-mono tabular-nums text-slate-900 dark:text-slate-200">
                      {jpegQuality}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min={10}
                    max={100}
                    value={jpegQuality}
                    onChange={(e) => setJpegQuality(Number(e.target.value))}
                    className="w-full accent-[#4F6BED]"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-2">
                  Разрешение экспорта
                </label>
                <div className="space-y-1.5">
                  {PRESET_WIDTHS.map((preset) => {
                    const active = widthMode === 'preset' && targetWidth === preset.value;
                    return (
                      <button
                        key={preset.value}
                        type="button"
                        onClick={() => {
                          setWidthMode('preset');
                          setTargetWidth(preset.value);
                        }}
                        className={`flex w-full items-center justify-between rounded-lg border px-3 py-2 text-xs font-medium transition-colors ${
                          active
                            ? 'border-[#4F6BED] bg-[#4F6BED]/10 text-slate-900 dark:text-slate-100'
                            : 'border-slate-200 dark:border-[#272B36] text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-[#1E222B]'
                        }`}
                      >
                        <span>{preset.label}</span>
                        <span className="font-mono tabular-nums text-[11px] opacity-75">
                          {preset.value}px
                        </span>
                      </button>
                    );
                  })}

                  <button
                    type="button"
                    onClick={() => setWidthMode('custom')}
                    className={`flex w-full items-center justify-between rounded-lg border px-3 py-2 text-xs font-medium transition-colors ${
                      widthMode === 'custom'
                        ? 'border-[#4F6BED] bg-[#4F6BED]/10 text-slate-900 dark:text-slate-100'
                        : 'border-slate-200 dark:border-[#272B36] text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-[#1E222B]'
                    }`}
                  >
                    <span>Своя ширина</span>
                    <span className="font-mono tabular-nums text-[11px] opacity-75">
                      800–7680
                    </span>
                  </button>

                  {widthMode === 'custom' && (
                    <div className="pt-1">
                      <input
                        type="number"
                        min={800}
                        max={7680}
                        value={customWidthInput}
                        onChange={(e) => setCustomWidthInput(e.target.value)}
                        className="w-full rounded-lg border border-slate-200 dark:border-[#272B36] bg-slate-50 dark:bg-[#0F1115] px-3 py-1.5 font-mono text-xs tabular-nums text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#4F6BED]"
                      />
                    </div>
                  )}
                </div>
              </div>

              <div className="rounded-lg border border-slate-200 dark:border-[#272B36] bg-slate-50 dark:bg-[#0F1115] p-3">
                <div className="text-[11px] text-slate-500 dark:text-slate-400">
                  Итоговый размер изображения
                </div>
                <div className="mt-1 font-mono text-sm font-semibold tabular-nums text-slate-900 dark:text-slate-100">
                  {exportDimensions.width} × {exportDimensions.height} px
                </div>
              </div>
            </div>

            <button
              type="button"
              disabled={exporting}
              onClick={handleExport}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#4F6BED] px-4 py-2.5 text-xs font-semibold text-white hover:bg-[#435CD9] disabled:opacity-60 transition-colors"
            >
              {exporting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Download className="h-4 w-4" />
              )}
              <span>{exporting ? 'Рендеринг...' : `Сохранить ${format.toUpperCase()}`}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
