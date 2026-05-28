import type { NormalizedEvent } from './event.types.js';

// slug: lowercase, replace non-alphanumeric with '-', collapse repeated '-'
function slugify(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

export function computeDedupeKey(source: string, title: string, datePrefix: string): string {
  return `${source}:${slugify(title)}:${datePrefix}`;
}

export function deduplicateEvents(events: NormalizedEvent[]): NormalizedEvent[] {
  const seen = new Set<string>();
  return events.filter((e) => {
    if (seen.has(e.dedupeKey)) return false;
    seen.add(e.dedupeKey);
    return true;
  });
}
