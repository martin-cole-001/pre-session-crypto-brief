import type { NormalizedEvent, NormalizedEventType } from './event.types.js';

const TYPE_WEIGHTS: Record<NormalizedEventType, number> = {
  fomc: 1.0, cpi: 1.0, nfp: 1.0, pce: 0.9,
  security_incident: 0.9, stablecoin_event: 0.9, etf_related: 0.85,
  token_unlock: 0.7, exchange_delisting: 0.7, ppi: 0.7,
  exchange_listing: 0.6, protocol_upgrade: 0.6,
  exchange_maintenance: 0.5, fed_speaker: 0.5,
  airdrop: 0.4, governance_vote: 0.4, macro_other: 0.3,
};

const IMPORTANCE_MULTIPLIER: Record<NormalizedEvent['importance'], number> = {
  critical: 1.0, high: 0.85, medium: 0.65, low: 0.4,
};

export function computeRelevanceScore(
  event: Omit<NormalizedEvent, 'relevanceScore'>,
  symbolList: string[]
): number {
  const typeWeight = TYPE_WEIGHTS[event.eventType] ?? 0.3;
  const importanceMultiplier = IMPORTANCE_MULTIPLIER[event.importance];
  const assetBonus = event.asset !== undefined && symbolList.some(
    (s) => s.toUpperCase().startsWith(event.asset!.toUpperCase())
  ) ? 0.15 : 0;
  return Math.min(1, typeWeight * importanceMultiplier + assetBonus);
}

export function filterByRelevance(events: NormalizedEvent[], threshold: number): NormalizedEvent[] {
  return events.filter((e) => e.relevanceScore >= threshold);
}
