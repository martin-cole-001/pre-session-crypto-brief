import { BybitHttpClient } from './bybit-http-client.js';
import { BybitMarketDataCollector } from './collectors/bybit-market-data.js';
import { BybitDerivativesCollector } from './collectors/bybit-derivatives.js';
import { BybitAnnouncementsCollector } from './collectors/bybit-announcements.js';
import { FedCalendarCollector } from './collectors/fed-calendar.collector.js';
import { BlsCalendarCollector } from './collectors/bls-calendar.collector.js';
import { SecRssCollector } from './collectors/sec-rss.collector.js';
import { CoinMarketCalCollector } from './collectors/coinmarketcal.collector.js';
import { BinanceAnnouncementsCollector } from './collectors/binance-announcements.collector.js';
import { TokenUnlocksCollector } from './collectors/token-unlocks.collector.js';
import { AnthropicLlmClient } from './llm-client.js';
import { PrismaSessionOverviewRepository } from './repository.js';
import { TelegramPublisher } from './telegram-publisher.js';
import { PrismaActiveSetupsLoader } from './setup-loader/active-setups-loader.js';
import { SessionOverviewService } from '../../service/src/session-overview.service.js';
import { OverviewRunner } from '../../service/src/overview-runner.js';
import type { AppConfig } from './config.js';
import type { LoggerLike } from '../../service/src/ports.js';
import type { SessionOverviewDeps } from '../../service/src/service-types.js';

export function wire(config: AppConfig, logger: LoggerLike): SessionOverviewService {
  const bybitClient = new BybitHttpClient(
    config.bybit.baseUrl,
    config.bybit.apiKey,
    config.bybit.apiSecret,
  );

  const marketDataCollector = new BybitMarketDataCollector(bybitClient);
  const derivativesCollector = new BybitDerivativesCollector(bybitClient);
  const eventCollectors = [
    new BybitAnnouncementsCollector(bybitClient),
    new FedCalendarCollector(),
    new BlsCalendarCollector(),
    new SecRssCollector(),
    new BinanceAnnouncementsCollector(),
    new TokenUnlocksCollector(),
  ];

  const coinmarketcalApiKey = process.env['COINMARKETCAL_API_KEY'];
  if (coinmarketcalApiKey !== undefined && coinmarketcalApiKey !== '') {
    eventCollectors.push(new CoinMarketCalCollector(coinmarketcalApiKey));
  }

  const llmClient = new AnthropicLlmClient(config.anthropic.apiKey, config.anthropic.model);
  const repository = new PrismaSessionOverviewRepository(config.database.url);
  const setupLoader = new PrismaActiveSetupsLoader(config.database.url);

  const deps: SessionOverviewDeps = {
    marketDataCollector,
    derivativesCollector,
    eventCollectors,
    setupLoader,
    llmClient,
    repository,
    logger,
    ...(config.telegram.enabled
      ? {
          publisher: new TelegramPublisher(
            config.telegram.botToken,
            config.telegram.chatId,
          ),
        }
      : {}),
  };

  const runner = new OverviewRunner(deps);
  return new SessionOverviewService(runner, repository);
}
