import { Router, type Request, type Response } from 'express';
import type { SessionOverviewService } from '../../service/src/session-overview.service.js';
import type { CryptoSession, OverviewFilters, EventFilters, CollectorRunFilters } from '../../service/src/ports.js';
import type { OverviewRunOptions } from '../../service/src/service-types.js';

const VALID_SESSIONS: ReadonlySet<string> = new Set<CryptoSession>([
  'ASIA_CRYPTO',
  'EUROPE_CRYPTO',
  'US_CRYPTO',
]);

function isValidSession(value: string): value is CryptoSession {
  return VALID_SESSIONS.has(value);
}

function parseIntParam(value: unknown): number | undefined {
  if (typeof value !== 'string') return undefined;
  const n = parseInt(value, 10);
  return isNaN(n) ? undefined : n;
}

function parseDateParam(value: unknown): Date | undefined {
  if (typeof value !== 'string') return undefined;
  const d = new Date(value);
  return isNaN(d.getTime()) ? undefined : d;
}

export function createSessionOverviewRouter(service: SessionOverviewService): Router {
  const router = Router();

  // GET /health
  router.get('/health', (_req: Request, res: Response): void => {
    res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // GET /overviews — list with filters
  router.get('/overviews', async (req: Request, res: Response): Promise<void> => {
    const { session, limit, fromDate } = req.query;
    if (session !== undefined && (typeof session !== 'string' || !isValidSession(session))) {
      res.status(400).json({ error: 'Invalid session', validSessions: Array.from(VALID_SESSIONS) });
      return;
    }
    const filters: OverviewFilters = {
      ...(typeof session === 'string' ? { session: session as CryptoSession } : {}),
      ...(parseIntParam(limit) !== undefined ? { limit: parseIntParam(limit) } : {}),
      ...(parseDateParam(fromDate) !== undefined ? { fromDate: parseDateParam(fromDate) } : {}),
    };
    try {
      const records = await service.listOverviews(filters);
      res.status(200).json({ items: records, count: records.length });
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
        res.status(404).json({ error: `Overview not found: ${id}` });
        return;
      }
      res.status(200).json(record);
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  // GET /overviews/latest/:session — latest by session
  router.get('/overviews/latest/:session', async (req: Request, res: Response): Promise<void> => {
    const { session } = req.params;
    if (!isValidSession(session)) {
      res.status(400).json({ error: 'Invalid session', validSessions: Array.from(VALID_SESSIONS) });
      return;
    }
    try {
      const record = await service.getLatestOverview(session);
      if (record === null) {
        res.status(404).json({ error: `No overview found for session: ${session}` });
        return;
      }
      res.status(200).json(record);
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  // GET /events — list collected events
  router.get('/events', async (req: Request, res: Response): Promise<void> => {
    const { session, eventType, limit, fromDate } = req.query;
    if (session !== undefined && (typeof session !== 'string' || !isValidSession(session))) {
      res.status(400).json({ error: 'Invalid session', validSessions: Array.from(VALID_SESSIONS) });
      return;
    }
    const filters: EventFilters = {
      ...(typeof session === 'string' ? { session: session as CryptoSession } : {}),
      ...(typeof eventType === 'string' ? { eventType } : {}),
      ...(parseIntParam(limit) !== undefined ? { limit: parseIntParam(limit) } : {}),
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
      ...(parseIntParam(limit) !== undefined ? { limit: parseIntParam(limit) } : {}),
      ...(parseDateParam(fromDate) !== undefined ? { fromDate: parseDateParam(fromDate) } : {}),
    };
    try {
      const runs = await service.listCollectorRuns(filters);
      res.status(200).json({ items: runs, count: runs.length });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  // POST /overviews/trigger — manual trigger
  router.post('/overviews/trigger', async (req: Request, res: Response): Promise<void> => {
    const body = req.body as { session?: unknown; symbols?: unknown; publish?: unknown };
    const { session, symbols, publish } = body;

    if (typeof session !== 'string' || !isValidSession(session)) {
      res.status(400).json({ error: 'Invalid or missing session', validSessions: Array.from(VALID_SESSIONS) });
      return;
    }

    if (
      typeof symbols !== 'object' || symbols === null ||
      !Array.isArray((symbols as { core?: unknown }).core) ||
      !Array.isArray((symbols as { major?: unknown }).major) ||
      !Array.isArray((symbols as { watch?: unknown }).watch)
    ) {
      res.status(400).json({ error: 'Invalid symbols — expected { core: string[], major: string[], watch: string[] }' });
      return;
    }

    const sym = symbols as { core: string[]; major: string[]; watch: string[] };
    const options: OverviewRunOptions = {
      session,
      symbols: { core: sym.core, major: sym.major, watch: sym.watch },
      ...(publish !== undefined ? { publish: Boolean(publish) } : {}),
    };

    try {
      const result = await service.runSessionOverview(options);
      res.status(202).json({ overviewId: result.overviewId, status: result.status, durationMs: result.durationMs });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  // Legacy aliases
  router.get('/overview/:session', async (req: Request, res: Response): Promise<void> => {
    const { session } = req.params;
    if (!isValidSession(session)) {
      res.status(400).json({ error: 'Invalid session', validSessions: Array.from(VALID_SESSIONS) });
      return;
    }
    const record = await service.getLatestOverview(session).catch(() => null);
    if (record === null) { res.status(404).json({ error: `No overview found for session: ${session}` }); return; }
    res.status(200).json(record);
  });

  router.post('/overview/trigger', async (req: Request, res: Response): Promise<void> => {
    req.url = '/overviews/trigger';
    router.handle(req, res, () => { res.status(404).end(); });
  });

  return router;
}
