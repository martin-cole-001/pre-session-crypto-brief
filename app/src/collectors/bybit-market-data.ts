import type { MarketDataCollector, OverviewMarketSnapshot } from '../../../service/src/ports.js';
import type { BybitHttpClient } from '../bybit-http-client.js';

export class BybitMarketDataCollector implements MarketDataCollector {
  constructor(private readonly client: BybitHttpClient) {}

  async collect(symbols: string[]): Promise<OverviewMarketSnapshot[]> {
    const results = await Promise.allSettled(
      symbols.map((symbol) => this.collectOne(symbol)),
    );

    const snapshots: OverviewMarketSnapshot[] = [];
    for (const result of results) {
      if (result.status === 'fulfilled') {
        snapshots.push(result.value);
      }
    }
    return snapshots;
  }

  private async collectOne(symbol: string): Promise<OverviewMarketSnapshot> {
    const [ticker, weekly, daily, fourHour] = await Promise.all([
      this.client.getTicker(symbol),
      this.client.getKlines(symbol, 'W', 10),
      this.client.getKlines(symbol, 'D', 30),
      this.client.getKlines(symbol, '240', 60),
    ]);

    return {
      symbol,
      latestPrice: ticker.lastPrice,
      candles: {
        weekly,
        daily,
        fourHour,
      },
    };
  }
}
