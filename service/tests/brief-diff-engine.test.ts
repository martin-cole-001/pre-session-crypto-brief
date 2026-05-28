import { describe, it, expect } from 'vitest';
import { computeWhatChanged, firstBriefBullets } from '../src/brief-diff-engine.js';
import type { OverviewOutput } from '../src/ports.js';

function makeOutput(overrides: Partial<OverviewOutput> = {}): OverviewOutput {
  return {
    briefId: 'brief-test-1',
    generatedAtUtc: '2026-01-01T00:00:00Z',
    session: 'US_CRYPTO',
    marketRegime: 'constructive_but_extended',
    briefConfidence: 'medium',
    dataStatus: { price: 'fresh', events: 'fresh', derivatives: 'fresh', liquidations: 'unavailable' },
    whatChanged: ['No previous brief available for this session — initial reading.'],
    btc: { summary: 'BTC near resistance.', keyLevels: ['97000'], position: 'above daily midpoint', structure: 'bullish' },
    eth: { summary: 'ETH in line with BTC.', vsbtc: 'in_line', keyLevels: ['3200'] },
    majorAssets: [],
    alts: { summary: 'Alts quiet.', rotationState: 'selective_rotation', breadth: '55% green' },
    derivatives: { summary: 'Neutral.', funding: 'neutral', oi: 'stable', positioning: 'balanced' },
    events: { summary: 'Light calendar.', upcoming: [{ title: 'CPI Release', time: '2026-01-02T13:30:00Z', importance: 'critical' }] },
    scenarios: { reclaim: 'Breakout continuation.', rejection: 'Pullback to support.', chop: 'Range persists.' },
    note: 'No caveats.',
    ...overrides,
  };
}

describe('firstBriefBullets()', () => {
  it('returns the standard no-previous-brief message', () => {
    const result = firstBriefBullets();
    expect(result).toEqual(['No previous brief available for this session — initial reading.']);
  });
});

describe('computeWhatChanged()', () => {
  it('returns no-changes fallback when nothing differs', () => {
    const base = makeOutput();
    const result = computeWhatChanged(base, makeOutput());
    expect(result).toEqual(['No significant structural changes since previous brief.']);
  });

  it('detects marketRegime change', () => {
    const prev = makeOutput({ marketRegime: 'constructive_but_extended' });
    const curr = makeOutput({ marketRegime: 'risk_off' });
    const result = computeWhatChanged(prev, curr);
    expect(result).toContain('Regime: constructive but extended → risk off');
  });

  it('detects briefConfidence change', () => {
    const prev = makeOutput({ briefConfidence: 'medium' });
    const curr = makeOutput({ briefConfidence: 'high' });
    const result = computeWhatChanged(prev, curr);
    expect(result).toContain('Confidence: medium → high');
  });

  it('detects btc structure change', () => {
    const prev = makeOutput({ btc: { ...makeOutput().btc, structure: 'bullish' } });
    const curr = makeOutput({ btc: { ...makeOutput().btc, structure: 'bearish' } });
    const result = computeWhatChanged(prev, curr);
    expect(result).toContain('BTC 4H structure: bullish → bearish');
  });

  it('detects alts rotation state change', () => {
    const prev = makeOutput({ alts: { ...makeOutput().alts, rotationState: 'selective_rotation' } });
    const curr = makeOutput({ alts: { ...makeOutput().alts, rotationState: 'no_rotation' } });
    const result = computeWhatChanged(prev, curr);
    expect(result).toContain('Alt rotation: selective rotation → no rotation');
  });

  it('detects new upcoming event', () => {
    const prev = makeOutput({ events: { summary: '', upcoming: [] } });
    const curr = makeOutput({
      events: { summary: '', upcoming: [{ title: 'CPI Release', time: '2026-01-02T13:30:00Z', importance: 'critical' }] },
    });
    const result = computeWhatChanged(prev, curr);
    expect(result).toContain('New event: CPI Release (critical)');
  });

  it('detects removed event', () => {
    const prev = makeOutput({
      events: { summary: '', upcoming: [{ title: 'CPI Release', time: '2026-01-02T13:30:00Z', importance: 'critical' }] },
    });
    const curr = makeOutput({ events: { summary: '', upcoming: [] } });
    const result = computeWhatChanged(prev, curr);
    expect(result).toContain('Event resolved/removed: CPI Release');
  });

  it('detects multiple simultaneous changes', () => {
    const prev = makeOutput({ marketRegime: 'constructive_but_extended', briefConfidence: 'medium' });
    const curr = makeOutput({ marketRegime: 'risk_off', briefConfidence: 'low' });
    const result = computeWhatChanged(prev, curr);
    expect(result.length).toBe(2);
  });

  it('caps output at 8 bullets', () => {
    const prev = makeOutput({
      marketRegime: 'constructive_but_extended',
      briefConfidence: 'medium',
      btc: { ...makeOutput().btc, structure: 'bullish' },
      alts: { ...makeOutput().alts, rotationState: 'selective_rotation' },
      events: {
        summary: '',
        upcoming: [
          { title: 'CPI', time: 'T1', importance: 'critical' },
          { title: 'NFP', time: 'T2', importance: 'high' },
          { title: 'FOMC', time: 'T3', importance: 'critical' },
          { title: 'PPI', time: 'T4', importance: 'medium' },
          { title: 'PCE', time: 'T5', importance: 'medium' },
        ],
      },
    });
    const curr = makeOutput({
      marketRegime: 'risk_off',
      briefConfidence: 'low',
      btc: { ...makeOutput().btc, structure: 'bearish' },
      alts: { ...makeOutput().alts, rotationState: 'no_rotation' },
      events: { summary: '', upcoming: [{ title: 'FED Speaker', time: 'T6', importance: 'high' }] },
    });
    const result = computeWhatChanged(prev, curr);
    expect(result.length).toBeLessThanOrEqual(8);
  });

  it('does not include fallback when there are real changes', () => {
    const prev = makeOutput({ marketRegime: 'constructive_but_extended' });
    const curr = makeOutput({ marketRegime: 'risk_off' });
    const result = computeWhatChanged(prev, curr);
    expect(result).not.toContain('No significant structural changes since previous brief.');
  });
});
