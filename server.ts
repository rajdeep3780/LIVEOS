import 'dotenv/config';
import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { createApp } from './server/app.ts';
import { validateSessionSecretConfig } from './server/lib/auth-crypto.ts';

const isProduction = process.env.NODE_ENV === 'production';
const PORT = isProduction ? Number(process.env.PORT) || 3000 : 3000;

async function startServer() {
  validateSessionSecretConfig();

  const app = createApp();

  let viteServer: { close: () => Promise<void> } | null = null;

  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const disableHmr = process.env.DISABLE_HMR === 'true';
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        ...(disableHmr ? { hmr: false, ws: false } : {}),
      },
      appType: 'spa',
    });
    viteServer = vite;
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    const indexHtmlPath = path.join(distDir, 'index.html');
    if (!fs.existsSync(indexHtmlPath)) {
      throw new Error(
        `Missing production frontend build at ${indexHtmlPath}. Run "npm run build" before starting the production server.`
      );
    }
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(indexHtmlPath);
    });
  }

  const httpServer = app.listen(PORT, '0.0.0.0', () => {
    console.log(`LIFEOS server listening on http://0.0.0.0:${PORT}`);
  });

  const shutdown = () => {
    httpServer.close(async () => {
      if (viteServer) {
        try {
          await viteServer.close();
        } catch {
          // Ignore Vite shutdown errors on exit
        }
      }
      process.exit(0);
    });
    setTimeout(() => process.exit(0), 3000).unref();
  };

  process.once('SIGTERM', shutdown);
  process.once('SIGINT', shutdown);
}

startServer().catch((err) => {
  console.error('Failed to start LIFEOS server:', err);
  process.exit(1);
});
