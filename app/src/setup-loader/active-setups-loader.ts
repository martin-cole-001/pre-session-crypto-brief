import { PrismaClient } from '../generated/prisma-client/index.js';
import type { ActiveSetupsLoader, ActiveOverviewSetup } from '../../../service/src/ports.js';

const ALLOWED_TIMEFRAME_SOURCES = new Set(['Weekly', 'Daily', '4H', 'Session']);

export class PrismaActiveSetupsLoader implements ActiveSetupsLoader {
  private readonly prisma: PrismaClient;

  constructor(databaseUrl: string) {
    this.prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
  }

  async loadActive(symbols: string[]): Promise<ActiveOverviewSetup[]> {
    const rows = await this.prisma.activeSetup.findMany({
      where: {
        symbol: { in: symbols },
        status: 'ACTIVE',
        timeframeSource: { in: Array.from(ALLOWED_TIMEFRAME_SOURCES) },
      },
    });

    return rows.map((row) => {
      const setup: ActiveOverviewSetup = {
        setupId: row.setupId,
        symbol: row.symbol,
        direction: row.direction as 'LONG' | 'SHORT',
        setupType: row.setupType,
        timeframeSource: row.timeframeSource as ActiveOverviewSetup['timeframeSource'],
        status: row.status,
      };

      if (row.relevantZoneLow !== null && row.relevantZoneHigh !== null) {
        return { ...setup, relevantZone: { low: row.relevantZoneLow, high: row.relevantZoneHigh } };
      }

      if (row.invalidation !== null) {
        return { ...setup, invalidation: row.invalidation };
      }

      return setup;
    });
  }
}
