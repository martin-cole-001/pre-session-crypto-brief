import { describe, it, expect } from 'vitest';
import { computeDedupeKey, deduplicateEvents } from '../../src/events/event-dedupe.js';
import type { NormalizedEvent } from '../../src/events/event.types.js';

describe('computeDedupeKey', () => {
  it('returns source:slug:datePrefix format', () => {
    const key = computeDedupeKey('cryptopanic', 'Bitcoin ETF Approval News', '2024-01-15');
    expect(key).toBe('cryptopanic:bitcoin-etf-approval-news:2024-01-15');
  });

  it('slugifies special characters', () => {
    const key = computeDedupeKey('src', 'Hello, World! Event #1', '2024-01-01');
    expect(key).toBe('src:hello-world-event-1:2024-01-01');
  });

  it('strips leading and trailing dashes from slug', () => {
    const key = computeDedupeKey('src', '!!! Breaking News !!!', '2024-01-01');
    expect(key).toBe('src:breaking-news:2024-01-01');
  });
});

function makeEvent(dedupeKey: string, id: string): NormalizedEvent {
  return {
    eventId: id,
    eventType: 'fomc',
    category: 'macro',
    title: 'FOMC Meeting',
    detectedAt: '2024-01-15T14:00:00Z',
    importance: 'high',
    sessionRelevance: ['US_CRYPTO'],
    source: 'test',
    summary: 'Fed meeting',
    confidence: 'high',
    dedupeKey,
    relevanceScore: 0.85,
  };
}

describe('deduplicateEvents', () => {
  it('keeps the first occurrence and removes duplicates', () => {
    const events: NormalizedEvent[] = [
      makeEvent('src:fomc:2024-01-15', 'event-1'),
      makeEvent('src:fomc:2024-01-15', 'event-2'),
      makeEvent('src:cpi:2024-01-15', 'event-3'),
    ];
    const result = deduplicateEvents(events);
    expect(result).toHaveLength(2);
    expect(result[0]!.eventId).toBe('event-1');
    expect(result[1]!.eventId).toBe('event-3');
  });

  it('returns all events when no duplicates', () => {
    const events: NormalizedEvent[] = [
      makeEvent('src:fomc:2024-01-15', 'event-1'),
      makeEvent('src:cpi:2024-01-15', 'event-2'),
    ];
    expect(deduplicateEvents(events)).toHaveLength(2);
  });

  it('returns empty array for empty input', () => {
    expect(deduplicateEvents([])).toHaveLength(0);
  });
});
