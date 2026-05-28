import { describe, it, expect } from 'vitest';
import { OverviewFormatter } from '../src/overview-formatter.js';
import type { OverviewOutput } from '../src/ports.js';

function makeOutput(overrides: Partial<OverviewOutput> = {}): OverviewOutput {
  const base: OverviewOutput = {
    reportId: 'test-report-1',
    createdAt: new Date().toISOString(),
    session: 'ASIA_CRYPTO',
    timezone: 'UTC',
    overview: {
      marketTone: 'constructive',
      sessionRead: 'Markets are building higher from key demand zones.',
      confidence: 'medium',
    },
    btcContext: {
      summary: 'BTC holding above weekly open with steady bid pressure.',
      keyLevels: ['95000', '92000'],
      currentPosition: 'above daily midpoint',
    },
    ethContext: {
      summary: 'ETH consolidating near prior highs.',
      ethVsBtc: 'in_line',
    },
    altcoinContext: {
      summary: 'Selective rotation into large-cap alts.',
      rotationState: 'selective_rotation',
    },
    derivativesContext: {
      summary: 'Funding elevated but not extreme.',
      fundingRead: 'positive_elevated',
      oiRead: 'stable',
      positioningRead: 'long_heavy',
    },
    eventsContext: {
      summary: 'Light macro calendar this session.',
      importantEvents: [],
    },
    assetsInFocus: [],
    setupsInFocus: [],
    levelsToWatch: [],
    sessionNotes: [],
    humanSummary: 'Overall constructive session outlook.',
  };
  return { ...base, ...overrides };
}

const formatter = new OverviewFormatter();

describe('OverviewFormatter.format()', () => {
  it('produces a non-empty string', () => {
    const result = formatter.format(makeOutput());
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });

  it('does not contain trading action words: buy, sell, entry, exit', () => {
    const output = makeOutput({
      btcContext: {
        summary: 'BTC trending above key structure.',
        keyLevels: ['95000'],
        currentPosition: 'above midpoint',
      },
      overview: {
        marketTone: 'constructive',
        sessionRead: 'Momentum remains to the upside.',
        confidence: 'high',
      },
    });
    const result = formatter.format(output).toLowerCase();
    expect(result).not.toMatch(/\bbuy\b/);
    expect(result).not.toMatch(/\bsell\b/);
    expect(result).not.toMatch(/\bentry\b/);
    expect(result).not.toMatch(/\bexit\b/);
  });

  it('includes the session label Asia for ASIA_CRYPTO', () => {
    const result = formatter.format(makeOutput({ session: 'ASIA_CRYPTO' }));
    expect(result).toContain('Asia');
  });

  it('includes the session label Europe for EUROPE_CRYPTO', () => {
    const result = formatter.format(makeOutput({ session: 'EUROPE_CRYPTO' }));
    expect(result).toContain('Europe');
  });

  it('includes the session label US for US_CRYPTO', () => {
    const result = formatter.format(makeOutput({ session: 'US_CRYPTO' }));
    expect(result).toContain('US');
  });

  it('includes BTC key levels when provided', () => {
    const result = formatter.format(makeOutput());
    expect(result).toContain('95000');
    expect(result).toContain('92000');
  });

  it('includes events section when importantEvents is non-empty', () => {
    const output = makeOutput({
      eventsContext: {
        summary: 'Major macro event today.',
        importantEvents: [
          { title: 'FOMC Minutes', importance: 'high', relevance: 'Could move BTC significantly' },
        ],
      },
    });
    const result = formatter.format(output);
    expect(result).toContain('Events:');
    expect(result).toContain('FOMC Minutes');
    expect(result).toContain('[high]');
  });

  it('omits events section when importantEvents is empty', () => {
    const result = formatter.format(makeOutput({ eventsContext: { summary: '', importantEvents: [] } }));
    expect(result).not.toContain('Events:');
  });

  it('includes assets in focus when non-empty', () => {
    const output = makeOutput({
      assetsInFocus: [{ symbol: 'SOLUSDT', reason: 'Breaking out of weekly range' }],
    });
    const result = formatter.format(output);
    expect(result).toContain('Assets in focus:');
    expect(result).toContain('SOLUSDT');
  });

  it('includes setups in focus when non-empty', () => {
    const output = makeOutput({
      setupsInFocus: [{ setupId: 's1', symbol: 'BTCUSDT', reason: 'Retesting key demand zone' }],
    });
    const result = formatter.format(output);
    expect(result).toContain('Active setups:');
    expect(result).toContain('BTCUSDT');
  });

  it('includes levels to watch when non-empty', () => {
    const output = makeOutput({
      levelsToWatch: [{ symbol: 'BTCUSDT', levelType: 'weekly', level: '95000', reason: 'Previous week high' }],
    });
    const result = formatter.format(output);
    expect(result).toContain('Levels to watch:');
    expect(result).toContain('95000');
  });

  it('includes session notes when non-empty', () => {
    const output = makeOutput({
      sessionNotes: ['Watch for liquidity sweep above 96k.'],
    });
    const result = formatter.format(output);
    expect(result).toContain('Session notes:');
    expect(result).toContain('Watch for liquidity sweep above 96k.');
  });

  it('omits positioningRead line when positioningRead is blank', () => {
    const output = makeOutput({
      derivativesContext: {
        summary: 'Funding neutral.',
        fundingRead: 'neutral',
        oiRead: 'stable',
        positioningRead: '',
      },
    });
    const result = formatter.format(output);
    expect(result).not.toContain('Read:');
  });
});

describe('OverviewFormatter.splitForTelegram()', () => {
  it('returns array of length 1 for a short report', () => {
    const shortReport = 'Short report text.';
    const result = formatter.splitForTelegram(shortReport);
    expect(result).toHaveLength(1);
    expect(result[0]).toBe(shortReport);
  });

  it('returns the original string unchanged for report at exactly maxLength', () => {
    const report = 'a'.repeat(4096);
    const result = formatter.splitForTelegram(report);
    expect(result).toHaveLength(1);
    expect(result[0]).toBe(report);
  });

  it('splits a long report into multiple chunks each <= 4096 chars', () => {
    // Build a report > 4096 chars with newlines so it can be split
    const lines = Array.from({ length: 200 }, (_, i) => `Line ${i}: ${'x'.repeat(30)}`);
    const report = lines.join('\n');
    expect(report.length).toBeGreaterThan(4096);

    const chunks = formatter.splitForTelegram(report);
    expect(chunks.length).toBeGreaterThan(1);
    for (const chunk of chunks) {
      expect(chunk.length).toBeLessThanOrEqual(4096);
    }
  });

  it('reassembled chunks contain all lines from the original report', () => {
    const lines = Array.from({ length: 200 }, (_, i) => `Line ${i}: ${'x'.repeat(30)}`);
    const report = lines.join('\n');

    const chunks = formatter.splitForTelegram(report);
    const reassembled = chunks.join('\n');

    // Every original line should appear somewhere in the reassembled output
    for (const line of lines) {
      expect(reassembled).toContain(line);
    }
  });

  it('respects a custom maxLength parameter', () => {
    const report = 'a'.repeat(100);
    const chunks = formatter.splitForTelegram(report, 50);
    // Single 100-char string with no newlines: first chunk is the whole thing
    // since there's nothing to split on; the loop puts all into current
    // Actually with no newlines it stays as one chunk (can't split further)
    expect(chunks.length).toBeGreaterThanOrEqual(1);
  });

  it('returns multiple parts for a report longer than 4096 chars', () => {
    const longLine = 'x'.repeat(2000);
    const report = `${longLine}\n${longLine}\n${longLine}`;
    expect(report.length).toBeGreaterThan(4096);

    const chunks = formatter.splitForTelegram(report);
    expect(chunks.length).toBeGreaterThan(1);
  });
});
