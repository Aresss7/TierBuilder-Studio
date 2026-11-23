import type { ProjectSummary, TierProject, TierTemplate } from '../core/types';
import type { StorageBridge } from './types';

async function checkJson<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let message = `Ошибка сервера (${res.status})`;
    try {
      const body = (await res.json()) as { error?: string };
      if (body?.error) message = body.error;
    } catch {
      // keep fallback message
    }
    throw new Error(message);
  }
  return res.json() as Promise<T>;
}

export function createWebBridge(): StorageBridge {
  return {
    isElectron: false,

    async listProjects(): Promise<ProjectSummary[]> {
      const res = await fetch('/api/projects');
      return checkJson<ProjectSummary[]>(res);
    },

    async loadProject(id: string): Promise<TierProject> {
      const res = await fetch(`/api/projects/${encodeURIComponent(id)}`);
      return checkJson<TierProject>(res);
    },

    async saveProject(project: TierProject): Promise<void> {
      const res = await fetch(`/api/projects/${encodeURIComponent(project.id)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(project),
      });
      await checkJson(res);
    },

    beaconFlushProject(project: TierProject): void {
      try {
        const blob = new Blob([JSON.stringify(project)], { type: 'application/json' });
        if (navigator.sendBeacon) {
          navigator.sendBeacon(
            `/api/projects/${encodeURIComponent(project.id)}/beacon`,
            blob
          );
        }
      } catch {
        // Ignore best-effort beacon errors during page teardown
      }
    },

    async deleteProject(id: string): Promise<void> {
      const res = await fetch(`/api/projects/${encodeURIComponent(id)}`, {
        method: 'DELETE',
      });
      await checkJson(res);
    },

    async duplicateProject(
      sourceId: string,
      newId: string,
      newName: string
    ): Promise<TierProject> {
      const res = await fetch(`/api/projects/${encodeURIComponent(sourceId)}/duplicate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newId, newName }),
      });
      return checkJson<TierProject>(res);
    },

    async saveAsset(
      projectId: string,
      assetId: string,
      mimeType: string,
      originalBytes: Uint8Array,
      thumbBytes?: Uint8Array,
      thumbMimeType?: string
    ): Promise<void> {
      const tBytes = thumbBytes ?? new Uint8Array(0);
      const combined = new Uint8Array(originalBytes.length + tBytes.length);
      combined.set(originalBytes, 0);
      if (tBytes.length > 0) {
        combined.set(tBytes, originalBytes.length);
      }

      const res = await fetch(
        `/api/projects/${encodeURIComponent(projectId)}/assets/${encodeURIComponent(assetId)}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/octet-stream',
            'X-Asset-Mime': mimeType,
            'X-Thumb-Mime': thumbMimeType ?? mimeType,
            'X-Orig-Length': String(originalBytes.length),
          },
          body: combined,
        }
      );
      await checkJson(res);
    },

    async readAssetBytes(projectId: string, assetId: string) {
      const res = await fetch(
        `/api/projects/${encodeURIComponent(projectId)}/assets/orig/${encodeURIComponent(assetId)}`
      );
      if (!res.ok) return null;
      const mimeType = res.headers.get('Content-Type') || 'image/png';
      const buf = await res.arrayBuffer();
      return { mimeType, bytes: new Uint8Array(buf) };
    },

    getAssetUrl(projectId: string, assetId: string, variant: 'thumb' | 'orig'): string {
      return `/api/projects/${encodeURIComponent(projectId)}/assets/${variant}/${encodeURIComponent(assetId)}`;
    },

    async saveProjectThumbnail(projectId: string, pngBytes: Uint8Array): Promise<void> {
      const copy = new Uint8Array(pngBytes);
      const res = await fetch(`/api/projects/${encodeURIComponent(projectId)}/thumbnail`, {
        method: 'POST',
        headers: { 'Content-Type': 'image/png' },
        body: copy.buffer,
      });
      await checkJson(res);
    },

    getProjectThumbnailUrl(projectId: string, cacheBust?: string): string {
      return `/api/projects/${encodeURIComponent(projectId)}/thumbnail${
        cacheBust ? `?v=${encodeURIComponent(cacheBust)}` : ''
      }`;
    },

    async listTemplates(): Promise<TierTemplate[]> {
      const res = await fetch('/api/templates');
      return checkJson<TierTemplate[]>(res);
    },

    async saveTemplate(template: TierTemplate): Promise<TierTemplate[]> {
      const res = await fetch('/api/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(template),
      });
      return checkJson<TierTemplate[]>(res);
    },

    async deleteTemplate(templateId: string): Promise<TierTemplate[]> {
      const res = await fetch(`/api/templates/${encodeURIComponent(templateId)}`, {
        method: 'DELETE',
      });
      return checkJson<TierTemplate[]>(res);
    },

    async saveExportFile(
      defaultName: string,
      _filters,
      bytes: Uint8Array,
      mimeType: string
    ): Promise<boolean> {
      const copy = new Uint8Array(bytes);
      const blob = new Blob([copy.buffer], { type: mimeType });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = defaultName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      return true;
    },

    onFlushBeforeClose(): () => void {
      return () => {};
    },
  };
}
