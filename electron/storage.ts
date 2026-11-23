import fs from 'fs';
import path from 'path';
import type {
  ProjectSummary,
  TierProject,
  TierTemplate,
} from '../src/core/types';
import { CLASSIC_TEMPLATE, DEFAULT_APPEARANCE } from '../src/core/defaults';

const SAFE_ID_REGEX = /^[a-zA-Z0-9_-]{1,80}$/;

const MIME_TO_EXT: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
};

const EXT_TO_MIME: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
};

export function assertSafeId(id: string, label = 'id'): string {
  if (typeof id !== 'string' || !SAFE_ID_REGEX.test(id)) {
    throw new Error(`Invalid ${label}`);
  }
  return id;
}

export function resolveWithin(baseDir: string, ...segments: string[]): string {
  const normalizedBase = path.resolve(baseDir);
  const resolved = path.resolve(normalizedBase, ...segments);
  if (
    resolved !== normalizedBase &&
    !resolved.startsWith(normalizedBase + path.sep)
  ) {
    throw new Error('Access outside storage directory denied');
  }
  return resolved;
}

async function atomicWriteFile(filePath: string, data: string | Uint8Array): Promise<void> {
  const dir = path.dirname(filePath);
  await fs.promises.mkdir(dir, { recursive: true });
  const tmpPath = `${filePath}.tmp.${process.pid}.${Math.random().toString(36).slice(2, 8)}`;
  await fs.promises.writeFile(tmpPath, data);
  await fs.promises.rename(tmpPath, filePath);
}

export interface StoredAssetResult {
  bytes: Buffer;
  mimeType: string;
}

export class LocalTierStorage {
  private readonly rootDir: string;
  private readonly projectsDir: string;
  private readonly templatesFile: string;
  private readonly seedAssetsSourceDir: string;
  private initialized = false;

  constructor(rootDir: string, seedAssetsSourceDir: string) {
    this.rootDir = path.resolve(rootDir);
    this.projectsDir = resolveWithin(this.rootDir, 'projects');
    this.templatesFile = resolveWithin(this.rootDir, 'templates.json');
    this.seedAssetsSourceDir = path.resolve(seedAssetsSourceDir);
  }

  async ensureInitialized(): Promise<void> {
    if (this.initialized) return;
    await fs.promises.mkdir(this.projectsDir, { recursive: true });

    const seedFlag = resolveWithin(this.rootDir, '.seeded_v1');
    const templatesExists = fs.existsSync(this.templatesFile);
    if (!templatesExists) {
      await atomicWriteFile(
        this.templatesFile,
        JSON.stringify([CLASSIC_TEMPLATE], null, 2)
      );
    }

    if (!fs.existsSync(seedFlag)) {
      const existingProjects = await fs.promises.readdir(this.projectsDir);
      if (existingProjects.length === 0) {
        await this.seedDemoProject();
      }
      await atomicWriteFile(seedFlag, new Date().toISOString());
    }

    this.initialized = true;
  }

  private async seedDemoProject(): Promise<void> {
    const projectId = 'proj_demo_indie';
    const now = new Date().toISOString();

    const demoArtworks = [
      {
        assetId: 'asset_demo_hollow',
        itemId: 'item_demo_hollow',
        caption: 'Hollow Citadel',
        file: 'demo_hollow_citadel_1795461519925.jpg',
        tier: 's',
      },
      {
        assetId: 'asset_demo_celeste',
        itemId: 'item_demo_celeste',
        caption: 'Celeste Peak',
        file: 'demo_celeste_peak_1795461520952.jpg',
        tier: 's',
      },
      {
        assetId: 'asset_demo_hades',
        itemId: 'item_demo_hades',
        caption: 'Hades Escape',
        file: 'demo_hades_escape_1795461519928.jpg',
        tier: 'a',
      },
      {
        assetId: 'asset_demo_disco',
        itemId: 'item_demo_disco',
        caption: 'Disco Harbor',
        file: 'demo_disco_rain_1795461521337.jpg',
        tier: 'a',
      },
      {
        assetId: 'asset_demo_outer',
        itemId: 'item_demo_outer',
        caption: 'Outer Orbit',
        file: 'demo_outer_orbit_1795461521790.jpg',
        tier: 'b',
      },
      {
        assetId: 'asset_demo_stray',
        itemId: 'item_demo_stray',
        caption: 'Neon Stray',
        file: 'demo_cyber_stray_1795461521915.jpg',
        tier: 'unranked',
      },
    ];

    const items: TierProject['items'] = {};
    const assets: TierProject['assets'] = {};
    const tierBuckets: Record<string, string[]> = { s: [], a: [], b: [], unranked: [] };

    for (const art of demoArtworks) {
      const srcPath = path.join(this.seedAssetsSourceDir, art.file);
      if (fs.existsSync(srcPath)) {
        const bytes = await fs.promises.readFile(srcPath);
        await this.saveAsset(projectId, art.assetId, 'image/jpeg', bytes, bytes);
      }

      items[art.itemId] = {
        id: art.itemId,
        assetId: art.assetId,
        fileName: art.file,
        caption: art.caption,
      };
      assets[art.assetId] = {
        assetId: art.assetId,
        mimeType: 'image/jpeg',
        fileName: art.file,
        width: 1024,
        height: 1024,
      };
      tierBuckets[art.tier].push(art.itemId);
    }

    const demoProject: TierProject = {
      id: projectId,
      version: 1,
      name: 'Культовые инди-игры (Демо)',
      createdAt: now,
      updatedAt: now,
      tiers: [
        {
          id: 'tier_s',
          title: 'S',
          description: 'Лучшие из лучших',
          bgColor: '#E55353',
          titleColor: '#0F1115',
          descriptionColor: '#1E2430',
          height: 124,
          itemIds: tierBuckets.s,
        },
        {
          id: 'tier_a',
          title: 'A',
          description: 'Отличный выбор',
          bgColor: '#F08C4B',
          titleColor: '#0F1115',
          descriptionColor: '#1E2430',
          height: 124,
          itemIds: tierBuckets.a,
        },
        {
          id: 'tier_b',
          title: 'B',
          description: 'Хорошие, но не идеальные',
          bgColor: '#EAC54F',
          titleColor: '#0F1115',
          descriptionColor: '#1E2430',
          height: 124,
          itemIds: tierBuckets.b,
        },
        {
          id: 'tier_c',
          title: 'C',
          description: 'Средний уровень',
          bgColor: '#66C266',
          titleColor: '#0F1115',
          descriptionColor: '#1E2430',
          height: 112,
          itemIds: [],
        },
        {
          id: 'tier_d',
          title: 'D',
          description: 'Спорный вариант',
          bgColor: '#5B8DEF',
          titleColor: '#0F1115',
          descriptionColor: '#1E2430',
          height: 112,
          itemIds: [],
        },
      ],
      unrankedIds: tierBuckets.unranked,
      items,
      assets,
      appearance: { ...DEFAULT_APPEARANCE },
    };

    await this.saveProject(demoProject);
  }

  private getProjectDir(projectId: string): string {
    assertSafeId(projectId, 'projectId');
    return resolveWithin(this.projectsDir, projectId);
  }

  async listProjects(): Promise<ProjectSummary[]> {
    await this.ensureInitialized();
    const entries = await fs.promises.readdir(this.projectsDir, { withFileTypes: true });
    const summaries: ProjectSummary[] = [];

    for (const entry of entries) {
      if (!entry.isDirectory() || !SAFE_ID_REGEX.test(entry.name)) continue;
      const projPath = resolveWithin(this.projectsDir, entry.name, 'project.json');
      if (!fs.existsSync(projPath)) continue;
      try {
        const raw = await fs.promises.readFile(projPath, 'utf-8');
        const project = JSON.parse(raw) as TierProject;
        const thumbPath = resolveWithin(this.projectsDir, entry.name, 'thumbnail.png');
        summaries.push({
          id: project.id,
          name: project.name,
          createdAt: project.createdAt,
          updatedAt: project.updatedAt,
          tierCount: project.tiers.length,
          itemCount: Object.keys(project.items).length,
          hasThumbnail: fs.existsSync(thumbPath),
        });
      } catch {
        // Skip unreadable/corrupted directory gracefully
      }
    }

    summaries.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    return summaries;
  }

  async loadProject(projectId: string): Promise<TierProject> {
    await this.ensureInitialized();
    const projPath = resolveWithin(this.getProjectDir(projectId), 'project.json');
    if (!fs.existsSync(projPath)) {
      throw new Error('Проект не найден');
    }
    const raw = await fs.promises.readFile(projPath, 'utf-8');
    return JSON.parse(raw) as TierProject;
  }

  async saveProject(project: TierProject): Promise<void> {
    await this.ensureInitialized();
    const dir = this.getProjectDir(project.id);
    await fs.promises.mkdir(dir, { recursive: true });
    const projPath = resolveWithin(dir, 'project.json');
    await atomicWriteFile(projPath, JSON.stringify(project, null, 2));
  }

  async deleteProject(projectId: string): Promise<void> {
    await this.ensureInitialized();
    const dir = this.getProjectDir(projectId);
    if (fs.existsSync(dir)) {
      await fs.promises.rm(dir, { recursive: true, force: true });
    }
  }

  async duplicateProject(sourceId: string, newId: string, newName: string): Promise<TierProject> {
    await this.ensureInitialized();
    assertSafeId(sourceId, 'sourceId');
    assertSafeId(newId, 'newId');

    const sourceDir = this.getProjectDir(sourceId);
    const targetDir = this.getProjectDir(newId);
    if (!fs.existsSync(sourceDir)) {
      throw new Error('Исходный проект не найден');
    }

    await fs.promises.cp(sourceDir, targetDir, { recursive: true });
    const sourceProj = await this.loadProject(sourceId);
    const now = new Date().toISOString();
    const duplicated: TierProject = {
      ...sourceProj,
      id: newId,
      name: newName,
      createdAt: now,
      updatedAt: now,
    };
    await this.saveProject(duplicated);
    return duplicated;
  }

  async saveAsset(
    projectId: string,
    assetId: string,
    mimeType: string,
    originalBytes: Uint8Array,
    thumbBytes?: Uint8Array,
    thumbMimeType?: string
  ): Promise<void> {
    assertSafeId(assetId, 'assetId');
    const projDir = this.getProjectDir(projectId);
    const ext = MIME_TO_EXT[mimeType] || 'png';
    const assetsDir = resolveWithin(projDir, 'assets');
    const thumbsDir = resolveWithin(projDir, 'thumbs');
    await fs.promises.mkdir(assetsDir, { recursive: true });
    await fs.promises.mkdir(thumbsDir, { recursive: true });

    const origPath = resolveWithin(assetsDir, `${assetId}.${ext}`);
    await atomicWriteFile(origPath, originalBytes);

    const tBytes = thumbBytes ?? originalBytes;
    const tExt = MIME_TO_EXT[thumbMimeType ?? mimeType] || ext;
    const thumbPath = resolveWithin(thumbsDir, `${assetId}.${tExt}`);
    await atomicWriteFile(thumbPath, tBytes);
  }

  async readAsset(
    projectId: string,
    assetId: string,
    variant: 'orig' | 'thumb'
  ): Promise<StoredAssetResult | null> {
    assertSafeId(assetId, 'assetId');
    const projDir = this.getProjectDir(projectId);
    const folder = variant === 'thumb' ? 'thumbs' : 'assets';
    const targetDir = resolveWithin(projDir, folder);

    if (fs.existsSync(targetDir)) {
      const files = await fs.promises.readdir(targetDir);
      const match = files.find((f) => f.startsWith(`${assetId}.`));
      if (match) {
        const fullPath = resolveWithin(targetDir, match);
        const bytes = await fs.promises.readFile(fullPath);
        const ext = path.extname(match).toLowerCase();
        return {
          bytes,
          mimeType: EXT_TO_MIME[ext] || 'application/octet-stream',
        };
      }
    }

    // Fallback from thumb to orig if thumb is absent
    if (variant === 'thumb') {
      return this.readAsset(projectId, assetId, 'orig');
    }
    return null;
  }

  async saveProjectThumbnail(projectId: string, pngBytes: Uint8Array): Promise<void> {
    const projDir = this.getProjectDir(projectId);
    const thumbPath = resolveWithin(projDir, 'thumbnail.png');
    await atomicWriteFile(thumbPath, pngBytes);
  }

  async readProjectThumbnail(projectId: string): Promise<Buffer | null> {
    const projDir = this.getProjectDir(projectId);
    const thumbPath = resolveWithin(projDir, 'thumbnail.png');
    if (!fs.existsSync(thumbPath)) return null;
    return fs.promises.readFile(thumbPath);
  }

  async listTemplates(): Promise<TierTemplate[]> {
    await this.ensureInitialized();
    try {
      const raw = await fs.promises.readFile(this.templatesFile, 'utf-8');
      const parsed = JSON.parse(raw) as TierTemplate[];
      return Array.isArray(parsed) && parsed.length > 0 ? parsed : [CLASSIC_TEMPLATE];
    } catch {
      return [CLASSIC_TEMPLATE];
    }
  }

  async saveTemplate(template: TierTemplate): Promise<TierTemplate[]> {
    assertSafeId(template.id, 'templateId');
    const list = await this.listTemplates();
    const existingIdx = list.findIndex((t) => t.id === template.id);
    const next = [...list];
    if (existingIdx >= 0) {
      next[existingIdx] = template;
    } else {
      next.push(template);
    }
    await atomicWriteFile(this.templatesFile, JSON.stringify(next, null, 2));
    return next;
  }

  async deleteTemplate(templateId: string): Promise<TierTemplate[]> {
    assertSafeId(templateId, 'templateId');
    const list = await this.listTemplates();
    const next = list.filter((t) => t.id !== templateId || t.isBuiltIn);
    await atomicWriteFile(this.templatesFile, JSON.stringify(next, null, 2));
    return next;
  }
}
