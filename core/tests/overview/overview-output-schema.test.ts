import { describe, it, expect } from 'vitest';
import { OverviewOutputSchema } from '../../src/overview/overview-output.schema.js';

function makeValidOutput() {
  return {
    reportId: 'report-001',
    createdAt: '2024-01-15T14:00:00Z',
    session: 'US_CRYPTO' as const,
    timezone: 'UTC',
    overview: {
      marketTone: 'constructive' as const,
      sessionRead: 'Price holding above previous session midpoint',
      confidence: 'high' as const,
    },
    btcContext: {
      summary: 'BTC trading near weekly highs',
      keyLevels: ['45000', '48000', '50000'],
      currentPosition: 'above_weekly_midpoint',
    },
    ethContext: {
      summary: 'ETH slightly outperforming BTC',
      ethVsBtc: 'slightly_outperforming',
    },
    altcoinContext: {
      summary: 'Selective altcoin rotation underway',
      rotationState: 'selective_rotation' as const,
    },
    derivativesContext: {
      summary: 'Funding neutral, OI rising',
      fundingRead: 'neutral',
      oiRead: 'rising steadily',
      positioningRead: 'balanced',
    },
    eventsContext: {
      summary: 'FOMC minutes later today',
      importantEvents: [
        {
          title: 'FOMC Minutes',
          importance: 'high' as const,
          relevance: 'Could move BTC/USD significantly',
        },
      ],
    },
    assetsInFocus: [
      { symbol: 'BTCUSDT', reason: 'Near weekly resistance' },
    ],
    setupsInFocus: [
      { setupId: 'setup-001', symbol: 'ETHUSDT', reason: 'AOI in play' },
    ],
    levelsToWatch: [
      {
        symbol: 'BTCUSDT',
        levelType: 'weekly' as const,
        level: '50000',
        reason: 'Previous weekly high',
      },
    ],
    sessionNotes: ['Watch for FOMC reaction', 'BTC dominance trending up'],
    humanSummary: 'Cautiously constructive session ahead of FOMC.',
  };
}

describe('OverviewOutputSchema', () => {
  it('parses a valid minimal output without throwing', () => {
    const valid = makeValidOutput();
    expect(() => OverviewOutputSchema.parse(valid)).not.toThrow();
    const result = OverviewOutputSchema.parse(valid);
    expect(result.reportId).toBe('report-001');
    expect(result.session).toBe('US_CRYPTO');
  });

  it('throws ZodError when reportId is missing', () => {
    const invalid = { ...makeValidOutput(), reportId: undefined };
    expect(() => OverviewOutputSchema.parse(invalid)).toThrow();
  });

  it('throws ZodError for invalid marketTone enum', () => {
    const invalid = {
      ...makeValidOutput(),
      overview: { ...makeValidOutput().overview, marketTone: 'super_bullish' },
    };
    expect(() => OverviewOutputSchema.parse(invalid)).toThrow();
  });

  it('throws ZodError for invalid session enum', () => {
    const invalid = { ...makeValidOutput(), session: 'LONDON' };
    expect(() => OverviewOutputSchema.parse(invalid)).toThrow();
  });

  it('throws ZodError for invalid rotationState', () => {
    const invalid = {
      ...makeValidOutput(),
      altcoinContext: { ...makeValidOutput().altcoinContext, rotationState: 'mega_rotation' },
    };
    expect(() => OverviewOutputSchema.parse(invalid)).toThrow();
  });

  it('parses empty arrays for optional array fields', () => {
    const valid = {
      ...makeValidOutput(),
      assetsInFocus: [],
      setupsInFocus: [],
      levelsToWatch: [],
      sessionNotes: [],
    };
    expect(() => OverviewOutputSchema.parse(valid)).not.toThrow();
  });
});
