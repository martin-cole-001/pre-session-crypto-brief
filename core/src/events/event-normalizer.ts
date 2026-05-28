import type { CryptoSession } from '../session/session.types.js';
import { SESSION_WINDOWS } from '../session/session-windows.js';

// Returns sessionRelevance based on scheduledTime UTC hour vs session windows
export function assignSessionRelevance(
  scheduledTimeIso: string | undefined,
  detectedAt: string
): CryptoSession[] {
  const timeStr = scheduledTimeIso ?? detectedAt;
  const date = new Date(timeStr);
  if (isNaN(date.getTime())) return [];
  const hour = date.getUTCHours();
  const relevant: CryptoSession[] = [];
  for (const [session, window] of Object.entries(SESSION_WINDOWS) as [CryptoSession, typeof SESSION_WINDOWS[CryptoSession]][]) {
    if (hour >= window.startUtcHour && hour < window.endUtcHour) {
      relevant.push(session);
    }
  }
  return relevant;
}
