import { describe, it, expect } from 'vitest';
import {
  extractSessionHighLow,
  detectSessionContinuation,
} from '../../src/context/session-context.js';
import type { HtfCandle } from '../../src/levels/htf-levels.js';

function makeCandle(openTimeMs: number, high: number, low: number, open: number, close: number): HtfCandle {
  return { openTimeMs, closeTimeMs: openTimeMs + 14_400_000, high, low, open, close, volume: 1000 };
}

const boundary = { startMs: 1_000, endMs: 5_000 };

const candles: HtfCandle[] = [
  makeCandle(500, 110, 90, 95, 105),   // before boundary
  makeCandle(1_000, 120, 95, 100, 115), // inside
  makeCandle(2_000, 125, 100, 115, 118), // inside
  makeCandle(5_000, 130, 105, 118, 128), // at endMs (excluded)
];

describe('extractSessionHighLow', () => {
  it('filters candles to boundary and returns correct high/low', () => {
    const result = extractSessionHighLow('ASIA_CRYPTO', candles, boundary);
    expect(result).not.toBeNull();
    expect(result!.high).toBe(125);
    expect(result!.low).toBe(95);
    expect(result!.open).toBe(100);
    expect(result!.session).toBe('ASIA_CRYPTO');
  });

  it('returns null when no candles fall in boundary', () => {
    const result = extractSessionHighLow('ASIA_CRYPTO', candles, { startMs: 10_000, endMs: 20_000 });
    expect(result).toBeNull();
  });

  it('midpoint is average of high and low', () => {
    const result = extractSessionHighLow('ASIA_CRYPTO', candles, boundary);
    expect(result!.midpoint).toBe((125 + 95) / 2);
  });
});

describe('detectSessionContinuation', () => {
  const prevSession = {
    session: 'ASIA_CRYPTO' as const,
    high: 100,
    low: 80,
    midpoint: 90,
    open: 85,
  };

  it('returns breakout_above when price is > 0.1% above high', () => {
    expect(detectSessionContinuation(102, prevSession)).toBe('breakout_above');
  });

  it('returns breakout_below when price is > 0.1% below low', () => {
    expect(detectSessionContinuation(79, prevSession)).toBe('breakout_below');
  });

  it('returns inside_range for a neutral mid-range price', () => {
    // open=85 < midpoint=90, currentPrice=88 > open but open<midpoint → not continuation_bullish
    // open=85 < midpoint=90, but we need open < midpoint AND currentPrice < open for continuation_bearish
    // 88 > 85, so neither bearish continuation
    // in top 20%: high - range*0.2 = 100 - 20*0.2 = 96, so < 96 → not rejection_from_high
    // in bottom 20%: low + range*0.2 = 80 + 4 = 84, 88 > 84 → not rejection_from_low
    // open(85) < midpoint(90) and price(88) > open(85) → does NOT satisfy continuation_bearish
    // open(85) < midpoint(90), for continuation_bullish: need open > midpoint → false
    expect(detectSessionContinuation(88, prevSession)).toBe('inside_range');
  });

  it('returns rejection_from_high when in top 20% of range', () => {
    // top 20%: high - range*0.2 = 100 - 4 = 96, price=97 >= 96
    expect(detectSessionContinuation(97, prevSession)).toBe('rejection_from_high');
  });

  it('returns rejection_from_low when in bottom 20% of range', () => {
    // bottom 20%: low + range*0.2 = 80 + 4 = 84, price=82 <= 84
    expect(detectSessionContinuation(82, prevSession)).toBe('rejection_from_low');
  });
});
