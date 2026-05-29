import { describe, it, expect, vi, afterEach } from 'vitest';
import { FarsideEtfCollector } from '../../src/collectors/farside-etf.collector.js';
import type { CollectorRunContext } from '../../../service/src/ports.js';

const ctx = {} as CollectorRunContext;

function makeHtml(rows: string[]): string {
  const trs = rows.map((r) => `<tr>${r}</tr>`).join('\n');
  return `<html><body><table>${trs}</table></body></html>`;
}

function dateRow(date: string, ...values: string[]): string {
  return `<td>${date}</td>` + values.map((v) => `<td>${v}</td>`).join('');
}

afterEach(() => { vi.restoreAllMocks(); });

describe('FarsideEtfCollector', () => {
  it('extracts btcFlowUsd from the last data row (Total column)', async () => {
    const html = makeHtml([
      dateRow('01/01/2025', '200.0', '150.3', '50.0', '400.3'),
      dateRow('02/01/2025', '100.0', '75.0', '25.5', '200.5'),
    ]);

    let callCount = 0;
    vi.stubGlobal('fetch', vi.fn().mockImplementation(() => {
      callCount++;
      return Promise.resolve(new Response(html, { status: 200 }));
    }));

    const collector = new FarsideEtfCollector();
    const result = await collector.collect(ctx);

    expect(result.status).toBe('success');
    // Total = 200.5 million → 200,500,000 USD
    expect(result.data?.btcFlowUsd).toBeCloseTo(200_500_000, -3);
    expect(result.data?.source).toBe('farside');
  });

  it('converts Farside parentheses negatives to negative USD values', async () => {
    const html = makeHtml([
      dateRow('03/01/2025', '(50.0)', '(30.0)', '(80.0)'),
    ]);

    vi.stubGlobal('fetch', vi.fn().mockImplementation(() =>
      Promise.resolve(new Response(html, { status: 200 })),
    ));

    const collector = new FarsideEtfCollector();
    const result = await collector.collect(ctx);

    expect(result.data?.btcFlowUsd).toBeLessThan(0);
  });

  it('returns partial when no data rows are found in HTML', async () => {
    const html = '<html><body><table><tr><th>Date</th><th>Total</th></tr></table></body></html>';

    vi.stubGlobal('fetch', vi.fn().mockImplementation(() =>
      Promise.resolve(new Response(html, { status: 200 })),
    ));

    const collector = new FarsideEtfCollector();
    const result = await collector.collect(ctx);

    expect(result.status).toBe('partial');
    expect(result.data).toBeUndefined();
  });

  it('still returns BTC data when ETH fetch fails', async () => {
    const btcHtml = makeHtml([dateRow('02/01/2025', '500.0', '300.0', '800.0')]);

    let callCount = 0;
    vi.stubGlobal('fetch', vi.fn().mockImplementation(() => {
      callCount++;
      if (callCount === 1) return Promise.resolve(new Response(btcHtml, { status: 200 }));
      return Promise.resolve(new Response('Not Found', { status: 404 }));
    }));

    const collector = new FarsideEtfCollector();
    const result = await collector.collect(ctx);

    // BTC succeeded, ETH failed (catch swallowed) → partial but has btcFlowUsd
    expect(result.data?.btcFlowUsd).toBeGreaterThan(0);
    expect(result.data?.ethFlowUsd).toBeUndefined();
  });

  it('skips header rows without date pattern', async () => {
    const html = makeHtml([
      '<td>Date</td><td>Total</td>',
      dateRow('05/01/2025', '123.4', '456.7', '580.1'),
    ]);

    vi.stubGlobal('fetch', vi.fn().mockImplementation(() =>
      Promise.resolve(new Response(html, { status: 200 })),
    ));

    const collector = new FarsideEtfCollector();
    const result = await collector.collect(ctx);

    expect(result.data?.btcFlowUsd).toBeCloseTo(580_100_000, -3);
  });
});
