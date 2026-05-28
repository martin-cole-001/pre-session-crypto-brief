import { describe, it, expect } from 'vitest';
import { computeRelevanceScore, filterByRelevance } from '../../src/events/event-relevance.js';
import type { NormalizedEvent } from '../../src/events/event.types.js';

type EventInput = Omit<NormalizedEvent, 'relevanceScore'>;

function makeEventInput(
  eventType: NormalizedEvent['eventType'],
  importance: NormalizedEvent['importance'],
  asset?: string
): EventInput {
  return {
    eventId: 'test-id',
    eventType,
    category: 'macro',
    title: 'Test Event',
    detectedAt: '2024-01-15T14:00:00Z',
    importance,
    sessionRelevance: [],
    source: 'test',
    summary: 'Test summary',
    confidence: 'medium',
    dedupeKey: 'test:test-event:2024-01-15',
    ...(asset !== undefined ? { asset } : {}),
  };
}

describe('computeRelevanceScore', () => {
  it('fomc with critical importance yields score near 1.0', () => {
    const score = computeRelevanceScore(makeEventInput('fomc', 'critical'), []);
    expect(score).toBeCloseTo(1.0, 3);
  });

  it('macro_other with low importance yields a low score', () => {
    const score = computeRelevanceScore(makeEventInput('macro_other', 'low'), []);
    expect(score).toBeLessThan(0.2);
  });

  it('asset bonus adds 0.15 when symbol matches', () => {
    const withoutBonus = computeRelevanceScore(makeEventInput('token_unlock', 'medium', 'BTC'), []);
    const withBonus = computeRelevanceScore(makeEventInput('token_unlock', 'medium', 'BTC'), ['BTCUSDT']);
    expect(withBonus - withoutBonus).toBeCloseTo(0.15, 5);
  });

  it('score is capped at 1.0', () => {
    const score = computeRelevanceScore(makeEventInput('cpi', 'critical', 'BTC'), ['BTCUSDT']);
    expect(score).toBeLessThanOrEqual(1.0);
  });

  it('no asset bonus when asset is undefined', () => {
    const noAsset = computeRelevanceScore(makeEventInput('fomc', 'high'), ['BTCUSDT']);
    const withAsset = computeRelevanceScore(makeEventInput('fomc', 'high', 'BTC'), ['BTCUSDT']);
    expect(withAsset).toBeGreaterThan(noAsset);
  });
});

describe('filterByRelevance', () => {
  const events: NormalizedEvent[] = [
    { ...makeEventInput('fomc', 'critical'), relevanceScore: 1.0, eventId: 'e1' },
    { ...makeEventInput('macro_other', 'low'), relevanceScore: 0.12, eventId: 'e2' },
    { ...makeEventInput('cpi', 'high'), relevanceScore: 0.85, eventId: 'e3' },
  ];

  it('filters out events below threshold', () => {
    const result = filterByRelevance(events, 0.5);
    expect(result).toHaveLength(2);
    expect(result.map((e) => e.eventId)).toEqual(['e1', 'e3']);
  });

  it('returns all events when threshold is 0', () => {
    expect(filterByRelevance(events, 0)).toHaveLength(3);
  });

  it('returns no events when threshold exceeds all scores', () => {
    expect(filterByRelevance(events, 1.1)).toHaveLength(0);
  });
});
