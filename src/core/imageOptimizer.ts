import { TierProject } from './types';
import { renderTierListToCanvas } from './canvasExporter';

const ALLOWED_IMAGE_MIME = new Set([
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
]);

export interface ProcessedImagePayload {
  mimeType: string;
  fileName: string;
  width: number;
  height: number;
  originalBytes: Uint8Array;
  thumbnailBytes: Uint8Array;
  thumbnailMimeType: string;
}

export function isSupportedImageFile(file: File): boolean {
  if (ALLOWED_IMAGE_MIME.has(file.type)) return true;
  const lower = file.name.toLowerCase();
  return /\.(png|jpe?g|webp|gif)$/.test(lower);
}

export function inferMimeFromName(fileName: string, fallback = 'image/png'): string {
  const lower = fileName.toLowerCase();
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
  if (lower.endsWith('.webp')) return 'image/webp';
  if (lower.endsWith('.gif')) return 'image/gif';
  if (lower.endsWith('.png')) return 'image/png';
  return fallback;
}

/**
 * Decodes an uploaded image and generates a lightweight ~380px WebP/JPEG
 * thumbnail for fast editor rendering across hundreds of cards, while
 * keeping the original high-resolution bytes untouched for final export.
 */
export async function processImageFile(file: File): Promise<ProcessedImagePayload> {
  const buffer = await file.arrayBuffer();
  const originalBytes = new Uint8Array(buffer);
  const mimeType = ALLOWED_IMAGE_MIME.has(file.type)
    ? file.type
    : inferMimeFromName(file.name);

  const blob = new Blob([originalBytes], { type: mimeType });
  const bitmap = await createImageBitmap(blob);

  try {
    const width = bitmap.width;
    const height = bitmap.height;
    const maxThumbDim = 380;
    const scale = Math.min(1, maxThumbDim / Math.max(width, height));
    const thumbW = Math.max(1, Math.round(width * scale));
    const thumbH = Math.max(1, Math.round(height * scale));

    const canvas = document.createElement('canvas');
    canvas.width = thumbW;
    canvas.height = thumbH;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return {
        mimeType,
        fileName: file.name,
        width,
        height,
        originalBytes,
        thumbnailBytes: originalBytes,
        thumbnailMimeType: mimeType,
      };
    }

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(bitmap, 0, 0, thumbW, thumbH);

    // Prefer WebP for lightweight UI thumbnails, fallback to JPEG/PNG
    const thumbBlob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob((b) => resolve(b), 'image/webp', 0.84)
    );

    if (thumbBlob) {
      const thumbBuf = await thumbBlob.arrayBuffer();
      return {
        mimeType,
        fileName: file.name,
        width,
        height,
        originalBytes,
        thumbnailBytes: new Uint8Array(thumbBuf),
        thumbnailMimeType: thumbBlob.type || 'image/webp',
      };
    }

    return {
      mimeType,
      fileName: file.name,
      width,
      height,
      originalBytes,
      thumbnailBytes: originalBytes,
      thumbnailMimeType: mimeType,
    };
  } finally {
    bitmap.close();
  }
}

export function stripExtension(fileName: string): string {
  return fileName.replace(/\.[^/.]+$/, '');
}

/**
 * Generates a compact preview thumbnail of a project for the Home Screen grid.
 */
export async function generateProjectPreviewThumbnail(
  project: TierProject,
  resolveAssetUrl: (assetId: string) => string
): Promise<Uint8Array | null> {
  try {
    const canvas = await renderTierListToCanvas(project, resolveAssetUrl, {
      width: 640,
      maxTiers: 5,
    });
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob((b) => resolve(b), 'image/png')
    );
    if (!blob) return null;
    return new Uint8Array(await blob.arrayBuffer());
  } catch {
    return null;
  }
}
