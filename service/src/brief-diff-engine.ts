import type { OverviewOutput } from './ports.js';

function fmtRegime(regime: string): string {
  return regime.replace(/_/g, ' ');
}

function fmtRotation(state: string): string {
  return state.replace(/_/g, ' ');
}

function extractEthBtcDirection(vsbtc: string): string | null {
  const lower = vsbtc.toLowerCase();
  if (lower.includes('rising')) return 'rising';
  if (lower.includes('falling')) return 'falling';
  if (lower.includes('sideways')) return 'sideways';
  return null;
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

  // Derivatives funding shift — only flag when moving to or from an extreme reading
  const prevFunding = previous.derivatives.funding;
  const currFunding = current.derivatives.funding;
  if (prevFunding !== currFunding) {
    const significant = prevFunding.includes('extreme') || currFunding.includes('extreme');
    if (significant) {
      bullets.push(`Funding shift: ${prevFunding} → ${currFunding}`);
    }
  }

  // ETH/BTC trend direction change
  const prevEthDir = extractEthBtcDirection(previous.eth.vsbtc);
  const currEthDir = extractEthBtcDirection(current.eth.vsbtc);
  if (prevEthDir !== null && currEthDir !== null && prevEthDir !== currEthDir) {
    bullets.push(`ETH/BTC trend: ${prevEthDir} → ${currEthDir}`);
  }

  if (bullets.length === 0) {
    bullets.push('No significant structural changes since previous brief.');
  }

  return bullets.slice(0, 8);
}

export function firstBriefBullets(): string[] {
  return ['No previous brief available for this session — initial reading.'];
}
