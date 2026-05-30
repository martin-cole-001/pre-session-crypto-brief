import { describe, it, expect, vi } from 'vitest';
import type { CollectorRunContext } from '../../../service/src/ports.js';
import { BybitAnnouncementsCollector } from '../../src/collectors/bybit-announcements.js';

const ctx = {} as CollectorRunContext;

describe('BybitAnnouncementsCollector', () => {
  it('propagates error when getAnnouncements throws — does not silently return []', async () => {
    const client = {
      getAnnouncements: vi.fn().mockRejectedValue(new Error('network timeout')),
    };
    const collector = new BybitAnnouncementsCollector(client as never);
    await expect(collector.collect(ctx)).rejects.toThrow('network timeout');
  });

  it('propagates non-Error rejection', async () => {
    const client = {
      getAnnouncements: vi.fn().mockRejectedValue('ECONNREFUSED'),
    };
    const collector = new BybitAnnouncementsCollector(client as never);
    await expect(collector.collect(ctx)).rejects.toBeDefined();
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
    const result = await collector.collect(ctx);
    expect(result.data).toHaveLength(1);
    expect(result.data?.[0]?.eventType).toBe('exchange_listing');
    expect(result.status).toBe('success');
    expect(result.itemCount).toBe(1);
  });
});
