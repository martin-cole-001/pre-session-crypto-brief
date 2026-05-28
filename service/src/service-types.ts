import type {
  CryptoSession,
  OverviewOutput,
  OverviewRecord,
  OverviewFilters,
  MarketDataCollector,
  DerivativesCollector,
  EventCollector,
  ActiveSetupsLoader,
  LlmOverviewClient,
  SessionOverviewRepository,
  OverviewPublisher,
  LoggerLike,
} from './ports.js';

export type SessionOverviewDeps = {
  marketDataCollector: MarketDataCollector;
  derivativesCollector: DerivativesCollector;
  eventCollectors: EventCollector[];
  setupLoader?: ActiveSetupsLoader;
  llmClient: LlmOverviewClient;
  repository: SessionOverviewRepository;
  publisher?: OverviewPublisher;
  logger: LoggerLike;
};

export type OverviewRunOptions = {
  session: CryptoSession;
  symbols: {
    core: string[];
    major: string[];
    watch: string[];
  };
  publish?: boolean;
  tokenBudget?: number;
};

export type OverviewRunResult = {
  overviewId: string;
  session: CryptoSession;
  status: 'SUCCESS' | 'FAILED' | 'PARTIAL';
  output?: OverviewOutput;
  humanReport?: string;
  telegramPostIds?: string[];
  durationMs: number;
  error?: string;
};

export type { OverviewRecord, OverviewFilters };
