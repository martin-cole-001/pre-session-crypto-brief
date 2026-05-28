import { describe, it, expect } from 'vitest';
import {
  resolveActiveSession,
  getSessionBoundaryForDate,
  getPreviousSession,
} from '../../src/session/session-windows.js';

function utcDate(hour: number): Date {
  return new Date(Date.UTC(2024, 0, 15, hour, 0, 0));
}

describe('resolveActiveSession', () => {
  it('returns ASIA_CRYPTO at hour 4', () => {
    expect(resolveActiveSession(utcDate(4))).toBe('ASIA_CRYPTO');
  });

  it('returns EUROPE_CRYPTO at hour 10', () => {
    expect(resolveActiveSession(utcDate(10))).toBe('EUROPE_CRYPTO');
  });

  it('returns US_CRYPTO at hour 18', () => {
    expect(resolveActiveSession(utcDate(18))).toBe('US_CRYPTO');
  });

  it('returns null at hour 23', () => {
    expect(resolveActiveSession(utcDate(23))).toBeNull();
  });
});

describe('getSessionBoundaryForDate', () => {
  it('returns correct ms boundaries for ASIA_CRYPTO', () => {
    const date = new Date(Date.UTC(2024, 0, 15, 4, 0, 0));
    const boundary = getSessionBoundaryForDate('ASIA_CRYPTO', date);
    const dayStart = Date.UTC(2024, 0, 15);
    expect(boundary.session).toBe('ASIA_CRYPTO');
    expect(boundary.startMs).toBe(dayStart + 0 * 3_600_000);
    expect(boundary.endMs).toBe(dayStart + 8 * 3_600_000);
  });

  it('returns correct ms boundaries for US_CRYPTO', () => {
    const date = new Date(Date.UTC(2024, 0, 15, 18, 0, 0));
    const boundary = getSessionBoundaryForDate('US_CRYPTO', date);
    const dayStart = Date.UTC(2024, 0, 15);
    expect(boundary.startMs).toBe(dayStart + 13 * 3_600_000);
    expect(boundary.endMs).toBe(dayStart + 21 * 3_600_000);
  });
});

describe('getPreviousSession', () => {
  it('ASIA_CRYPTO previous is US_CRYPTO', () => {
    expect(getPreviousSession('ASIA_CRYPTO')).toBe('US_CRYPTO');
  });

  it('EUROPE_CRYPTO previous is ASIA_CRYPTO', () => {
    expect(getPreviousSession('EUROPE_CRYPTO')).toBe('ASIA_CRYPTO');
  });

  it('US_CRYPTO previous is EUROPE_CRYPTO', () => {
    expect(getPreviousSession('US_CRYPTO')).toBe('EUROPE_CRYPTO');
  });

  it('forms a cycle', () => {
    const start = 'ASIA_CRYPTO' as const;
    const p1 = getPreviousSession(start);
    const p2 = getPreviousSession(p1);
    const p3 = getPreviousSession(p2);
    expect(p3).toBe(start);
  });
});
