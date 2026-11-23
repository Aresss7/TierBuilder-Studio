import { createUid, DEFAULT_APPEARANCE } from './defaults';
import {
  AppearanceConfig,
  AssetMeta,
  TierItem,
  TierProject,
  TierRow,
  TierTemplate,
} from './types';

export type ProjectAction =
  | { type: 'RESET_PROJECT'; project: TierProject }
  | { type: 'RENAME_PROJECT'; name: string }
  | { type: 'UPDATE_APPEARANCE'; patch: Partial<AppearanceConfig> }
  | { type: 'RESET_APPEARANCE_DEFAULTS' }
  | { type: 'ADD_TIER'; tier?: Partial<TierRow> }
  | { type: 'UPDATE_TIER'; tierId: string; patch: Partial<Omit<TierRow, 'id' | 'itemIds'>> }
  | { type: 'DELETE_TIER'; tierId: string; moveItemsToUnranked: boolean }
  | { type: 'CLEAR_TIER'; tierId: string }
  | { type: 'REORDER_TIERS'; fromIndex: number; toIndex: number }
  | { type: 'MOVE_TIER_STEP'; tierId: string; direction: -1 | 1 }
  | {
      type: 'ADD_ITEMS';
      items: Array<{ item: TierItem; asset: AssetMeta }>;
      targetTierId?: string | null;
    }
  | {
      type: 'MOVE_ITEM';
      itemId: string;
      sourceContainer: string; // 'unranked' or tierId
      targetContainer: string; // 'unranked' or tierId
      targetIndex: number;
    }
  | { type: 'UPDATE_ITEM'; itemId: string; patch: Partial<Omit<TierItem, 'id' | 'assetId'>> }
  | { type: 'DELETE_ITEM'; itemId: string }
  | { type: 'RESET_ALL_TO_UNRANKED' }
  | { type: 'RESET_ALL_CUSTOM_SIZES' }
  | { type: 'APPLY_TEMPLATE'; template: TierTemplate };

export function applyProjectAction(state: TierProject, action: ProjectAction): TierProject {
  const now = new Date().toISOString();

  switch (action.type) {
    case 'RESET_PROJECT':
      return action.project;

    case 'RENAME_PROJECT':
      return {
        ...state,
        name: action.name,
        updatedAt: now,
      };

    case 'UPDATE_APPEARANCE':
      return {
        ...state,
        appearance: {
          ...state.appearance,
          ...action.patch,
        },
        updatedAt: now,
      };

    case 'RESET_APPEARANCE_DEFAULTS':
      return {
        ...state,
        appearance: { ...DEFAULT_APPEARANCE },
        updatedAt: now,
      };

    case 'ADD_TIER': {
      const nextTier: TierRow = {
        id: createUid('tier'),
        title: action.tier?.title ?? 'Новый тир',
        description: action.tier?.description ?? '',
        bgColor: action.tier?.bgColor ?? '#64748B',
        titleColor: action.tier?.titleColor ?? '#0F1115',
        descriptionColor: action.tier?.descriptionColor ?? '#1E2430',
        height: action.tier?.height ?? 112,
        itemIds: [],
      };
      return {
        ...state,
        tiers: [...state.tiers, nextTier],
        updatedAt: now,
      };
    }

    case 'UPDATE_TIER':
      return {
        ...state,
        tiers: state.tiers.map((tier) =>
          tier.id === action.tierId ? { ...tier, ...action.patch } : tier
        ),
        updatedAt: now,
      };

    case 'DELETE_TIER': {
      const target = state.tiers.find((t) => t.id === action.tierId);
      if (!target) return state;

      const remainingTiers = state.tiers.filter((t) => t.id !== action.tierId);
      let nextItems = state.items;
      let nextUnranked = state.unrankedIds;

      if (action.moveItemsToUnranked) {
        nextUnranked = [...state.unrankedIds, ...target.itemIds];
      } else {
        nextItems = { ...state.items };
        for (const id of target.itemIds) {
          delete nextItems[id];
        }
      }

      return {
        ...state,
        tiers: remainingTiers,
        unrankedIds: nextUnranked,
        items: nextItems,
        updatedAt: now,
      };
    }

    case 'CLEAR_TIER': {
      const target = state.tiers.find((t) => t.id === action.tierId);
      if (!target || target.itemIds.length === 0) return state;
      return {
        ...state,
        tiers: state.tiers.map((t) =>
          t.id === action.tierId ? { ...t, itemIds: [] } : t
        ),
        unrankedIds: [...state.unrankedIds, ...target.itemIds],
        updatedAt: now,
      };
    }

    case 'REORDER_TIERS': {
      const { fromIndex, toIndex } = action;
      if (
        fromIndex === toIndex ||
        fromIndex < 0 ||
        toIndex < 0 ||
        fromIndex >= state.tiers.length ||
        toIndex >= state.tiers.length
      ) {
        return state;
      }
      const next = [...state.tiers];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      return {
        ...state,
        tiers: next,
        updatedAt: now,
      };
    }

    case 'MOVE_TIER_STEP': {
      const index = state.tiers.findIndex((t) => t.id === action.tierId);
      if (index === -1) return state;
      const targetIndex = index + action.direction;
      if (targetIndex < 0 || targetIndex >= state.tiers.length) return state;
      const next = [...state.tiers];
      const [moved] = next.splice(index, 1);
      next.splice(targetIndex, 0, moved);
      return {
        ...state,
        tiers: next,
        updatedAt: now,
      };
    }

    case 'ADD_ITEMS': {
      const nextItems = { ...state.items };
      const nextAssets = { ...state.assets };
      const addedIds: string[] = [];

      for (const entry of action.items) {
        nextItems[entry.item.id] = entry.item;
        nextAssets[entry.asset.assetId] = entry.asset;
        addedIds.push(entry.item.id);
      }

      if (action.targetTierId) {
        const hasTier = state.tiers.some((t) => t.id === action.targetTierId);
        if (hasTier) {
          return {
            ...state,
            items: nextItems,
            assets: nextAssets,
            tiers: state.tiers.map((t) =>
              t.id === action.targetTierId
                ? { ...t, itemIds: [...t.itemIds, ...addedIds] }
                : t
            ),
            updatedAt: now,
          };
        }
      }

      return {
        ...state,
        items: nextItems,
        assets: nextAssets,
        unrankedIds: [...state.unrankedIds, ...addedIds],
        updatedAt: now,
      };
    }

    case 'MOVE_ITEM': {
      const { itemId, sourceContainer, targetContainer, targetIndex } = action;
      if (!state.items[itemId]) return state;

      // Locate real source if caller passed stale info
      let actualSource = sourceContainer;
      if (actualSource === 'unranked' && !state.unrankedIds.includes(itemId)) {
        const found = state.tiers.find((t) => t.itemIds.includes(itemId));
        if (found) actualSource = found.id;
      } else if (actualSource !== 'unranked') {
        const tier = state.tiers.find((t) => t.id === actualSource);
        if (!tier || !tier.itemIds.includes(itemId)) {
          if (state.unrankedIds.includes(itemId)) actualSource = 'unranked';
          else {
            const found = state.tiers.find((t) => t.itemIds.includes(itemId));
            if (found) actualSource = found.id;
          }
        }
      }

      const removeFromList = (list: string[]) => list.filter((id) => id !== itemId);

      let nextUnranked = [...state.unrankedIds];
      let nextTiers = state.tiers.map((t) => ({ ...t, itemIds: [...t.itemIds] }));

      if (actualSource === 'unranked') {
        const oldIdx = nextUnranked.indexOf(itemId);
        nextUnranked = removeFromList(nextUnranked);
        if (targetContainer === 'unranked') {
          const clamped = Math.max(0, Math.min(targetIndex, nextUnranked.length));
          const adjusted =
            oldIdx !== -1 && oldIdx < targetIndex
              ? Math.max(0, Math.min(targetIndex - 1, nextUnranked.length))
              : clamped;
          nextUnranked.splice(adjusted, 0, itemId);
          return { ...state, unrankedIds: nextUnranked, updatedAt: now };
        }
      } else {
        const srcTier = nextTiers.find((t) => t.id === actualSource);
        if (srcTier) {
          const oldIdx = srcTier.itemIds.indexOf(itemId);
          srcTier.itemIds = removeFromList(srcTier.itemIds);
          if (targetContainer === actualSource) {
            const clamped = Math.max(0, Math.min(targetIndex, srcTier.itemIds.length));
            const adjusted =
              oldIdx !== -1 && oldIdx < targetIndex
                ? Math.max(0, Math.min(targetIndex - 1, srcTier.itemIds.length))
                : clamped;
            srcTier.itemIds.splice(adjusted, 0, itemId);
            return { ...state, tiers: nextTiers, updatedAt: now };
          }
        }
      }

      if (targetContainer === 'unranked') {
        const clamped = Math.max(0, Math.min(targetIndex, nextUnranked.length));
        nextUnranked.splice(clamped, 0, itemId);
      } else {
        const dstTier = nextTiers.find((t) => t.id === targetContainer);
        if (dstTier) {
          const clamped = Math.max(0, Math.min(targetIndex, dstTier.itemIds.length));
          dstTier.itemIds.splice(clamped, 0, itemId);
        } else {
          nextUnranked.push(itemId);
        }
      }

      return {
        ...state,
        unrankedIds: nextUnranked,
        tiers: nextTiers,
        updatedAt: now,
      };
    }

    case 'UPDATE_ITEM': {
      const existing = state.items[action.itemId];
      if (!existing) return state;
      return {
        ...state,
        items: {
          ...state.items,
          [action.itemId]: {
            ...existing,
            ...action.patch,
          },
        },
        updatedAt: now,
      };
    }

    case 'DELETE_ITEM': {
      if (!state.items[action.itemId]) return state;
      const nextItems = { ...state.items };
      delete nextItems[action.itemId];
      return {
        ...state,
        items: nextItems,
        unrankedIds: state.unrankedIds.filter((id) => id !== action.itemId),
        tiers: state.tiers.map((t) => ({
          ...t,
          itemIds: t.itemIds.filter((id) => id !== action.itemId),
        })),
        updatedAt: now,
      };
    }

    case 'RESET_ALL_TO_UNRANKED': {
      const rankedIds = state.tiers.flatMap((t) => t.itemIds);
      if (rankedIds.length === 0) return state;
      const existingUnranked = new Set(state.unrankedIds);
      const appended = rankedIds.filter((id) => !existingUnranked.has(id));
      return {
        ...state,
        tiers: state.tiers.map((t) =>
          t.itemIds.length > 0 ? { ...t, itemIds: [] } : t
        ),
        unrankedIds: [...state.unrankedIds, ...appended],
        updatedAt: now,
      };
    }

    case 'RESET_ALL_CUSTOM_SIZES': {
      const nextItems: Record<string, TierItem> = {};
      for (const [id, item] of Object.entries(state.items)) {
        const { customWidth: _w, customHeight: _h, ...rest } = item;
        nextItems[id] = rest;
      }
      return {
        ...state,
        items: nextItems,
        updatedAt: now,
      };
    }

    case 'APPLY_TEMPLATE': {
      const { template } = action;
      const allExistingIds = [
        ...state.tiers.flatMap((t) => t.itemIds),
        ...state.unrankedIds,
      ];
      return {
        ...state,
        appearance: { ...DEFAULT_APPEARANCE, ...template.appearance },
        tiers: template.tiers.map((t, idx) => ({
          ...t,
          id: state.tiers[idx]?.id ?? createUid('tier'),
          itemIds: state.tiers[idx]?.itemIds ?? [],
        })),
        unrankedIds:
          state.tiers.length > template.tiers.length
            ? [
                ...state.unrankedIds,
                ...state.tiers.slice(template.tiers.length).flatMap((t) => t.itemIds),
              ]
            : state.unrankedIds.filter((id) => allExistingIds.includes(id)),
        updatedAt: now,
      };
    }

    default:
      return state;
  }
}

export interface HistoryState {
  past: TierProject[];
  present: TierProject;
  future: TierProject[];
  lastCoalesceKey?: string;
  lastCoalesceAt?: number;
}

const MAX_HISTORY = 60;
const COALESCE_WINDOW_MS = 1200;

export function createInitialHistory(project: TierProject): HistoryState {
  return {
    past: [],
    present: project,
    future: [],
  };
}

export function dispatchHistory(
  history: HistoryState,
  action: ProjectAction,
  options?: { recordHistory?: boolean; coalesceKey?: string }
): HistoryState {
  if (action.type === 'RESET_PROJECT') {
    return createInitialHistory(action.project);
  }
  const nextPresent = applyProjectAction(history.present, action);
  if (nextPresent === history.present) return history;

  if (options?.recordHistory === false) {
    return {
      ...history,
      present: nextPresent,
      lastCoalesceKey: undefined,
      lastCoalesceAt: undefined,
    };
  }

  const now = Date.now();
  const coalesceKey = options?.coalesceKey;
  if (
    coalesceKey &&
    history.lastCoalesceKey === coalesceKey &&
    history.lastCoalesceAt !== undefined &&
    now - history.lastCoalesceAt < COALESCE_WINDOW_MS &&
    history.past.length > 0
  ) {
    return {
      ...history,
      present: nextPresent,
      future: [],
      lastCoalesceKey: coalesceKey,
      lastCoalesceAt: now,
    };
  }

  const nextPast = [...history.past, history.present];
  if (nextPast.length > MAX_HISTORY) {
    nextPast.shift();
  }
  return {
    past: nextPast,
    present: nextPresent,
    future: [],
    lastCoalesceKey: coalesceKey,
    lastCoalesceAt: coalesceKey ? now : undefined,
  };
}

export function undoHistory(history: HistoryState): HistoryState {
  if (history.past.length === 0) return history;
  const previous = history.past[history.past.length - 1];
  const newPast = history.past.slice(0, -1);
  return {
    past: newPast,
    present: previous,
    future: [history.present, ...history.future].slice(0, MAX_HISTORY),
    lastCoalesceKey: undefined,
    lastCoalesceAt: undefined,
  };
}

export function redoHistory(history: HistoryState): HistoryState {
  if (history.future.length === 0) return history;
  const next = history.future[0];
  const newFuture = history.future.slice(1);
  return {
    past: [...history.past, history.present].slice(-MAX_HISTORY),
    present: next,
    future: newFuture,
    lastCoalesceKey: undefined,
    lastCoalesceAt: undefined,
  };
}

/**
 * Deterministic revision signature excluding updatedAt so coalesced autosave
 * avoids redundant disk writes when no meaningful data changed.
 */
export function computeProjectRevision(project: TierProject): string {
  return JSON.stringify({
    name: project.name,
    tiers: project.tiers,
    unrankedIds: project.unrankedIds,
    items: project.items,
    assets: project.assets,
    appearance: project.appearance,
  });
}
