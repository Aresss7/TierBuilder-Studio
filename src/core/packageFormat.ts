import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate';
import { createUid, DEFAULT_APPEARANCE } from './defaults';
import { inferMimeFromName } from './imageOptimizer';
import {
  TierlistBackupJSON,
  TierlistPackageManifest,
  TierProject,
} from './types';

export interface PackagedAssetEntry {
  assetId: string;
  mimeType: string;
  fileName: string;
  bytes: Uint8Array;
}

const SAFE_ID_REGEX = /^[a-zA-Z0-9_-]{1,80}$/;

function extFromMime(mime: string, fileName: string): string {
  if (mime === 'image/jpeg') return 'jpg';
  if (mime === 'image/webp') return 'webp';
  if (mime === 'image/gif') return 'gif';
  if (mime === 'image/png') return 'png';
  const m = fileName.toLowerCase().match(/\.(png|jpe?g|webp|gif)$/);
  if (m) return m[1] === 'jpeg' ? 'jpg' : m[1];
  return 'png';
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const slice = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...slice);
  }
  return btoa(binary);
}

function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * Packs a project and all its original images into a portable .tierlist ZIP archive.
 */
export function packTierlistArchive(
  project: TierProject,
  assets: PackagedAssetEntry[],
  thumbnailPng?: Uint8Array | null
): Uint8Array {
  const manifest: TierlistPackageManifest = {
    format: 'tierbuilder-package',
    version: 1,
    exportedAt: new Date().toISOString(),
    app: 'TierBuilder Studio',
    projectName: project.name,
  };

  const files: Record<string, Uint8Array> = {
    'manifest.json': strToU8(JSON.stringify(manifest, null, 2)),
    'project.json': strToU8(JSON.stringify(project, null, 2)),
  };

  if (thumbnailPng && thumbnailPng.length > 0) {
    files['thumbnail.png'] = thumbnailPng;
  }

  for (const asset of assets) {
    const ext = extFromMime(asset.mimeType, asset.fileName);
    files[`assets/${asset.assetId}.${ext}`] = asset.bytes;
  }

  return zipSync(files, { level: 1 });
}

/**
 * Unpacks and validates a .tierlist archive, assigning fresh project IDs so
 * importing never overwrites existing user projects silently.
 */
export function unpackTierlistArchive(archiveBytes: Uint8Array): {
  project: TierProject;
  assets: PackagedAssetEntry[];
  thumbnailPng: Uint8Array | null;
} {
  const entries = unzipSync(archiveBytes);
  const manifestRaw = entries['manifest.json'];
  const projectRaw = entries['project.json'];

  if (!manifestRaw || !projectRaw) {
    throw new Error('Повреждённый файл .tierlist: отсутствуют manifest.json или project.json');
  }

  const manifest = JSON.parse(strFromU8(manifestRaw)) as Partial<TierlistPackageManifest>;
  if (
    manifest.format !== 'tierbuilder-package' &&
    manifest.format !== 'tiercraft-package'
  ) {
    throw new Error('Неподдерживаемый формат пакета .tierlist');
  }

  const parsedProject = validateAndNormalizeProject(JSON.parse(strFromU8(projectRaw)));
  const newProjectId = createUid('proj');
  const now = new Date().toISOString();

  const assets: PackagedAssetEntry[] = [];
  for (const [entryPath, fileBytes] of Object.entries(entries)) {
    if (!entryPath.startsWith('assets/')) continue;
    // Security: block path traversal inside ZIP
    if (entryPath.includes('..') || entryPath.includes('\\')) continue;
    const baseName = entryPath.slice('assets/'.length);
    const dotIdx = baseName.lastIndexOf('.');
    const assetId = dotIdx > 0 ? baseName.slice(0, dotIdx) : baseName;
    if (!SAFE_ID_REGEX.test(assetId)) continue;

    const meta = parsedProject.assets[assetId];
    const fileName = meta?.fileName || baseName;
    const mimeType = meta?.mimeType || inferMimeFromName(baseName);
    assets.push({
      assetId,
      mimeType,
      fileName,
      bytes: fileBytes,
    });
  }

  const thumbnailPng = entries['thumbnail.png'] ?? null;

  return {
    project: {
      ...parsedProject,
      id: newProjectId,
      createdAt: parsedProject.createdAt || now,
      updatedAt: now,
    },
    assets,
    thumbnailPng,
  };
}

/**
 * Serializes a complete project with embedded Base64 images to a JSON backup string.
 */
export function serializeJsonBackup(
  project: TierProject,
  assets: PackagedAssetEntry[]
): string {
  const embeddedAssets: TierlistBackupJSON['embeddedAssets'] = {};
  for (const asset of assets) {
    const b64 = bytesToBase64(asset.bytes);
    embeddedAssets[asset.assetId] = {
      mimeType: asset.mimeType,
      fileName: asset.fileName,
      dataUrl: `data:${asset.mimeType};base64,${b64}`,
    };
  }

  const backup: TierlistBackupJSON = {
    format: 'tierbuilder-backup',
    version: 1,
    exportedAt: new Date().toISOString(),
    project,
    embeddedAssets,
  };
  return JSON.stringify(backup, null, 2);
}

/**
 * Parses and validates a .json backup file, restoring structure, captions,
 * custom sizes, and embedded images.
 */
export function parseJsonBackup(rawJson: string): {
  project: TierProject;
  assets: PackagedAssetEntry[];
} {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawJson);
  } catch {
    throw new Error('Файл JSON повреждён или содержит синтаксическую ошибку.');
  }

  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Некорректная структура резервной копии JSON.');
  }

  const obj = parsed as Partial<TierlistBackupJSON>;
  if (
    (obj.format !== 'tierbuilder-backup' && obj.format !== 'tiercraft-backup') ||
    !obj.project
  ) {
    throw new Error('Файл не является резервной копией TierBuilder Studio.');
  }

  const normalizedProject = validateAndNormalizeProject(obj.project);
  const assets: PackagedAssetEntry[] = [];

  if (obj.embeddedAssets && typeof obj.embeddedAssets === 'object') {
    for (const [assetId, entry] of Object.entries(obj.embeddedAssets)) {
      if (!SAFE_ID_REGEX.test(assetId)) continue;
      if (!entry || typeof entry.dataUrl !== 'string') continue;

      const match = entry.dataUrl.match(
        /^data:(image\/(?:png|jpeg|webp|gif));base64,([A-Za-z0-9+/=]+)$/
      );
      if (!match) continue;

      const mimeType = match[1];
      const bytes = base64ToBytes(match[2]);
      assets.push({
        assetId,
        mimeType,
        fileName: typeof entry.fileName === 'string' ? entry.fileName : `${assetId}.png`,
        bytes,
      });
    }
  }

  const now = new Date().toISOString();
  return {
    project: {
      ...normalizedProject,
      id: createUid('proj'),
      updatedAt: now,
    },
    assets,
  };
}

function validateAndNormalizeProject(raw: unknown): TierProject {
  if (!raw || typeof raw !== 'object') {
    throw new Error('Некорректный формат проекта.');
  }
  const p = raw as Partial<TierProject>;
  if (!Array.isArray(p.tiers) || typeof p.items !== 'object' || !p.items) {
    throw new Error('В файле отсутствуют данные тиров или элементов.');
  }

  return {
    id: typeof p.id === 'string' && SAFE_ID_REGEX.test(p.id) ? p.id : createUid('proj'),
    version: 1,
    name: typeof p.name === 'string' && p.name.trim() ? p.name.trim() : 'Импортированный тир-лист',
    createdAt: typeof p.createdAt === 'string' ? p.createdAt : new Date().toISOString(),
    updatedAt: typeof p.updatedAt === 'string' ? p.updatedAt : new Date().toISOString(),
    tiers: p.tiers.map((t) => ({
      id: typeof t.id === 'string' ? t.id : createUid('tier'),
      title: typeof t.title === 'string' ? t.title : 'Тир',
      description: typeof t.description === 'string' ? t.description : '',
      bgColor: typeof t.bgColor === 'string' ? t.bgColor : '#64748B',
      titleColor: typeof t.titleColor === 'string' ? t.titleColor : '#0F1115',
      descriptionColor: typeof t.descriptionColor === 'string' ? t.descriptionColor : '#1E2430',
      height: typeof t.height === 'number' && t.height >= 48 ? t.height : 112,
      itemIds: Array.isArray(t.itemIds) ? t.itemIds.filter((x) => typeof x === 'string') : [],
    })),
    unrankedIds: Array.isArray(p.unrankedIds)
      ? p.unrankedIds.filter((x) => typeof x === 'string')
      : [],
    items: p.items,
    assets: p.assets && typeof p.assets === 'object' ? p.assets : {},
    appearance: {
      ...DEFAULT_APPEARANCE,
      ...(p.appearance && typeof p.appearance === 'object' ? p.appearance : {}),
    },
  };
}
