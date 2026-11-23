import { processImageFile } from './imageOptimizer';
import {
  PackagedAssetEntry,
  packTierlistArchive,
  parseJsonBackup,
  serializeJsonBackup,
  unpackTierlistArchive,
} from './packageFormat';
import type { TierProject } from './types';
import type { StorageBridge } from '../storage';

function sanitizeFileBase(name: string): string {
  return name.replace(/[<>:"/\\|?*]+/g, '_').trim() || 'tier-list';
}

async function collectProjectAssets(
  bridge: StorageBridge,
  project: TierProject
): Promise<PackagedAssetEntry[]> {
  const assetIds = Object.keys(project.assets);
  const results = await Promise.all(
    assetIds.map(async (assetId) => {
      const meta = project.assets[assetId];
      const loaded = await bridge.readAssetBytes(project.id, assetId);
      if (!loaded) return null;
      return {
        assetId,
        mimeType: meta?.mimeType || loaded.mimeType,
        fileName: meta?.fileName || `${assetId}.png`,
        bytes: loaded.bytes,
      } satisfies PackagedAssetEntry;
    })
  );
  return results.filter((x): x is PackagedAssetEntry => x !== null);
}

export async function exportProjectTierlistFile(
  bridge: StorageBridge,
  project: TierProject,
  thumbnailPng?: Uint8Array | null
): Promise<boolean> {
  const assets = await collectProjectAssets(bridge, project);
  const zipBytes = packTierlistArchive(project, assets, thumbnailPng);
  const fileName = `${sanitizeFileBase(project.name)}.tierlist`;
  return bridge.saveExportFile(
    fileName,
    [{ name: 'Пакет TierCraft (.tierlist)', extensions: ['tierlist'] }],
    zipBytes,
    'application/octet-stream'
  );
}

export async function exportProjectJsonBackup(
  bridge: StorageBridge,
  project: TierProject
): Promise<boolean> {
  const assets = await collectProjectAssets(bridge, project);
  const jsonText = serializeJsonBackup(project, assets);
  const bytes = new TextEncoder().encode(jsonText);
  const fileName = `${sanitizeFileBase(project.name)}.backup.json`;
  return bridge.saveExportFile(
    fileName,
    [{ name: 'Резервная копия JSON (.json)', extensions: ['json'] }],
    bytes,
    'application/json'
  );
}

export async function importProjectFromFile(
  bridge: StorageBridge,
  file: File
): Promise<TierProject> {
  const lower = file.name.toLowerCase();
  let importedProject: TierProject;
  let assets: PackagedAssetEntry[];
  let thumbnailPng: Uint8Array | null = null;

  if (lower.endsWith('.tierlist')) {
    const buffer = new Uint8Array(await file.arrayBuffer());
    const unpacked = unpackTierlistArchive(buffer);
    importedProject = unpacked.project;
    assets = unpacked.assets;
    thumbnailPng = unpacked.thumbnailPng;
  } else if (lower.endsWith('.json')) {
    const text = await file.text();
    const parsed = parseJsonBackup(text);
    importedProject = parsed.project;
    assets = parsed.assets;
  } else {
    throw new Error('Поддерживаются только файлы .tierlist и .json');
  }

  await bridge.saveProject(importedProject);

  // Restore all original assets & regenerate optimized thumbnails for fast editor rendering
  for (const asset of assets) {
    try {
      const copy = new Uint8Array(asset.bytes);
      const blob = new Blob([copy.buffer], { type: asset.mimeType });
      const fileObj = new File([blob], asset.fileName, { type: asset.mimeType });
      const processed = await processImageFile(fileObj);
      await bridge.saveAsset(
        importedProject.id,
        asset.assetId,
        processed.mimeType,
        processed.originalBytes,
        processed.thumbnailBytes,
        processed.thumbnailMimeType
      );
    } catch {
      await bridge.saveAsset(
        importedProject.id,
        asset.assetId,
        asset.mimeType,
        asset.bytes
      );
    }
  }

  if (thumbnailPng && thumbnailPng.length > 0) {
    await bridge.saveProjectThumbnail(importedProject.id, thumbnailPng);
  }

  return importedProject;
}
