import { describe, it, expect, vi, afterEach } from 'vitest';
import { DefiLlamaStablecoinsCollector } from '../../src/collectors/defillama-stablecoins.collector.js';
import type { CollectorRunContext } from '../../../service/src/ports.js';

const ctx = {} as CollectorRunContext;

function makeStablecoinsResponse(assets: object[]): Response {
  return new Response(
    JSON.stringify({ peggedAssets: assets }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  );
}

const USDT = {
  symbol: 'USDT', name: 'Tether', pegType: 'peggedUSD', price: 1.0,
  circulating: { peggedUSD: 90_000_000_000 },
  circulatingPrevDay: { peggedUSD: 89_500_000_000 },
  circulatingPrevWeek: { peggedUSD: 88_000_000_000 },
};
const USDC = {
  symbol: 'USDC', name: 'USD Coin', pegType: 'peggedUSD', price: 1.0,
  circulating: { peggedUSD: 30_000_000_000 },
  circulatingPrevDay: { peggedUSD: 30_000_000_000 },
  circulatingPrevWeek: { peggedUSD: 29_000_000_000 },
};
const EURC = {
  symbol: 'EURC', name: 'Euro Coin', pegType: 'peggedEUR', price: 1.08,
  circulating: { peggedUSD: 100_000_000 }, // filtered out — not USD-pegged
};

afterEach(() => { vi.restoreAllMocks(); });

describe('DefiLlamaStablecoinsCollector', () => {
  it('sums total USD-pegged supply and excludes non-USD pegs', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(makeStablecoinsResponse([USDT, USDC, EURC])));

    const collector = new DefiLlamaStablecoinsCollector();
    const result = await collector.collect(ctx);

    expect(result.status).toBe('success');
    expect(result.data?.totalSupplyUsd).toBe(120_000_000_000);
    // EURC excluded from totals
  });

  it('computes dayChangeUsd and weekChangeUsd', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(makeStablecoinsResponse([USDT, USDC])));

    const collector = new DefiLlamaStablecoinsCollector();
    const result = await collector.collect(ctx);

    // totalSupply = 120B; totalPrevDay = 89.5B + 30B = 119.5B; dayChange = +0.5B
    expect(result.data?.dayChangeUsd).toBeCloseTo(500_000_000, -5);
    // totalPrevWeek = 88B + 29B = 117B; weekChange = +3B
    expect(result.data?.weekChangeUsd).toBeCloseTo(3_000_000_000, -5);
  });

  it('marks stablecoin as depegged when price is outside 0.99–1.01', async () => {
    const depegged = { ...USDT, symbol: 'USDD', price: 0.97 };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(makeStablecoinsResponse([depegged])));

    const collector = new DefiLlamaStablecoinsCollector();
    const result = await collector.collect(ctx);

    expect(result.data?.topStablecoins[0]?.pegStatus).toBe('depegged');
  });

  it('returns top 5 stablecoins sorted by supply desc', async () => {
    const assets = Array.from({ length: 8 }, (_, i) => ({
      symbol: `S${i}`, name: `Stable${i}`, pegType: 'peggedUSD', price: 1.0,
      circulating: { peggedUSD: (8 - i) * 10_000_000_000 },
    }));
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(makeStablecoinsResponse(assets)));

    const collector = new DefiLlamaStablecoinsCollector();
    const result = await collector.collect(ctx);

    expect(result.data?.topStablecoins).toHaveLength(5);
    expect(result.data?.topStablecoins[0]?.symbol).toBe('S0'); // highest supply
  });

  it('returns partial when peggedAssets array is empty', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(makeStablecoinsResponse([])));

    const collector = new DefiLlamaStablecoinsCollector();
    const result = await collector.collect(ctx);

    expect(result.status).toBe('partial');
  });

  it('throws when fetch fails with non-200', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('Service Unavailable', { status: 503 })));

    const collector = new DefiLlamaStablecoinsCollector();
    await expect(collector.collect(ctx)).rejects.toThrow('503');
  });
});
