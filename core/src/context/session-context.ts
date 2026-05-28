import type { CryptoSession, SessionBoundary } from '../session/session.types.js';
import type { HtfCandle } from '../levels/htf-levels.js';
import { computeMidpoint } from '../levels/htf-levels.js';

export type SessionHighLow = {
  session: CryptoSession;
  high: number;
  low: number;
  midpoint: number;
  open: number;
};

export type SessionContinuationRead =
  | 'continuation_bullish'
  | 'continuation_bearish'
  | 'rejection_from_high'
  | 'rejection_from_low'
  | 'inside_range'
  | 'breakout_above'
  | 'breakout_below'
  | 'unknown';

export type SessionContext = {
  currentSession: CryptoSession;
  previousSessionHighLow?: SessionHighLow;
  currentSessionOpen?: number;
  priceVsPreviousSession?: SessionContinuationRead;
};

export function extractSessionHighLow(
  session: CryptoSession,
  candles: HtfCandle[],
  boundary: { startMs: number; endMs: number }
): SessionHighLow | null {
  const filtered = candles.filter(
    (c) => c.openTimeMs >= boundary.startMs && c.openTimeMs < boundary.endMs
  );
  if (filtered.length === 0) return null;

  const high = Math.max(...filtered.map((c) => c.high));
  const low = Math.min(...filtered.map((c) => c.low));
  const open = filtered[0]!.open;
  const midpoint = computeMidpoint(high, low);

  return { session, high, low, midpoint, open };
}

export function detectSessionContinuation(
  currentPrice: number,
  previousSession: SessionHighLow
): SessionContinuationRead {
  const { high, low, midpoint, open } = previousSession;
  const range = high - low;

  if (currentPrice > previousSession.high * 1.001) return 'breakout_above';
  if (currentPrice < previousSession.low * 0.999) return 'breakout_below';

  // Top 20% of range
  if (currentPrice >= high - range * 0.2) return 'rejection_from_high';
  // Bottom 20% of range
  if (currentPrice <= low + range * 0.2) return 'rejection_from_low';

  if (open > midpoint && currentPrice > open) return 'continuation_bullish';
  if (open < midpoint && currentPrice < open) return 'continuation_bearish';

  return 'inside_range';
}

export function buildSessionContext(
  session: CryptoSession,
  currentPrice: number,
  fourHourCandles: HtfCandle[],
  previousBoundary: SessionBoundary | null
): SessionContext {
  if (previousBoundary === null) {
    return { currentSession: session };
  }

  const previousSessionHighLow = extractSessionHighLow(
    previousBoundary.session,
    fourHourCandles,
    previousBoundary
  );

  const sessionCandles = fourHourCandles.filter(
    (c) => c.openTimeMs < previousBoundary.startMs
  );
  const currentSessionOpen =
    sessionCandles.length > 0 ? sessionCandles[sessionCandles.length - 1]!.close : undefined;

  const priceVsPreviousSession =
    previousSessionHighLow !== null
      ? detectSessionContinuation(currentPrice, previousSessionHighLow)
      : undefined;

  const ctx: SessionContext = { currentSession: session };
  if (previousSessionHighLow !== null) ctx.previousSessionHighLow = previousSessionHighLow;
  if (currentSessionOpen !== undefined) ctx.currentSessionOpen = currentSessionOpen;
  if (priceVsPreviousSession !== undefined) ctx.priceVsPreviousSession = priceVsPreviousSession;
  return ctx;
}
