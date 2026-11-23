import type { ProjectSummary, TierProject, TierTemplate } from '../core/types';

export interface ElectronAPI {
  listProjects: () => Promise<ProjectSummary[]>;
  loadProject: (id: string) => Promise<TierProject>;
  saveProject: (project: TierProject) => Promise<void>;
  deleteProject: (id: string) => Promise<void>;
  duplicateProject: (sourceId: string, newId: string, newName: string) => Promise<TierProject>;
  saveAsset: (payload: {
    projectId: string;
    assetId: string;
    mimeType: string;
    originalBytes: Uint8Array;
    thumbBytes?: Uint8Array;
    thumbMimeType?: string;
  }) => Promise<void>;
  readAssetBytes: (
    projectId: string,
    assetId: string
  ) => Promise<{ mimeType: string; bytes: Uint8Array } | null>;
  saveProjectThumbnail: (projectId: string, pngBytes: Uint8Array) => Promise<void>;
  listTemplates: () => Promise<TierTemplate[]>;
  saveTemplate: (tpl: TierTemplate) => Promise<TierTemplate[]>;
  deleteTemplate: (id: string) => Promise<TierTemplate[]>;
  saveFileDialog: (payload: {
    defaultName: string;
    filters: Array<{ name: string; extensions: string[] }>;
    bytes: Uint8Array;
  }) => Promise<boolean>;
  openFileDialog: (payload: {
    filters: Array<{ name: string; extensions: string[] }>;
  }) => Promise<{ fileName: string; bytes: Uint8Array } | null>;
  onFlushBeforeClose: (callback: () => Promise<void>) => () => void;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}
