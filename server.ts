import express from 'express';
import fs from 'fs';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { LocalTierStorage, assertSafeId } from './electron/storage';

const PORT = Number(process.env.PORT) || 3000;
const DATA_DIR = path.resolve(process.cwd(), '.local-data');
const SEED_ASSETS_DIR = path.resolve(process.cwd(), 'src', 'assets', 'images');

async function startServer() {
  const storage = new LocalTierStorage(DATA_DIR, SEED_ASSETS_DIR);
  await storage.ensureInitialized();

  const app = express();
  app.use(express.json({ limit: '64mb' }));

  app.get('/api/projects', async (_req, res) => {
    try {
      const list = await storage.listProjects();
      res.json(list);
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  app.get('/api/projects/:id', async (req, res) => {
    try {
      const id = assertSafeId(req.params.id, 'projectId');
      const project = await storage.loadProject(id);
      res.json(project);
    } catch (err) {
      res.status(404).json({ error: (err as Error).message });
    }
  });

  app.put('/api/projects/:id', async (req, res) => {
    try {
      const id = assertSafeId(req.params.id, 'projectId');
      const body = req.body;
      if (!body || typeof body !== 'object' || body.id !== id) {
        res.status(400).json({ error: 'Несоответствие идентификатора проекта' });
        return;
      }
      await storage.saveProject(body);
      res.json({ ok: true });
    } catch (err) {
      res.status(400).json({ error: (err as Error).message });
    }
  });

  // Reliable flush endpoint for navigator.sendBeacon on page close
  app.post('/api/projects/:id/beacon', async (req, res) => {
    try {
      const id = assertSafeId(req.params.id, 'projectId');
      const body = req.body;
      if (body && typeof body === 'object' && body.id === id) {
        await storage.saveProject(body);
      }
      res.status(204).end();
    } catch {
      res.status(400).end();
    }
  });

  app.delete('/api/projects/:id', async (req, res) => {
    try {
      const id = assertSafeId(req.params.id, 'projectId');
      await storage.deleteProject(id);
      res.json({ ok: true });
    } catch (err) {
      res.status(400).json({ error: (err as Error).message });
    }
  });

  app.post('/api/projects/:id/duplicate', async (req, res) => {
    try {
      const sourceId = assertSafeId(req.params.id, 'sourceId');
      const { newId, newName } = req.body as { newId: string; newName: string };
      assertSafeId(newId, 'newId');
      const dup = await storage.duplicateProject(
        sourceId,
        newId,
        typeof newName === 'string' && newName.trim() ? newName.trim() : 'Копия проекта'
      );
      res.json(dup);
    } catch (err) {
      res.status(400).json({ error: (err as Error).message });
    }
  });

  app.post(
    '/api/projects/:id/assets/:assetId',
    express.raw({ type: 'application/octet-stream', limit: '50mb' }),
    async (req, res) => {
      try {
        const projectId = assertSafeId(req.params.id, 'projectId');
        const assetId = assertSafeId(req.params.assetId, 'assetId');
        const mimeType = String(req.headers['x-asset-mime'] || 'image/png');
        const thumbMime = String(req.headers['x-thumb-mime'] || mimeType);
        const origLen = Number(req.headers['x-orig-length'] || 0);
        const bodyBuf = Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0);

        if (origLen > 0 && origLen <= bodyBuf.length) {
          const origBytes = new Uint8Array(bodyBuf.subarray(0, origLen));
          const thumbBytes =
            bodyBuf.length > origLen
              ? new Uint8Array(bodyBuf.subarray(origLen))
              : undefined;
          await storage.saveAsset(
            projectId,
            assetId,
            mimeType,
            origBytes,
            thumbBytes,
            thumbMime
          );
        } else {
          await storage.saveAsset(
            projectId,
            assetId,
            mimeType,
            new Uint8Array(bodyBuf)
          );
        }

        res.json({ ok: true });
      } catch (err) {
        res.status(400).json({ error: (err as Error).message });
      }
    }
  );

  app.get('/api/projects/:id/assets/:variant/:assetId', async (req, res) => {
    try {
      const projectId = assertSafeId(req.params.id, 'projectId');
      const assetId = assertSafeId(req.params.assetId, 'assetId');
      const variant = req.params.variant === 'thumb' ? 'thumb' : 'orig';
      const asset = await storage.readAsset(projectId, assetId, variant);
      if (!asset) {
        res.status(404).end();
        return;
      }
      res.setHeader('Content-Type', asset.mimeType);
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      res.send(asset.bytes);
    } catch {
      res.status(400).end();
    }
  });

  app.post(
    '/api/projects/:id/thumbnail',
    express.raw({ type: 'image/png', limit: '10mb' }),
    async (req, res) => {
      try {
        const projectId = assertSafeId(req.params.id, 'projectId');
        const bodyBuf = Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0);
        await storage.saveProjectThumbnail(projectId, new Uint8Array(bodyBuf));
        res.json({ ok: true });
      } catch (err) {
        res.status(400).json({ error: (err as Error).message });
      }
    }
  );

  app.get('/api/projects/:id/thumbnail', async (req, res) => {
    try {
      const projectId = assertSafeId(req.params.id, 'projectId');
      const buf = await storage.readProjectThumbnail(projectId);
      if (!buf) {
        res.status(404).end();
        return;
      }
      res.setHeader('Content-Type', 'image/png');
      res.setHeader('Cache-Control', 'no-store');
      res.send(buf);
    } catch {
      res.status(400).end();
    }
  });

  app.get('/api/templates', async (_req, res) => {
    try {
      const list = await storage.listTemplates();
      res.json(list);
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  app.post('/api/templates', async (req, res) => {
    try {
      const next = await storage.saveTemplate(req.body);
      res.json(next);
    } catch (err) {
      res.status(400).json({ error: (err as Error).message });
    }
  });

  app.delete('/api/templates/:id', async (req, res) => {
    try {
      const id = assertSafeId(req.params.id, 'templateId');
      const next = await storage.deleteTemplate(id);
      res.json(next);
    } catch (err) {
      res.status(400).json({ error: (err as Error).message });
    }
  });

  const distDir = path.resolve(process.cwd(), 'dist');
  const isProd = process.env.NODE_ENV === 'production' && fs.existsSync(distDir);

  if (isProd) {
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`TierBuilder Studio server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
