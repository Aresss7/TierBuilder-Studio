import { app, BrowserWindow, dialog, ipcMain, protocol } from 'electron';
import fs from 'fs';
import path from 'path';
import { LocalTierStorage, assertSafeId } from './storage';
import type { TierProject, TierTemplate } from '../src/core/types';

let mainWindow: BrowserWindow | null = null;
let storage: LocalTierStorage;
let isQuittingConfirmed = false;

protocol.registerSchemesAsPrivileged([
  {
    scheme: 'tiercraft-asset',
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
    },
  },
]);

function getSeedAssetsDir(): string {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'seed-assets');
  }
  return path.join(app.getAppPath(), 'src', 'assets', 'images');
}

function getWindowIcon(): string | undefined {
  const candidates = [
    path.join(app.getAppPath(), 'build', 'icon.ico'),
    path.join(app.getAppPath(), 'build', 'icon.png'),
  ];
  return candidates.find((p) => fs.existsSync(p));
}

function createWindow() {
  const windowIcon = getWindowIcon();
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1080,
    minHeight: 700,
    backgroundColor: '#0F1115',
    title: 'TierCraft Studio',
    ...(windowIcon ? { icon: windowIcon } : {}),
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      devTools: !app.isPackaged,
    },
  });

  mainWindow.on('close', (event) => {
    if (isQuittingConfirmed || !mainWindow) return;
    event.preventDefault();
    let settled = false;
    const finishClose = () => {
      if (settled || !mainWindow) return;
      settled = true;
      isQuittingConfirmed = true;
      mainWindow.close();
    };
    const timeout = setTimeout(finishClose, 2500);
    ipcMain.once('tiercraft:flush-complete', () => {
      clearTimeout(timeout);
      finishClose();
    });
    mainWindow.webContents.send('tiercraft:request-flush');
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(path.join(app.getAppPath(), 'dist', 'index.html'));
  }
}

app.whenReady().then(async () => {
  const userDataDir = path.join(app.getPath('userData'), 'tiercraft-data');
  storage = new LocalTierStorage(userDataDir, getSeedAssetsDir());
  await storage.ensureInitialized();

  // Serve local assets and thumbnails securely without Base64 IPC overhead
  protocol.handle('tiercraft-asset', async (request) => {
    try {
      const url = new URL(request.url);
      const parts = url.pathname.split('/').filter(Boolean);
      const host = url.hostname;
      // Format: tiercraft-asset://media/<projectId>/<variant>/<assetId>
      // or tiercraft-asset://thumb/<projectId>
      if (host === 'thumb' && parts.length === 1) {
        const projectId = assertSafeId(parts[0], 'projectId');
        const buf = await storage.readProjectThumbnail(projectId);
        if (!buf) return new Response('Not found', { status: 404 });
        return new Response(new Uint8Array(buf), {
          headers: { 'Content-Type': 'image/png', 'Cache-Control': 'no-store' },
        });
      }
      if (host === 'media' && parts.length === 3) {
        const projectId = assertSafeId(parts[0], 'projectId');
        const variant = parts[1] === 'thumb' ? 'thumb' : 'orig';
        const assetId = assertSafeId(parts[2], 'assetId');
        const res = await storage.readAsset(projectId, assetId, variant);
        if (!res) return new Response('Not found', { status: 404 });
        return new Response(new Uint8Array(res.bytes), {
          headers: {
            'Content-Type': res.mimeType,
            'Cache-Control': 'public, max-age=31536000, immutable',
          },
        });
      }
      return new Response('Bad request', { status: 400 });
    } catch {
      return new Response('Forbidden', { status: 403 });
    }
  });

  ipcMain.handle('tiercraft:listProjects', () => storage.listProjects());
  ipcMain.handle('tiercraft:loadProject', (_e, id: string) => storage.loadProject(id));
  ipcMain.handle('tiercraft:saveProject', (_e, project: TierProject) =>
    storage.saveProject(project)
  );
  ipcMain.handle('tiercraft:deleteProject', (_e, id: string) =>
    storage.deleteProject(id)
  );
  ipcMain.handle(
    'tiercraft:duplicateProject',
    (_e, sourceId: string, newId: string, newName: string) =>
      storage.duplicateProject(sourceId, newId, newName)
  );
  ipcMain.handle(
    'tiercraft:saveAsset',
    (
      _e,
      payload: {
        projectId: string;
        assetId: string;
        mimeType: string;
        originalBytes: Uint8Array;
        thumbBytes?: Uint8Array;
        thumbMimeType?: string;
      }
    ) =>
      storage.saveAsset(
        payload.projectId,
        payload.assetId,
        payload.mimeType,
        new Uint8Array(payload.originalBytes),
        payload.thumbBytes ? new Uint8Array(payload.thumbBytes) : undefined,
        payload.thumbMimeType
      )
  );
  ipcMain.handle('tiercraft:readAssetBytes', async (_e, projectId: string, assetId: string) => {
    const res = await storage.readAsset(projectId, assetId, 'orig');
    if (!res) return null;
    return { mimeType: res.mimeType, bytes: new Uint8Array(res.bytes) };
  });
  ipcMain.handle(
    'tiercraft:saveProjectThumbnail',
    (_e, projectId: string, pngBytes: Uint8Array) =>
      storage.saveProjectThumbnail(projectId, new Uint8Array(pngBytes))
  );
  ipcMain.handle('tiercraft:listTemplates', () => storage.listTemplates());
  ipcMain.handle('tiercraft:saveTemplate', (_e, tpl: TierTemplate) =>
    storage.saveTemplate(tpl)
  );
  ipcMain.handle('tiercraft:deleteTemplate', (_e, id: string) =>
    storage.deleteTemplate(id)
  );

  ipcMain.handle(
    'tiercraft:saveFileDialog',
    async (
      _e,
      payload: {
        defaultName: string;
        filters: Array<{ name: string; extensions: string[] }>;
        bytes: Uint8Array;
      }
    ) => {
      if (!mainWindow) return false;
      const result = await dialog.showSaveDialog(mainWindow, {
        defaultPath: payload.defaultName,
        filters: payload.filters,
      });
      if (result.canceled || !result.filePath) return false;
      await fs.promises.writeFile(result.filePath, new Uint8Array(payload.bytes));
      return true;
    }
  );

  ipcMain.handle(
    'tiercraft:openFileDialog',
    async (
      _e,
      payload: {
        filters: Array<{ name: string; extensions: string[] }>;
      }
    ) => {
      if (!mainWindow) return null;
      const result = await dialog.showOpenDialog(mainWindow, {
        properties: ['openFile'],
        filters: payload.filters,
      });
      if (result.canceled || result.filePaths.length === 0) return null;
      const filePath = result.filePaths[0];
      const bytes = await fs.promises.readFile(filePath);
      return {
        fileName: path.basename(filePath),
        bytes: new Uint8Array(bytes),
      };
    }
  );

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
