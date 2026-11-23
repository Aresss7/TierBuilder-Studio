import type { StorageBridge } from './types';

export function createElectronBridge(): StorageBridge {
  const api = window.electronAPI!;

  return {
    isElectron: true,
    listProjects: () => api.listProjects(),
    loadProject: (id) => api.loadProject(id),
    saveProject: (project) => api.saveProject(project),
    beaconFlushProject: (project) => {
      void api.saveProject(project);
    },
    deleteProject: (id) => api.deleteProject(id),
    duplicateProject: (sourceId, newId, newName) =>
      api.duplicateProject(sourceId, newId, newName),
    saveAsset: (projectId, assetId, mimeType, originalBytes, thumbBytes, thumbMimeType) =>
      api.saveAsset({
        projectId,
        assetId,
        mimeType,
        originalBytes,
        thumbBytes,
        thumbMimeType,
      }),
    readAssetBytes: (projectId, assetId) => api.readAssetBytes(projectId, assetId),
    getAssetUrl: (projectId, assetId, variant) =>
      `tiercraft-asset://media/${encodeURIComponent(projectId)}/${variant}/${encodeURIComponent(assetId)}`,
    saveProjectThumbnail: (projectId, pngBytes) =>
      api.saveProjectThumbnail(projectId, pngBytes),
    getProjectThumbnailUrl: (projectId, cacheBust) =>
      `tiercraft-asset://thumb/${encodeURIComponent(projectId)}${
        cacheBust ? `?v=${encodeURIComponent(cacheBust)}` : ''
      }`,
    listTemplates: () => api.listTemplates(),
    saveTemplate: (template) => api.saveTemplate(template),
    deleteTemplate: (templateId) => api.deleteTemplate(templateId),
    saveExportFile: (defaultName, filters, bytes) =>
      api.saveFileDialog({ defaultName, filters, bytes }),
    onFlushBeforeClose: (callback) => api.onFlushBeforeClose(callback),
  };
}
