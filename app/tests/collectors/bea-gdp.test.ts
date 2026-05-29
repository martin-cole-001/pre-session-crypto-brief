import { describe, it, expect, vi, afterEach } from 'vitest';
import { BeaGdpCollector } from '../../src/collectors/bea-gdp.collector.js';
import type { CollectorRunContext } from '../../../service/src/ports.js';

const ctx = {} as CollectorRunContext;

function makeBeaResponse(rows: { Year: string; Period: string; DataValue: string; LineNumber: string }[]): Response {
  return new Response(
    JSON.stringify({ BEAAPI: { Results: { Data: rows } } }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  );
}

afterEach(() => { vi.restoreAllMocks(); });

describe('BeaGdpCollector', () => {
  it('returns success with gdpGrowthQoQ for the latest quarter', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(makeBeaResponse([
      { Year: '2023', Period: 'Q3', DataValue: '4.9', LineNumber: '1' },
      { Year: '2023', Period: 'Q4', DataValue: '3.4', LineNumber: '1' },
      { Year: '2024', Period: 'Q1', DataValue: '1.4', LineNumber: '1' },
      { Year: '2024', Period: 'Q3', DataValue: '2.8', LineNumber: '1' }, // latest by sort
    ])));

    const collector = new BeaGdpCollector('test-key');
    const result = await collector.collect(ctx);

    expect(result.status).toBe('success');
    expect(result.data?.gdpGrowthQoQ).toBe(2.8);
    expect(result.data?.dataDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('returns partial when Data array is empty', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ BEAAPI: { Results: { Data: [] } } }), { status: 200 }),
    ));

    const collector = new BeaGdpCollector('test-key');
    const result = await collector.collect(ctx);

    expect(result.status).toBe('partial');
    expect(result.data).toBeUndefined();
  });

  it('returns partial when Line 1 rows are absent', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(makeBeaResponse([
      { Year: '2024', Period: 'Q3', DataValue: '2.8', LineNumber: '99' }, // wrong line
    ])));

    const collector = new BeaGdpCollector('test-key');
    const result = await collector.collect(ctx);

    expect(result.status).toBe('partial');
  });

  it('throws when BEA returns non-200', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('Bad Gateway', { status: 502 })));

    const collector = new BeaGdpCollector('test-key');
    await expect(collector.collect(ctx)).rejects.toThrow('502');
  });

  it('handles DataValue with commas (large numbers)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(makeBeaResponse([
      { Year: '2024', Period: 'Q2', DataValue: '2,800.0', LineNumber: '1' },
    ])));

    const collector = new BeaGdpCollector('test-key');
    const result = await collector.collect(ctx);

    expect(result.status).toBe('success');
    expect(result.data?.gdpGrowthQoQ).toBe(2800.0);
  });
});
