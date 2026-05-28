import { z } from 'zod';

export const OverviewOutputSchema = z.object({
  reportId: z.string(),
  createdAt: z.string(),
  session: z.enum(['ASIA_CRYPTO', 'EUROPE_CRYPTO', 'US_CRYPTO']),
  timezone: z.string(),

  overview: z.object({
    marketTone: z.enum([
      'constructive', 'constructive_but_extended', 'neutral',
      'mixed', 'weak', 'volatile', 'unknown',
    ]),
    sessionRead: z.string(),
    confidence: z.enum(['low', 'medium', 'high']),
  }),

  btcContext: z.object({
    summary: z.string(),
    keyLevels: z.array(z.string()),
    currentPosition: z.string(),
  }),

  ethContext: z.object({
    summary: z.string(),
    ethVsBtc: z.string(),
  }),

  altcoinContext: z.object({
    summary: z.string(),
    rotationState: z.enum([
      'broad_rotation', 'selective_rotation', 'no_rotation', 'weak', 'unknown',
    ]),
  }),

  derivativesContext: z.object({
    summary: z.string(),
    fundingRead: z.string(),
    oiRead: z.string(),
    positioningRead: z.string(),
  }),

  eventsContext: z.object({
    summary: z.string(),
    importantEvents: z.array(z.object({
      title: z.string(),
      importance: z.enum(['critical', 'high', 'medium']),
      relevance: z.string(),
    })),
  }),

  assetsInFocus: z.array(z.object({
    symbol: z.string(),
    reason: z.string(),
  })),

  setupsInFocus: z.array(z.object({
    setupId: z.string(),
    symbol: z.string(),
    reason: z.string(),
  })),

  levelsToWatch: z.array(z.object({
    symbol: z.string(),
    levelType: z.enum(['weekly', 'daily', '4h', 'session']),
    level: z.string(),
    reason: z.string(),
  })),

  sessionNotes: z.array(z.string()),
  humanSummary: z.string(),
});

export type OverviewOutput = z.infer<typeof OverviewOutputSchema>;
