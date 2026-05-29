import type {
  CryptoSession,
  SessionOverviewRepository,
  OverviewRecord,
  OverviewFilters,
  EventFilters,
  CollectorRunFilters,
  NormalizedEvent,
  CollectorRunRecord,
  TelegramPostFilters,
  TelegramPostRecord,
} from './ports.js';
import type { OverviewRunOptions, OverviewRunResult } from './service-types.js';
import { OverviewRunner } from './overview-runner.js';

export class SessionOverviewService {
  constructor(
    private readonly runner: OverviewRunner,
    private readonly repository: SessionOverviewRepository,
  ) {}

  async runSessionOverview(options: OverviewRunOptions): Promise<OverviewRunResult> {
    return this.runner.run(options);
  }

  async getLatestOverview(session: CryptoSession): Promise<OverviewRecord | null> {
    return this.repository.getLatestOverview(session);
  }

  async getOverviewById(id: string): Promise<OverviewRecord | null> {
    return this.repository.getOverviewById(id);
  }

  async listOverviews(filters: OverviewFilters): Promise<OverviewRecord[]> {
    return this.repository.listOverviews(filters);
  }

  async listEvents(filters: EventFilters): Promise<NormalizedEvent[]> {
    return this.repository.listEvents(filters);
  }

  async listCollectorRuns(filters: CollectorRunFilters): Promise<CollectorRunRecord[]> {
    return this.repository.listCollectorRuns(filters);
  }

  async listTelegramPosts(filters: TelegramPostFilters): Promise<TelegramPostRecord[]> {
    return this.repository.listTelegramPosts(filters);
  }
}
