import { AppearanceConfig, TierProject, TierTemplate, TierTemplateRow } from './types';

export function createUid(prefix = 'id'): string {
  const rand = Math.random().toString(36).slice(2, 9);
  const time = Date.now().toString(36);
  return `${prefix}_${time}_${rand}`;
}

export const DEFAULT_APPEARANCE: AppearanceConfig = {
  canvasBg: '#12151B',
  tierGap: 8,
  itemGap: 8,
  labelColumnWidth: 136,
  defaultCardWidth: 100,
  defaultCardHeight: 100,
  imageFit: 'cover',
  tierRadius: 8,
  cardRadius: 6,
  borderWidth: 1,
  borderColor: '#272C38',
  captionsEnabled: true,
  captionBg: '#0B0D11',
  captionOpacity: 82,
  captionTextColor: '#F1F5F9',
};

export const CLASSIC_TIER_PRESETS: TierTemplateRow[] = [
  {
    id: 'tier_s',
    title: 'S',
    description: 'Лучшие из лучших',
    bgColor: '#E55353',
    titleColor: '#0F1115',
    descriptionColor: '#1E2430',
    height: 112,
  },
  {
    id: 'tier_a',
    title: 'A',
    description: 'Отличный выбор',
    bgColor: '#F08C4B',
    titleColor: '#0F1115',
    descriptionColor: '#1E2430',
    height: 112,
  },
  {
    id: 'tier_b',
    title: 'B',
    description: 'Хорошие, но не идеальные',
    bgColor: '#EAC54F',
    titleColor: '#0F1115',
    descriptionColor: '#1E2430',
    height: 112,
  },
  {
    id: 'tier_c',
    title: 'C',
    description: 'Средний уровень',
    bgColor: '#66C266',
    titleColor: '#0F1115',
    descriptionColor: '#1E2430',
    height: 112,
  },
  {
    id: 'tier_d',
    title: 'D',
    description: 'Спорный вариант',
    bgColor: '#5B8DEF',
    titleColor: '#0F1115',
    descriptionColor: '#1E2430',
    height: 112,
  },
];

export const CLASSIC_TEMPLATE: TierTemplate = {
  id: 'tpl_classic_sd',
  name: 'Классический (S–D)',
  createdAt: '2026-01-01T00:00:00.000Z',
  isBuiltIn: true,
  tiers: CLASSIC_TIER_PRESETS,
  appearance: DEFAULT_APPEARANCE,
};

export function createProjectFromTemplate(
  name: string,
  template: TierTemplate = CLASSIC_TEMPLATE
): TierProject {
  const now = new Date().toISOString();
  return {
    id: createUid('proj'),
    version: 1,
    name: name.trim() || 'Новый тир-лист',
    createdAt: now,
    updatedAt: now,
    tiers: template.tiers.map((t) => ({
      ...t,
      id: createUid('tier'),
      itemIds: [],
    })),
    unrankedIds: [],
    items: {},
    assets: {},
    appearance: { ...template.appearance },
  };
}

export const TIER_COLOR_SWATCHES = [
  '#E55353',
  '#F08C4B',
  '#EAC54F',
  '#66C266',
  '#3AB795',
  '#5B8DEF',
  '#8B6CE8',
  '#D966B3',
  '#64748B',
  '#334155',
];
