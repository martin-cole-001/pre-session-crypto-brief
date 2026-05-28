import { describe, it, expect } from 'vitest';
import {
  computeMidpoint,
  computeDistanceTo,
  computeWeeklyLevels,
  computeFourHourLevels,
} from '../../src/levels/htf-levels.js';
import type { HtfCandle } from '../../src/levels/htf-levels.js';

function makeCandle(overrides: Partial<HtfCandle> & { high: number; low: number; open: number; close: number }): HtfCandle {
  return {
    openTimeMs: overrides.openTimeMs ?? 0,
    closeTimeMs: overrides.closeTimeMs ?? 3_600_000,
    volume: overrides.volume ?? 1000,
    ...overrides,
  };
}

describe('computeMidpoint', () => {
  it('returns average of high and low', () => {
    expect(computeMidpoint(100, 80)).toBe(90);
    expect(computeMidpoint(50000, 40000)).toBe(45000);
  });
});

describe('computeDistanceTo', () => {
  it('returns above when price is significantly above level', () => {
    const result = computeDistanceTo(105, 100);
    expect(result.direction).toBe('above');
    expect(result.absoluteDistance).toBe(5);
    expect(result.percentDistance).toBeCloseTo(5, 1);
  });

  it('returns below when price is significantly below level', () => {
    const result = computeDistanceTo(95, 100);
    expect(result.direction).toBe('below');
    expect(result.absoluteDistance).toBe(-5);
  });

  it('returns at when price is within 0.1% of level', () => {
    const result = computeDistanceTo(100.05, 100);
    expect(result.direction).toBe('at');
  });
});

describe('computeWeeklyLevels', () => {
  const candles: HtfCandle[] = [
    makeCandle({ openTimeMs: 1000, high: 50000, low: 44000, open: 45000, close: 48000 }),
    makeCandle({ openTimeMs: 2000, high: 52000, low: 46000, open: 48000, close: 49000 }),
    makeCandle({ openTimeMs: 3000, high: 53000, low: 47000, open: 49000, close: 51000 }),
  ];

  it('uses second-to-last candle as previousWeek', () => {
    const result = computeWeeklyLevels(50000, candles);
    expect(result.previousWeekHigh).toBe(52000);
    expect(result.previousWeekLow).toBe(46000);
    expect(result.previousWeekClose).toBe(49000);
  });

  it('uses last candle open as currentWeekOpen', () => {
    const result = computeWeeklyLevels(50000, candles);
    expect(result.currentWeekOpen).toBe(49000);
  });

  it('computes weeklyMidpoint from previousWeek high/low', () => {
    const result = computeWeeklyLevels(50000, candles);
    expect(result.weeklyMidpoint).toBe(computeMidpoint(52000, 46000));
  });

  it('falls back gracefully with single candle', () => {
    const single = [makeCandle({ high: 50000, low: 45000, open: 46000, close: 49000 })];
    const result = computeWeeklyLevels(47000, single);
    expect(result.previousWeekHigh).toBe(50000);
    expect(result.currentWeekOpen).toBe(46000);
  });
});

describe('computeFourHourLevels', () => {
  const baseCandles: HtfCandle[] = Array.from({ length: 10 }, (_, i) =>
    makeCandle({
      openTimeMs: i * 14_400_000,
      high: 100 + i,
      low: 90 + i,
      open: 92 + i,
      close: 98 + i,
    })
  );

  it('returns a valid structure field', () => {
    const result = computeFourHourLevels(100, baseCandles);
    expect(['bullish', 'bearish', 'range', 'transition']).toContain(result.structure);
  });

  it('lastSwingHigh is max of all highs', () => {
    const result = computeFourHourLevels(100, baseCandles);
    const expectedHigh = Math.max(...baseCandles.map((c) => c.high));
    expect(result.lastSwingHigh).toBe(expectedHigh);
  });

  it('lastSwingLow is min of all lows', () => {
    const result = computeFourHourLevels(100, baseCandles);
    const expectedLow = Math.min(...baseCandles.map((c) => c.low));
    expect(result.lastSwingLow).toBe(expectedLow);
  });

  it('supportZone is around swingLow', () => {
    const result = computeFourHourLevels(100, baseCandles);
    expect(result.supportZone.low).toBeCloseTo(result.lastSwingLow * 0.997, 5);
    expect(result.supportZone.high).toBeCloseTo(result.lastSwingLow * 1.003, 5);
  });

  it('handles empty candles gracefully', () => {
    const result = computeFourHourLevels(100, []);
    expect(result.lastSwingHigh).toBe(100);
    expect(result.lastSwingLow).toBe(100);
  });
});
