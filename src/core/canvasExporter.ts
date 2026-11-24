import { ExportOptions, TierItem, TierProject, TierRow } from './types';

interface RenderCanvasParams {
  width: number;
  maxTiers?: number;
}

const LOGICAL_BASE_WIDTH = 1120;

function hexToRgba(hex: string, opacityPercent: number): string {
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

function drawRoundedRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  const radius = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + w - radius, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
  ctx.lineTo(x + w, y + h - radius);
  ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
  ctx.lineTo(x + radius, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

function wrapTextLines(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxLines: number
): string[] {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];
  const lines: string[] = [];
  let current = words[0];

  for (let i = 1; i < words.length; i++) {
    const candidate = `${current} ${words[i]}`;
    if (ctx.measureText(candidate).width <= maxWidth) {
      current = candidate;
    } else {
      lines.push(current);
      current = words[i];
      if (lines.length === maxLines) break;
    }
  }
  if (lines.length < maxLines) {
    lines.push(current);
  } else if (lines.length === maxLines) {
    // Truncate last line with ellipsis if needed
    let last = lines[maxLines - 1];
    while (last.length > 1 && ctx.measureText(`${last}…`).width > maxWidth) {
      last = last.slice(0, -1);
    }
    if (words.join(' ') !== lines.join(' ')) {
      lines[maxLines - 1] = `${last}…`;
    }
  }
  return lines;
}

function loadImageElement(url: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

interface PositionedCard {
  item: TierItem;
  x: number;
  y: number;
  w: number;
  imgH: number;
  captionH: number;
  totalH: number;
  showCaption: boolean;
}

interface ComputedTierLayout {
  tier: TierRow;
  y: number;
  height: number;
  cards: PositionedCard[];
}

export function computeTierListExportDimensions(
  project: TierProject,
  targetWidth: number,
  maxTiers?: number
): { width: number; height: number } {
  const scale = targetWidth / LOGICAL_BASE_WIDTH;
  const app = project.appearance;
  const outerPad = 24 * scale;
  const tierGap = app.tierGap * scale;
  const itemGap = app.itemGap * scale;
  const labelW = app.labelColumnWidth * scale;
  const rowPad = 10 * scale;
  const contentAreaW = Math.max(120, targetWidth - outerPad * 2 - labelW - rowPad * 2);

  const tiers = maxTiers ? project.tiers.slice(0, maxTiers) : project.tiers;
  let totalH = outerPad * 2;

  tiers.forEach((tier, idx) => {
    const rowH = measureTierRowHeight(tier, project, scale, contentAreaW, itemGap, rowPad);
    totalH += rowH;
    if (idx < tiers.length - 1) totalH += tierGap;
  });

  if (tiers.length === 0) {
    totalH = Math.round(targetWidth * 0.45);
  }

  return {
    width: Math.round(targetWidth),
    height: Math.max(120, Math.round(totalH)),
  };
}

function measureTierRowHeight(
  tier: TierRow,
  project: TierProject,
  scale: number,
  contentAreaW: number,
  itemGap: number,
  rowPad: number
): number {
  const app = project.appearance;
  const isOverlay = (app.captionPosition ?? 'below') === 'overlay';
  const captionFontSize = 11.5 * scale;
  const captionBarHeight = Math.round(captionFontSize * 1.85 + 6 * scale);
  const minH = Math.max(48, tier.height) * scale;

  let curX = 0;
  let curY = rowPad;
  let lineMaxH = 0;

  for (const itemId of tier.itemIds) {
    const item = project.items[itemId];
    if (!item) continue;
    const cardW = (item.customWidth ?? app.defaultCardWidth) * scale;
    const cardImgH = (item.customHeight ?? app.defaultCardHeight) * scale;
    const showCap =
      (item.showCaption ?? app.captionsEnabled) && item.caption.trim().length > 0;
    const capH = showCap && !isOverlay ? captionBarHeight : 0;
    const cardTotalH = cardImgH + capH;

    if (curX > 0 && curX + cardW > contentAreaW + 0.5) {
      curX = 0;
      curY += lineMaxH + itemGap;
      lineMaxH = 0;
    }

    curX += cardW + itemGap;
    lineMaxH = Math.max(lineMaxH, cardTotalH);
  }

  const contentH = tier.itemIds.length > 0 ? curY + lineMaxH + rowPad : minH;
  return Math.max(minH, contentH);
}

/**
 * Pure Canvas 2D renderer producing a high-resolution, zero-UI image of the
 * complete tier list regardless of editor zoom or viewport scroll.
 */
export async function renderTierListToCanvas(
  project: TierProject,
  resolveAssetUrl: (assetId: string) => string,
  params: RenderCanvasParams
): Promise<HTMLCanvasElement> {
  if (typeof document !== 'undefined' && document.fonts?.ready) {
    await document.fonts.ready;
  }

  const targetWidth = Math.max(400, params.width);
  const scale = targetWidth / LOGICAL_BASE_WIDTH;
  const app = project.appearance;
  const outerPad = 24 * scale;
  const tierGap = app.tierGap * scale;
  const itemGap = app.itemGap * scale;
  const labelW = app.labelColumnWidth * scale;
  const rowPad = 10 * scale;
  const borderW = app.borderWidth * scale;
  const tierRadius = app.tierRadius * scale;
  const cardRadius = app.cardRadius * scale;
  const contentStartX = outerPad + labelW + rowPad;
  const contentAreaW = Math.max(120, targetWidth - outerPad * 2 - labelW - rowPad * 2);

  const isOverlay = (app.captionPosition ?? 'below') === 'overlay';
  const captionFontSize = 11.5 * scale;
  const captionBarHeight = Math.round(captionFontSize * 1.85 + 6 * scale);

  const tiers = params.maxTiers ? project.tiers.slice(0, params.maxTiers) : project.tiers;
  const layouts: ComputedTierLayout[] = [];
  let cursorY = outerPad;

  for (const tier of tiers) {
    const cards: PositionedCard[] = [];
    let curX = 0;
    let curY = rowPad;
    let lineMaxH = 0;

    for (const itemId of tier.itemIds) {
      const item = project.items[itemId];
      if (!item) continue;
      const cardW = (item.customWidth ?? app.defaultCardWidth) * scale;
      const imgH = (item.customHeight ?? app.defaultCardHeight) * scale;
      const showCaption =
        (item.showCaption ?? app.captionsEnabled) && item.caption.trim().length > 0;
      const captionH = showCaption ? captionBarHeight : 0;
      const totalH = isOverlay ? imgH : imgH + captionH;

      if (curX > 0 && curX + cardW > contentAreaW + 0.5) {
        curX = 0;
        curY += lineMaxH + itemGap;
        lineMaxH = 0;
      }

      cards.push({
        item,
        x: contentStartX + curX,
        y: cursorY + curY,
        w: cardW,
        imgH,
        captionH,
        totalH,
        showCaption,
      });

      curX += cardW + itemGap;
      lineMaxH = Math.max(lineMaxH, totalH);
    }

    const minH = Math.max(48, tier.height) * scale;
    const computedRowH =
      cards.length > 0 ? Math.max(minH, curY + lineMaxH + rowPad) : minH;

    layouts.push({
      tier,
      y: cursorY,
      height: computedRowH,
      cards,
    });

    cursorY += computedRowH + tierGap;
  }

  const totalHeight = Math.max(
    120,
    tiers.length > 0 ? cursorY - tierGap + outerPad : Math.round(targetWidth * 0.45)
  );

  // Preload all referenced original images in parallel
  const uniqueAssetIds = new Set<string>();
  for (const layout of layouts) {
    for (const card of layout.cards) {
      uniqueAssetIds.add(card.item.assetId);
    }
  }
  const loadedImages = new Map<string, HTMLImageElement | null>();
  await Promise.all(
    Array.from(uniqueAssetIds).map(async (assetId) => {
      const img = await loadImageElement(resolveAssetUrl(assetId));
      loadedImages.set(assetId, img);
    })
  );

  const canvas = document.createElement('canvas');
  canvas.width = Math.round(targetWidth);
  canvas.height = Math.round(totalHeight);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Не удалось инициализировать Canvas 2D');

  // 1. Overall Canvas Background
  ctx.fillStyle = app.canvasBg;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // 2. Render each Tier Row
  const rowWidth = targetWidth - outerPad * 2;
  for (const layout of layouts) {
    const { tier, y, height } = layout;

    // Row container background (subtle elevated slate or neutral tint)
    ctx.save();
    drawRoundedRectPath(ctx, outerPad, y, rowWidth, height, tierRadius);
    ctx.clip();

    ctx.fillStyle = '#181C24';
    ctx.fillRect(outerPad, y, rowWidth, height);

    // Label Column
    ctx.fillStyle = tier.bgColor;
    ctx.fillRect(outerPad, y, labelW, height);

    // Label Column separator line
    if (borderW > 0) {
      ctx.fillStyle = app.borderColor;
      ctx.fillRect(outerPad + labelW - borderW / 2, y, borderW, height);
    }

    // Tier Title + Optional Description (centered as a unified block)
    const labelCenterX = outerPad + labelW / 2;
    const labelMaxTextW = Math.max(24, labelW - 18 * scale);
    const titleFontSize = Math.round(
      (tier.title.length > 8 ? 16 : tier.title.length > 3 ? 20 : 26) * scale
    );
    const descFontSize = Math.round(11.5 * scale);

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    ctx.font = `700 ${titleFontSize}px "Plus Jakarta Sans", system-ui, sans-serif`;
    const titleLines = wrapTextLines(ctx, tier.title || ' ', labelMaxTextW, 2);
    const titleLineH = titleFontSize * 1.15;

    const hasDesc = tier.description.trim().length > 0;
    let descLines: string[] = [];
    const descLineH = descFontSize * 1.25;
    if (hasDesc) {
      ctx.font = `400 ${descFontSize}px "DM Sans", system-ui, sans-serif`;
      descLines = wrapTextLines(ctx, tier.description, labelMaxTextW, 3);
    }

    const gapBetweenTitleAndDesc = hasDesc ? 5 * scale : 0;
    const blockH =
      titleLines.length * titleLineH +
      gapBetweenTitleAndDesc +
      descLines.length * descLineH;
    let textY = y + height / 2 - blockH / 2 + titleLineH / 2;

    ctx.fillStyle = tier.titleColor;
    ctx.font = `700 ${titleFontSize}px "Plus Jakarta Sans", system-ui, sans-serif`;
    for (const line of titleLines) {
      ctx.fillText(line, labelCenterX, textY);
      textY += titleLineH;
    }

    if (descLines.length > 0) {
      textY =
        y +
        height / 2 -
        blockH / 2 +
        titleLines.length * titleLineH +
        gapBetweenTitleAndDesc +
        descLineH / 2;
      ctx.fillStyle = tier.descriptionColor;
      ctx.font = `400 ${descFontSize}px "DM Sans", system-ui, sans-serif`;
      for (const line of descLines) {
        ctx.fillText(line, labelCenterX, textY);
        textY += descLineH;
      }
    }

    // Cards inside Tier Row
    for (const card of layout.cards) {
      const img = loadedImages.get(card.item.assetId) ?? null;

      ctx.save();
      drawRoundedRectPath(ctx, card.x, card.y, card.w, card.totalH, cardRadius);
      ctx.clip();

      // Card base background (visible under 'contain' or while loading)
      ctx.fillStyle = '#0B0D11';
      ctx.fillRect(card.x, card.y, card.w, card.imgH);

      if (img && img.naturalWidth > 0 && img.naturalHeight > 0) {
        const iw = img.naturalWidth;
        const ih = img.naturalHeight;
        const targetRatio = card.w / card.imgH;
        const imgRatio = iw / ih;

        if (app.imageFit === 'cover') {
          let sx = 0;
          let sy = 0;
          let sw = iw;
          let sh = ih;
          if (imgRatio > targetRatio) {
            sw = ih * targetRatio;
            sx = (iw - sw) / 2;
          } else {
            sh = iw / targetRatio;
            sy = (ih - sh) / 2;
          }
          ctx.drawImage(img, sx, sy, sw, sh, card.x, card.y, card.w, card.imgH);
        } else {
          let dw = card.w;
          let dh = card.imgH;
          if (imgRatio > targetRatio) {
            dh = card.w / imgRatio;
          } else {
            dw = card.imgH * imgRatio;
          }
          const dx = card.x + (card.w - dw) / 2;
          const dy = card.y + (card.imgH - dh) / 2;
          ctx.drawImage(img, dx, dy, dw, dh);
        }
      }

      // Caption bar: below image or overlaid at the bottom edge of image
      if (card.showCaption && card.captionH > 0) {
        const effectiveCapH = isOverlay
          ? Math.min(card.captionH, card.imgH)
          : card.captionH;
        const capY = isOverlay
          ? card.y + card.imgH - effectiveCapH
          : card.y + card.imgH;
        ctx.fillStyle = hexToRgba(app.captionBg, app.captionOpacity);
        ctx.fillRect(card.x, capY, card.w, effectiveCapH);

        ctx.fillStyle = app.captionTextColor;
        ctx.font = `500 ${captionFontSize}px "DM Sans", system-ui, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const capLines = wrapTextLines(
          ctx,
          card.item.caption,
          Math.max(16, card.w - 10 * scale),
          1
        );
        if (capLines[0]) {
          ctx.fillText(capLines[0], card.x + card.w / 2, capY + effectiveCapH / 2);
        }
      }

      ctx.restore();

      // Card subtle border if enabled
      if (borderW > 0) {
        ctx.save();
        drawRoundedRectPath(ctx, card.x, card.y, card.w, card.totalH, cardRadius);
        ctx.strokeStyle = app.borderColor;
        ctx.lineWidth = Math.max(1, borderW * 0.75);
        ctx.stroke();
        ctx.restore();
      }
    }

    ctx.restore();

    // Tier row outer border
    if (borderW > 0) {
      ctx.save();
      drawRoundedRectPath(ctx, outerPad, y, rowWidth, height, tierRadius);
      ctx.strokeStyle = app.borderColor;
      ctx.lineWidth = borderW;
      ctx.stroke();
      ctx.restore();
    }
  }

  return canvas;
}

export async function exportCanvasToBlob(
  canvas: HTMLCanvasElement,
  options: ExportOptions
): Promise<Blob> {
  const mime = options.format === 'jpeg' ? 'image/jpeg' : 'image/png';
  const quality = options.format === 'jpeg' ? options.jpegQuality : undefined;
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) reject(new Error('Не удалось сформировать изображение'));
        else resolve(blob);
      },
      mime,
      quality
    );
  });
}
