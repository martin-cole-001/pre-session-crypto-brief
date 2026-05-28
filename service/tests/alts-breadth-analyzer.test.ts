import { describe, it, expect } from 'vitest';
import { analyzeAltsBreadth } from '../src/alts-breadth-analyzer.js';
import type { OverviewMarketSnapshot } from '../src/ports.js';

function makeCandle(close: number) {
  return {
    openTimeMs: Date.now() - 86400000,
    closeTimeMs: Date.now(),
    open: close * 0.99,
    high: close * 1.01,
    low: close * 0.98,
    close,
    volume: 1000,
  };
}

function makeSnapshot(symbol: string, prevClose: number, currClose: number): OverviewMarketSnapshot {
  return {
    symbol,
    latestPrice: currClose,
    candles: {
      weekly: [],
      daily: [makeCandle(prevClose), makeCandle(currClose)],
      fourHour: [],
    },
  };
}

const BTC = makeSnapshot('BTCUSDT', 100_000, 101_000); // +1%
const ETH = makeSnapshot('ETHUSDT', 3_000, 3_030);   // +1%

describe('analyzeAltsBreadth()', () => {
  it('returns unknown rotationState and 0 totalTracked when no non-excluded snapshots', () => {
    const result = analyzeAltsBreadth([BTC, ETH]);
    expect(result.rotationState).toBe('unknown');
    expect(result.totalTracked).toBe(0);
    expect(result.breadthLabel).toBe('data unavailable');
  });

  it('returns unknown when snapshots list is empty', () => {
    const result = analyzeAltsBreadth([]);
    expect(result.rotationState).toBe('unknown');
  });

  it('broad_rotation: >= 65% alts positive and outperforming BTC by > 0.3%', () => {
    // BTC +1%. Alts all up +3% → outperforming by ~2%
    const alts = [
      makeSnapshot('ALT1USDT', 10, 10.3),
      makeSnapshot('ALT2USDT', 20, 20.6),
      makeSnapshot('ALT3USDT', 30, 30.9),
    ];
    const result = analyzeAltsBreadth([BTC, ...alts]);
    expect(result.rotationState).toBe('broad_rotation');
    expect(result.breadthPercent).toBe(100);
    expect(result.positiveCount).toBe(3);
    expect(result.totalTracked).toBe(3);
  });

  it('selective_rotation: >= 65% alts positive but in line with BTC (no outperformance)', () => {
    // BTC +1%. Alts all up +1% → not outperforming
    const alts = [
      makeSnapshot('ALT1USDT', 10, 10.1),
      makeSnapshot('ALT2USDT', 20, 20.2),
      makeSnapshot('ALT3USDT', 30, 30.3),
    ];
    const result = analyzeAltsBreadth([BTC, ...alts]);
    expect(result.rotationState).toBe('selective_rotation');
  });

  it('selective_rotation: 35-64% alts positive', () => {
    // 2 of 4 positive = 50%
    const alts = [
      makeSnapshot('ALT1USDT', 10, 10.5),  // +5%
      makeSnapshot('ALT2USDT', 20, 20.5),  // +2.5%
      makeSnapshot('ALT3USDT', 30, 29.5),  // -1.7%
      makeSnapshot('ALT4USDT', 40, 39.0),  // -2.5%
    ];
    const result = analyzeAltsBreadth([BTC, ...alts]);
    expect(result.rotationState).toBe('selective_rotation');
    expect(result.breadthPercent).toBe(50);
  });

  it('no_rotation: < 35% positive and average return not deeply negative', () => {
    // 1 of 4 positive = 25%, avg return ~-0.5%
    const alts = [
      makeSnapshot('ALT1USDT', 10, 10.1),   // +1%
      makeSnapshot('ALT2USDT', 20, 19.9),   // -0.5%
      makeSnapshot('ALT3USDT', 30, 29.85),  // -0.5%
      makeSnapshot('ALT4USDT', 40, 39.8),   // -0.5%
    ];
    const result = analyzeAltsBreadth([BTC, ...alts]);
    expect(result.rotationState).toBe('no_rotation');
    expect(result.breadthPercent).toBe(25);
  });

  it('weak: < 35% positive and average return < -1%', () => {
    // 1 of 4 = 25%, avg return heavily negative
    const alts = [
      makeSnapshot('ALT1USDT', 10, 10.1),  // +1%
      makeSnapshot('ALT2USDT', 20, 19.0),  // -5%
      makeSnapshot('ALT3USDT', 30, 28.5),  // -5%
      makeSnapshot('ALT4USDT', 40, 38.0),  // -5%
    ];
    const result = analyzeAltsBreadth([BTC, ...alts]);
    expect(result.rotationState).toBe('weak');
    expect(result.breadthPercent).toBe(25);
  });

  it('all alts negative → weak when avg return < -1%', () => {
    const alts = [
      makeSnapshot('ALT1USDT', 10, 9.0),   // -10%
      makeSnapshot('ALT2USDT', 20, 18.0),  // -10%
      makeSnapshot('ALT3USDT', 30, 27.0),  // -10%
    ];
    const result = analyzeAltsBreadth([BTC, ...alts]);
    expect(result.rotationState).toBe('weak');
    expect(result.breadthPercent).toBe(0);
    expect(result.positiveCount).toBe(0);
  });

  it('breadthLabel contains percentage and count', () => {
    const alts = [
      makeSnapshot('ALT1USDT', 10, 10.5),
      makeSnapshot('ALT2USDT', 20, 20.5),
    ];
    const result = analyzeAltsBreadth([BTC, ...alts]);
    expect(result.breadthLabel).toContain('%');
    expect(result.breadthLabel).toContain('2');
  });

  it('excludes BTCUSDT and ETHUSDT from breadth count by default', () => {
    const alts = [makeSnapshot('SOLUSDT', 200, 210)];
    const result = analyzeAltsBreadth([BTC, ETH, ...alts]);
    expect(result.totalTracked).toBe(1);
  });

  it('respects custom excludeSymbols list', () => {
    const snapshots = [BTC, ETH, makeSnapshot('SOLUSDT', 200, 210)];
    const result = analyzeAltsBreadth(snapshots, ['BTCUSDT']); // only exclude BTC
    expect(result.totalTracked).toBe(2); // ETH + SOL
  });

  it('handles snapshot with fewer than 2 daily candles as zero return', () => {
    const missingHistory: OverviewMarketSnapshot = {
      symbol: 'ALT1USDT',
      latestPrice: 10,
      candles: { weekly: [], daily: [makeCandle(10)], fourHour: [] },
    };
    const result = analyzeAltsBreadth([BTC, missingHistory]);
    expect(result.totalTracked).toBe(1);
    // single candle → 0 return → not positive → no_rotation or weak
    expect(['no_rotation', 'weak']).toContain(result.rotationState);
  });

  it('output always contains all required fields', () => {
    const result = analyzeAltsBreadth([BTC, makeSnapshot('SOLUSDT', 100, 105)]);
    expect(result).toHaveProperty('breadthPercent');
    expect(result).toHaveProperty('positiveCount');
    expect(result).toHaveProperty('totalTracked');
    expect(result).toHaveProperty('breadthLabel');
    expect(result).toHaveProperty('rotationState');
  });
});
