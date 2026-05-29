import { describe, it, expect, vi, afterEach } from 'vitest';
import { FredRatesCollector } from '../../src/collectors/fred-rates.collector.js';
import type { CollectorRunContext } from '../../../service/src/ports.js';

const ctx = {} as CollectorRunContext;

function mockFredResponse(value: string): Response {
  return new Response(
    JSON.stringify({ observations: [{ date: '2024-01-01', value }] }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  );
}

function mockFredPceResponse(values: string[]): Response {
  const observations = values.map((v, i) => ({
    date: `${2022 + Math.floor(i / 12)}-${String((i % 12) + 1).padStart(2, '0')}-01`,
    value: v,
  }));
  return new Response(
    JSON.stringify({ observations }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  );
}

afterEach(() => { vi.restoreAllMocks(); });

describe('FredRatesCollector', () => {
  it('returns success with all four fields when FRED responds normally', async () => {
    // Build 14 PCEPI observations (desc order) so [0]=latest, [12]=year-ago
    const pceValues = Array.from({ length: 14 }, (_, i) => String(100 + i * 0.3));
    const pceLatest = pceValues[0]!;
    const pceYearAgo = pceValues[12]!;

    let callCount = 0;
    vi.stubGlobal('fetch', vi.fn().mockImplementation(() => {
      callCount++;
      if (callCount === 1) return Promise.resolve(mockFredResponse('5.33')); // FEDFUNDS
      if (callCount === 2) return Promise.resolve(mockFredResponse('4.15')); // DGS10
      if (callCount === 3) return Promise.resolve(mockFredResponse('4.80')); // DGS2
      // PCEPI: return 14 values desc
      return Promise.resolve(mockFredPceResponse(pceValues));
    }));

    const collector = new FredRatesCollector('test-key');
    const result = await collector.collect(ctx);

    expect(result.status).toBe('success');
    expect(result.data?.fedFundsRate).toBe(5.33);
    expect(result.data?.us10yYield).toBe(4.15);
    expect(result.data?.us2yYield).toBe(4.80);
    expect(result.data?.pceYoY).toBeTypeOf('number');
    // pceYoY = (latest - yearAgo) / yearAgo * 100
    const expectedPce = parseFloat(((parseFloat(pceLatest) - parseFloat(pceYearAgo)) / parseFloat(pceYearAgo) * 100).toFixed(2));
    expect(result.data?.pceYoY).toBeCloseTo(expectedPce, 1);
  });

  it('skips "." values (FRED missing data sentinel) and returns partial if all are missing', async () => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation(() =>
      Promise.resolve(new Response(JSON.stringify({ observations: [{ date: '2024-01-01', value: '.' }] }), { status: 200 })),
    ));

    const collector = new FredRatesCollector('test-key');
    const result = await collector.collect(ctx);

    expect(result.status).toBe('partial');
    expect(result.data).toBeUndefined();
  });

  it('throws when FRED returns non-200', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response('Unauthorized', { status: 403 }),
    ));

    const collector = new FredRatesCollector('bad-key');
    await expect(collector.collect(ctx)).rejects.toThrow('403');
  });

  it('sets itemCount equal to number of non-undefined fields', async () => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation((url: string) => {
      if ((url as string).includes('FEDFUNDS')) return Promise.resolve(mockFredResponse('5.25'));
      if ((url as string).includes('DGS10')) return Promise.resolve(mockFredResponse('.')); // missing
      if ((url as string).includes('DGS2')) return Promise.resolve(mockFredResponse('4.70'));
      // PCEPI — return only 1 obs (insufficient for YoY)
      return Promise.resolve(mockFredPceResponse(['115.0']));
    }));

    const collector = new FredRatesCollector('test-key');
    const result = await collector.collect(ctx);

    expect(result.data?.fedFundsRate).toBe(5.25);
    expect(result.data?.us10yYield).toBeUndefined();
    expect(result.data?.us2yYield).toBe(4.70);
    expect(result.itemCount).toBe(2); // fedFunds + us2y (pceYoY undefined, us10y undefined)
  });
});
