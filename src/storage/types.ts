import type { ProjectSummary, TierProject, TierTemplate } from '../core/types';

export interface FileFilter {
  name: string;
  extensions: string[];
}

export interface StorageBridge {
  readonly isElectron: boolean;
  listProjects(): Promise<ProjectSummary[]>;
  loadProject(id: string): Promise<TierProject>;
  saveProject(project: TierProject): Promise<void>;
  beaconFlushProject(project: TierProject): void;
  deleteProject(id: string): Promise<void>;
  duplicateProject(sourceId: string, newId: string, newName: string): Promise<TierProject>;
  saveAsset(
    projectId: string,
    assetId: string,
    mimeType: string,
    originalBytes: Uint8Array,
    thumbBytes?: Uint8Array,
    thumbMimeType?: string
  ): Promise<void>;
  readAssetBytes(
    projectId: string,
    assetId: string
  ): Promise<{ mimeType: string; bytes: Uint8Array } | null>;
  getAssetUrl(projectId: string, assetId: string, variant: 'thumb' | 'orig'): string;
  saveProjectThumbnail(projectId: string, pngBytes: Uint8Array): Promise<void>;
  getProjectThumbnailUrl(projectId: string, cacheBust?: string): string;
  listTemplates(): Promise<TierTemplate[]>;
  saveTemplate(template: TierTemplate): Promise<TierTemplate[]>;
  deleteTemplate(templateId: string): Promise<TierTemplate[]>;
  saveExportFile(
    defaultName: string,
    filters: FileFilter[],
    bytes: Uint8Array,
    mimeType: string
  ): Promise<boolean>;
  onFlushBeforeClose(callback: () => Promise<void>): () => void;
}
