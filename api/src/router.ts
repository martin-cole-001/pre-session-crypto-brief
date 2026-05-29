import { Router, type Request, type Response } from 'express';
import type { SessionOverviewService } from '../../service/src/session-overview.service.js';
import type { OverviewFilters, EventFilters, CollectorRunFilters, TelegramPostFilters } from '../../service/src/ports.js';
import {
  isValidSession,
  clampLimit,
  parseDateParam,
  validateTriggerBody,
  VALID_SESSIONS_LIST,
} from './router-validators.js';

export function createSessionOverviewRouter(service: SessionOverviewService): Router {
  const router = Router();

  // GET /health
  router.get('/health', (_req: Request, res: Response): void => {
    res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // GET /overviews — list with filters
  router.get('/overviews', async (req: Request, res: Response): Promise<void> => {
    const { session, limit, fromDate } = req.query;
    if (session !== undefined && !isValidSession(session)) {
      res.status(400).json({ error: 'Invalid session', code: 'INVALID_SESSION', validSessions: VALID_SESSIONS_LIST });
      return;
    }
    const filters: OverviewFilters = {
      ...(isValidSession(session) ? { session } : {}),
      ...(clampLimit(limit) !== undefined ? { limit: clampLimit(limit) } : {}),
      ...(parseDateParam(fromDate) !== undefined ? { fromDate: parseDateParam(fromDate) } : {}),
    };
    try {
      const records = await service.listOverviews(filters);
      res.status(200).json({ items: records, count: records.length });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  // GET /overviews/latest/:session — MUST be before /overviews/:id to avoid swallowing 'latest' as an ID
  router.get('/overviews/latest/:session', async (req: Request, res: Response): Promise<void> => {
    const { session } = req.params;
    if (!isValidSession(session)) {
      res.status(400).json({ error: 'Invalid session', code: 'INVALID_SESSION', validSessions: VALID_SESSIONS_LIST });
      return;
    }
    try {
      const record = await service.getLatestOverview(session);
      if (record === null) {
        res.status(404).json({ error: `No overview found for session: ${session}`, code: 'NOT_FOUND' });
        return;
      }
      res.status(200).json(record);
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  // GET /overviews/:id — get by ID
  router.get('/overviews/:id', async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    try {
      const record = await service.getOverviewById(id);
      if (record === null) {
        res.status(404).json({ error: `Overview not found: ${id}`, code: 'NOT_FOUND' });
        return;
      }
      res.status(200).json(record);
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  // GET /events — list collected events
  router.get('/events', async (req: Request, res: Response): Promise<void> => {
    const { session, eventType, asset, source, category, importance, limit, fromDate } = req.query;
    if (session !== undefined && !isValidSession(session)) {
      res.status(400).json({ error: 'Invalid session', code: 'INVALID_SESSION', validSessions: VALID_SESSIONS_LIST });
      return;
    }
    const filters: EventFilters = {
      ...(isValidSession(session) ? { session } : {}),
      ...(typeof eventType === 'string' ? { eventType } : {}),
      ...(typeof asset === 'string' ? { asset } : {}),
      ...(typeof source === 'string' ? { source } : {}),
      ...(typeof category === 'string' ? { category } : {}),
      ...(typeof importance === 'string' ? { importance } : {}),
      ...(clampLimit(limit) !== undefined ? { limit: clampLimit(limit) } : {}),
      ...(parseDateParam(fromDate) !== undefined ? { fromDate: parseDateParam(fromDate) } : {}),
    };
    try {
      const events = await service.listEvents(filters);
      res.status(200).json({ items: events, count: events.length });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  // GET /collector-runs — telemetry
  router.get('/collector-runs', async (req: Request, res: Response): Promise<void> => {
    const { collectorName, status, limit, fromDate } = req.query;
    const filters: CollectorRunFilters = {
      ...(typeof collectorName === 'string' ? { collectorName } : {}),
      ...(typeof status === 'string' && ['SUCCESS', 'FAILED', 'SKIPPED'].includes(status)
        ? { status: status as CollectorRunFilters['status'] } : {}),
      ...(clampLimit(limit) !== undefined ? { limit: clampLimit(limit) } : {}),
      ...(parseDateParam(fromDate) !== undefined ? { fromDate: parseDateParam(fromDate) } : {}),
    };
    try {
      const runs = await service.listCollectorRuns(filters);
      res.status(200).json({ items: runs, count: runs.length });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  // GET /telegram-posts — list posted Telegram messages
  router.get('/telegram-posts', async (req: Request, res: Response): Promise<void> => {
    const { session, overviewId, limit } = req.query;
    if (session !== undefined && !isValidSession(session)) {
      res.status(400).json({ error: 'Invalid session', code: 'INVALID_SESSION', validSessions: VALID_SESSIONS_LIST });
      return;
    }
    const filters: TelegramPostFilters = {
      ...(isValidSession(session) ? { session: session as string } : {}),
      ...(typeof overviewId === 'string' ? { overviewId } : {}),
      ...(clampLimit(limit) !== undefined ? { limit: clampLimit(limit) } : {}),
    };
    try {
      const posts = await service.listTelegramPosts(filters);
      res.status(200).json({ items: posts, count: posts.length });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  // POST /overviews/trigger — manual trigger
  router.post('/overviews/trigger', async (req: Request, res: Response): Promise<void> => {
    const validation = validateTriggerBody(req.body);
    if (!validation.ok) {
      res.status(400).json({ error: validation.error, code: validation.code });
      return;
    }
    try {
      const result = await service.runSessionOverview(validation.options);
      res.status(202).json({
        overviewId: result.overviewId,
        status: result.status,
        durationMs: result.durationMs,
        telegramPublished: result.telegramPublished,
        marketRegime: result.marketRegime,
        briefConfidence: result.briefConfidence,
        collectorStatus: result.collectorStatus,
      });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  // Legacy alias — canonical path preferred
  router.get('/overview/:session', async (req: Request, res: Response): Promise<void> => {
    const { session } = req.params;
    if (!isValidSession(session)) {
      res.status(400).json({ error: 'Invalid session', code: 'INVALID_SESSION', validSessions: VALID_SESSIONS_LIST });
      return;
    }
    const record = await service.getLatestOverview(session).catch(() => null);
    if (record === null) {
      res.status(404).json({ error: `No overview found for session: ${session}`, code: 'NOT_FOUND' });
      return;
    }
    res.status(200).json(record);
  });

  return router;
}
