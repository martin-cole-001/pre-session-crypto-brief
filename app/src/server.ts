import express, { type Request, type Response, type NextFunction } from 'express';
import { createSessionOverviewRouter } from '../../api/src/router.js';
import type { SessionOverviewService } from '../../service/src/session-overview.service.js';
import type { AppConfig } from './config.js';

export function createServer(
  service: SessionOverviewService,
  _config: AppConfig,
): express.Application {
  const app = express();

  app.use(express.json());

  const overviewRouter = createSessionOverviewRouter(service);
  app.use('/api/v1/session-overview', overviewRouter);

  // 404 handler
  app.use((_req: Request, res: Response): void => {
    res.status(404).json({ error: 'Not found' });
  });

  // Error handler
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction): void => {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: 'Internal server error', detail: message });
  });

  return app;
}
