import { describe, it, expect, vi, afterEach } from 'vitest';
import { DefiLlamaChainsCollector } from '../../src/collectors/defillama-chains.collector.js';
import type { CollectorRunContext } from '../../../service/src/ports.js';

const ctx = {} as CollectorRunContext;

function makeTvlHistory(points: { date: number; tvl: number }[]): Response {
  return new Response(JSON.stringify(points), { status: 200 });
}

function makeChainsList(chains: { name: string; tvl: number }[]): Response {
  return new Response(JSON.stringify(chains), { status: 200 });
}

const HISTORY_8 = [
  { date: 1700000000, tvl: 40_000_000_000 }, // 8 days ago
  { date: 1700086400, tvl: 41_000_000_000 },
  { date: 1700172800, tvl: 42_000_000_000 },
  { date: 1700259200, tvl: 43_000_000_000 },
  { date: 1700345600, tvl: 44_000_000_000 },
  { date: 1700432000, tvl: 45_000_000_000 },
  { date: 1700518400, tvl: 46_000_000_000 }, // 1 day ago
  { date: 1700604800, tvl: 48_000_000_000 }, // current
];

const TOP_CHAINS = [
  { name: 'Ethereum', tvl: 25_000_000_000 },
  { name: 'BNB', tvl: 5_000_000_000 },
  { name: 'Tron', tvl: 8_000_000_000 },
];

afterEach(() => { vi.restoreAllMocks(); });

describe('DefiLlamaChainsCollector', () => {
  it('computes totalTvlUsd, dayChangePct, and weekChangePct', async () => {
    let callCount = 0;
    vi.stubGlobal('fetch', vi.fn().mockImplementation(() => {
      callCount++;
      if (callCount === 1) return Promise.resolve(makeTvlHistory(HISTORY_8));
      return Promise.resolve(makeChainsList(TOP_CHAINS));
    }));

    const collector = new DefiLlamaChainsCollector();
    const result = await collector.collect(ctx);

    expect(result.status).toBe('success');
    expect(result.data?.totalTvlUsd).toBe(48_000_000_000);
    // dayChange: (48B - 46B) / 46B * 100 ≈ 4.35
    expect(result.data?.dayChangePct).toBeCloseTo(4.35, 1);
    // weekChange: (48B - 40B) / 40B * 100 = 20.0
    expect(result.data?.weekChangePct).toBeCloseTo(20.0, 1);
  });

  it('returns top chains sorted by TVL desc, max 8', async () => {
    const chains = Array.from({ length: 15 }, (_, i) => ({ name: `Chain${i}`, tvl: (15 - i) * 1_000_000_000 }));
    let callCount = 0;
    vi.stubGlobal('fetch', vi.fn().mockImplementation(() => {
      callCount++;
      if (callCount === 1) return Promise.resolve(makeTvlHistory(HISTORY_8));
      return Promise.resolve(makeChainsList(chains));
    }));

    const collector = new DefiLlamaChainsCollector();
    const result = await collector.collect(ctx);

    expect(result.data?.topChains).toHaveLength(8);
    expect(result.data?.topChains[0]?.name).toBe('Chain0');
  });

  it('returns partial when history has fewer than 2 points', async () => {
    let callCount = 0;
    vi.stubGlobal('fetch', vi.fn().mockImplementation(() => {
      callCount++;
      if (callCount === 1) return Promise.resolve(makeTvlHistory([{ date: 1700000000, tvl: 50_000_000_000 }]));
      return Promise.resolve(makeChainsList(TOP_CHAINS));
    }));

    const collector = new DefiLlamaChainsCollector();
    const result = await collector.collect(ctx);

    expect(result.status).toBe('partial');
  });

  it('throws when history fetch returns non-200', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('Not Found', { status: 404 })));

    const collector = new DefiLlamaChainsCollector();
    await expect(collector.collect(ctx)).rejects.toThrow('404');
  });

  it('includes dataDate field in ISO date format', async () => {
    let callCount = 0;
    vi.stubGlobal('fetch', vi.fn().mockImplementation(() => {
      callCount++;
      if (callCount === 1) return Promise.resolve(makeTvlHistory(HISTORY_8));
      return Promise.resolve(makeChainsList(TOP_CHAINS));
    }));

    const collector = new DefiLlamaChainsCollector();
    const result = await collector.collect(ctx);

    expect(result.data?.dataDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
