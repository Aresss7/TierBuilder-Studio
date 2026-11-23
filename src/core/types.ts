export type ImageFitMode = 'cover' | 'contain';

export interface AppearanceConfig {
  canvasBg: string;
  tierGap: number;
  itemGap: number;
  labelColumnWidth: number;
  defaultCardWidth: number;
  defaultCardHeight: number;
  imageFit: ImageFitMode;
  tierRadius: number;
  cardRadius: number;
  borderWidth: number;
  borderColor: string;
  captionsEnabled: boolean;
  captionBg: string;
  captionOpacity: number; // 0..100
  captionTextColor: string;
}

export interface TierRow {
  id: string;
  title: string;
  description: string;
  bgColor: string;
  titleColor: string;
  descriptionColor: string;
  height: number; // manual min-height in px (applies even when empty)
  itemIds: string[];
}

export interface TierItem {
  id: string;
  assetId: string;
  fileName: string;
  caption: string;
  showCaption?: boolean; // undefined = inherit appearance.captionsEnabled
  customWidth?: number;
  customHeight?: number;
}

export interface AssetMeta {
  assetId: string;
  mimeType: string;
  fileName: string;
  width: number;
  height: number;
}

export interface TierProject {
  id: string;
  version: 1;
  name: string;
  createdAt: string;
  updatedAt: string;
  tiers: TierRow[];
  unrankedIds: string[];
  items: Record<string, TierItem>;
  assets: Record<string, AssetMeta>;
  appearance: AppearanceConfig;
}

export interface ProjectSummary {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  tierCount: number;
  itemCount: number;
  hasThumbnail: boolean;
}

export interface TierTemplateRow {
  id: string;
  title: string;
  description: string;
  bgColor: string;
  titleColor: string;
  descriptionColor: string;
  height: number;
}

export interface TierTemplate {
  id: string;
  name: string;
  createdAt: string;
  isBuiltIn?: boolean;
  tiers: TierTemplateRow[];
  appearance: AppearanceConfig;
}

export interface TierlistPackageManifest {
  format: 'tiercraft-package';
  version: 1;
  exportedAt: string;
  app: 'TierCraft Studio';
  projectName: string;
}

export interface TierlistBackupJSON {
  format: 'tiercraft-backup';
  version: 1;
  exportedAt: string;
  project: TierProject;
  embeddedAssets: Record<
    string,
    {
      mimeType: string;
      fileName: string;
      dataUrl: string;
    }
  >;
}

export interface ExportOptions {
  format: 'png' | 'jpeg';
  width: number;
  jpegQuality: number; // 0.1..1.0
}

export type SaveStatus = 'saved' | 'dirty' | 'saving' | 'error';

export type SelectionTarget =
  | { type: 'appearance' }
  | { type: 'tier'; tierId: string }
  | { type: 'item'; itemId: string };
