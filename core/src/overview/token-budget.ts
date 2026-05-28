import type { OverviewInput } from './overview-input.types.js';
import type { NormalizedEvent } from '../events/event.types.js';

export function estimateTokenCount(value: unknown): number {
  try {
    return Math.ceil(JSON.stringify(value).length / 4);
  } catch {
    return 0;
  }
}

export function truncateToTokenBudget(input: OverviewInput, maxTokens: number): OverviewInput {
  if (estimateTokenCount(input) <= maxTokens) return input;

  // Sort events by relevanceScore DESC, then truncate
  const sortedEvents = [...input.eventsForSession].sort((a, b) => b.relevanceScore - a.relevanceScore);
  let events: NormalizedEvent[] = sortedEvents;
  let setups = input.activeSetups;

  // Binary-search style truncation
  for (let eventCount = sortedEvents.length; eventCount >= 0; eventCount--) {
    events = sortedEvents.slice(0, eventCount);
    const candidate = { ...input, eventsForSession: events, activeSetups: setups };
    if (estimateTokenCount(candidate) <= maxTokens) return candidate;
  }

  // Also truncate setups if needed
  for (let setupCount = setups.length; setupCount >= 0; setupCount--) {
    setups = input.activeSetups.slice(0, setupCount);
    const candidate = { ...input, eventsForSession: [], activeSetups: setups };
    if (estimateTokenCount(candidate) <= maxTokens) return candidate;
  }

  return { ...input, eventsForSession: [], activeSetups: [] };
}
