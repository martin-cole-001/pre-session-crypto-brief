import { describe, it, expect, vi } from 'vitest';
import { BybitAnnouncementsCollector } from '../../src/collectors/bybit-announcements.js';

describe('BybitAnnouncementsCollector', () => {
  it('propagates error when getAnnouncements throws — does not silently return []', async () => {
    const client = {
      getAnnouncements: vi.fn().mockRejectedValue(new Error('network timeout')),
    };
    const collector = new BybitAnnouncementsCollector(client as never);
    await expect(collector.collect('EUROPE_CRYPTO')).rejects.toThrow('network timeout');
  });

  it('propagates non-Error rejection', async () => {
    const client = {
      getAnnouncements: vi.fn().mockRejectedValue('ECONNREFUSED'),
    };
    const collector = new BybitAnnouncementsCollector(client as never);
    await expect(collector.collect('ASIA_CRYPTO')).rejects.toBeDefined();
  });

  it('returns mapped events on success', async () => {
    const client = {
      getAnnouncements: vi.fn().mockResolvedValue([
        {
          id: '123',
          title: 'New listing: XYZUSDT',
          publishTime: Date.now(),
          tags: ['listing'],
          url: 'https://bybit.com/123',
        },
      ]),
    };
    const collector = new BybitAnnouncementsCollector(client as never);
    const events = await collector.collect('EUROPE_CRYPTO');
    expect(events).toHaveLength(1);
    expect(events[0]?.eventType).toBe('exchange_listing');
  });
});
