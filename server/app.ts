import express from 'express';
import type { NextFunction, Request, Response } from 'express';
import apiRouter from './routes/index.ts';

export function createApp() {
  const app = express();

  app.set('trust proxy', 1);
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
