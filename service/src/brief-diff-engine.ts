import type { OverviewOutput } from './ports.js';

function fmtRegime(regime: string): string {
  return regime.replace(/_/g, ' ');
}

function fmtRotation(state: string): string {
  return state.replace(/_/g, ' ');
}

export function computeWhatChanged(
  previous: OverviewOutput,
  current: OverviewOutput,
): string[] {
  const bullets: string[] = [];

  // Enum fields — fully deterministic comparison
  if (previous.marketRegime !== current.marketRegime) {
    bullets.push(
      `Regime: ${fmtRegime(previous.marketRegime)} → ${fmtRegime(current.marketRegime)}`,
    );
  }

  if (previous.briefConfidence !== current.briefConfidence) {
    bullets.push(`Confidence: ${previous.briefConfidence} → ${current.briefConfidence}`);
  }

  if (previous.btc.structure !== current.btc.structure) {
    bullets.push(`BTC 4H structure: ${previous.btc.structure} → ${current.btc.structure}`);
  }

  if (previous.alts.rotationState !== current.alts.rotationState) {
    bullets.push(
      `Alt rotation: ${fmtRotation(previous.alts.rotationState)} → ${fmtRotation(current.alts.rotationState)}`,
    );
  }

  // New upcoming events (by title)
  const prevTitles = new Set(previous.events.upcoming.map((e) => e.title));
  for (const ev of current.events.upcoming) {
    if (!prevTitles.has(ev.title)) {
      bullets.push(`New event: ${ev.title} (${ev.importance})`);
    }
  }

  // Events that have passed or been removed
  const currentTitles = new Set(current.events.upcoming.map((e) => e.title));
  for (const ev of previous.events.upcoming) {
    if (!currentTitles.has(ev.title)) {
      bullets.push(`Event resolved/removed: ${ev.title}`);
    }
  }

  if (bullets.length === 0) {
    bullets.push('No significant structural changes since previous brief.');
  }

  return bullets.slice(0, 8);
}

export function firstBriefBullets(): string[] {
  return ['No previous brief available for this session — initial reading.'];
}
