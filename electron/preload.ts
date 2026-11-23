import { contextBridge, ipcRenderer } from 'electron';
import type { TierProject, TierTemplate } from '../src/core/types';

contextBridge.exposeInMainWorld('electronAPI', {
  listProjects: () => ipcRenderer.invoke('tiercraft:listProjects'),
  loadProject: (id: string) => ipcRenderer.invoke('tiercraft:loadProject', id),
  saveProject: (project: TierProject) => ipcRenderer.invoke('tiercraft:saveProject', project),
  deleteProject: (id: string) => ipcRenderer.invoke('tiercraft:deleteProject', id),
  duplicateProject: (sourceId: string, newId: string, newName: string) =>
    ipcRenderer.invoke('tiercraft:duplicateProject', sourceId, newId, newName),
  saveAsset: (payload: {
    projectId: string;
    assetId: string;
    mimeType: string;
    originalBytes: Uint8Array;
    thumbBytes?: Uint8Array;
    thumbMimeType?: string;
  }) => ipcRenderer.invoke('tiercraft:saveAsset', payload),
  readAssetBytes: (projectId: string, assetId: string) =>
    ipcRenderer.invoke('tiercraft:readAssetBytes', projectId, assetId),
  saveProjectThumbnail: (projectId: string, pngBytes: Uint8Array) =>
    ipcRenderer.invoke('tiercraft:saveProjectThumbnail', projectId, pngBytes),
  listTemplates: () => ipcRenderer.invoke('tiercraft:listTemplates'),
  saveTemplate: (tpl: TierTemplate) => ipcRenderer.invoke('tiercraft:saveTemplate', tpl),
  deleteTemplate: (id: string) => ipcRenderer.invoke('tiercraft:deleteTemplate', id),
  saveFileDialog: (payload: {
    defaultName: string;
    filters: Array<{ name: string; extensions: string[] }>;
    bytes: Uint8Array;
  }) => ipcRenderer.invoke('tiercraft:saveFileDialog', payload),
  openFileDialog: (payload: {
    filters: Array<{ name: string; extensions: string[] }>;
  }) => ipcRenderer.invoke('tiercraft:openFileDialog', payload),
  onFlushBeforeClose: (callback: () => Promise<void>) => {
    const handler = async () => {
      try {
        await callback();
      } finally {
        ipcRenderer.send('tiercraft:flush-complete');
      }
    };
    ipcRenderer.on('tiercraft:request-flush', handler);
    return () => {
      ipcRenderer.removeListener('tiercraft:request-flush', handler);
    };
  },
});
