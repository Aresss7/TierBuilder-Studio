import { createElectronBridge } from './electronBridge';
import { createWebBridge } from './webBridge';
import type { StorageBridge } from './types';

let cachedBridge: StorageBridge | null = null;

export function getStorageBridge(): StorageBridge {
  if (!cachedBridge) {
    cachedBridge =
      typeof window !== 'undefined' && window.electronAPI
        ? createElectronBridge()
        : createWebBridge();
  }
  return cachedBridge;
}

export type { StorageBridge } from './types';
