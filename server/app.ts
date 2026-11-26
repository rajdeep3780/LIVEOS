import express from 'express';
import type { NextFunction, Request, Response } from 'express';
import apiRouter from './routes/index.ts';

const DEFAULT_TRUST_PROXY = 'loopback, linklocal, uniquelocal';

function resolveTrustProxySetting(): string | false {
  const configured = process.env.TRUST_PROXY?.trim();
  if (!configured) {
    return DEFAULT_TRUST_PROXY;
  }
  const normalized = configured.toLowerCase();
  if (normalized === 'false' || normalized === 'off' || normalized === 'none' || normalized === '0') {
    return false;
  }
  if (normalized === 'true' || /^\d+$/.test(normalized)) {
    // Refuse blanket hop-count or wildcard trust; fall back to known proxy ranges.
    return DEFAULT_TRUST_PROXY;
  }
  return configured;
}

export function createApp() {
  const app = express();

  const trustProxy = resolveTrustProxySetting();
  try {
    app.set('trust proxy', trustProxy);
  } catch {
    console.warn('Invalid TRUST_PROXY value configured; falling back to default trusted proxy ranges.');
    app.set('trust proxy', DEFAULT_TRUST_PROXY);
  }
  app.disable('x-powered-by');

  app.use(express.json({ limit: '1mb' }));

  app.use('/api', apiRouter);

  // Return clean JSON 404 for unknown API paths
  app.use('/api', (_req, res) => {
    res.status(404).json({ error: 'API endpoint not found.' });
  });

  // Global error handler
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    console.error('Unhandled server error:', err);
    if (!res.headersSent) {
      res.status(500).json({ error: 'An unexpected server error occurred.' });
    }
  });

  return app;
}
