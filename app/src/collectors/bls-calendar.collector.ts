import { XMLParser } from 'fast-xml-parser';
import type { EventCollector, NormalizedEvent, NormalizedEventType, CollectorRunContext, CollectorResult } from '../../../service/src/ports.js';

const RSS_URL = 'https://www.bls.gov/feed/bls_latest.rss';

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
const FOURTEEN_DAYS_MS = 14 * 24 * 60 * 60 * 1000;

interface RssItem {
  title?: string;
  description?: string;
  pubDate?: string;
  link?: string;
}

function classifyTitle(title: string): {
  eventType: NormalizedEventType;
  importance: 'critical' | 'high' | 'medium' | 'low';
  relevanceScore: number;
} {
  const t = title.toLowerCase();

  if (t.includes('consumer price index') || t.includes('cpi')) {
    return { eventType: 'cpi', importance: 'critical', relevanceScore: 0.95 };
  }
  if (t.includes('producer price index') || t.includes('ppi')) {
    return { eventType: 'ppi', importance: 'high', relevanceScore: 0.85 };
  }
  if (t.includes('employment situation') || t.includes('nonfarm payroll') || t.includes('nfp')) {
    return { eventType: 'nfp', importance: 'critical', relevanceScore: 0.95 };
  }
  if (t.includes('personal consumption') || t.includes('pce')) {
    return { eventType: 'pce', importance: 'critical', relevanceScore: 0.95 };
  }

  return { eventType: 'macro_other', importance: 'medium', relevanceScore: 0.5 };
}

function isWithinWindow(pubDateStr: string | undefined): boolean {
  if (!pubDateStr) return false;
  const ts = Date.parse(pubDateStr);
  if (isNaN(ts)) return false;
  const now = Date.now();
  return ts >= now - SEVEN_DAYS_MS && ts <= now + FOURTEEN_DAYS_MS;
}

export class BlsCalendarCollector implements EventCollector {
  readonly sourceName = 'bls-calendar';

  async collect(_ctx: CollectorRunContext): Promise<CollectorResult<NormalizedEvent[]>> {
    const response = await fetch(RSS_URL, {
      headers: { 'User-Agent': 'trader-agent/session-overview' },
    });

    if (!response.ok) {
      throw new Error(`BLS RSS fetch failed: ${response.status} ${response.statusText}`);
    }

    const xml = await response.text();
    const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_' });
    const parsed: unknown = parser.parse(xml);

    const rss = parsed as {
      rss?: { channel?: { item?: RssItem | RssItem[] } };
    };

    const rawItems = rss.rss?.channel?.item;
    if (rawItems === undefined) return { status: 'success', data: [], itemCount: 0 };

    const items: RssItem[] = Array.isArray(rawItems) ? rawItems : [rawItems];

    const now = Date.now();
    const detectedAt = new Date(now).toISOString();

    const events = items
      .filter((item) => isWithinWindow(item.pubDate))
      .map((item): NormalizedEvent => {
        const title = item.title ?? '';
        const link = item.link ?? '';
        const { eventType, importance, relevanceScore } = classifyTitle(title);
        const dedupeKey = `bls-${link !== '' ? link : title}`;

        return {
          eventId: dedupeKey,
          eventType,
          category: 'macro',
          title,
          ...(item.pubDate !== undefined ? { scheduledTime: new Date(item.pubDate).toISOString() } : {}),
          detectedAt,
          importance,
          sessionRelevance: ['US_CRYPTO'],
          source: 'bls-rss',
          summary: item.description ?? title,
          confidence: 'high',
          dedupeKey,
          relevanceScore,
        };
      });
    return { status: 'success', data: events, itemCount: events.length };
  }
}
