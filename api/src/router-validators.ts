import type { CryptoSession } from '../../service/src/ports.js';
import type { OverviewRunOptions } from '../../service/src/service-types.js';

export const VALID_SESSIONS: ReadonlySet<string> = new Set<CryptoSession>([
  'ASIA_CRYPTO',
  'EUROPE_CRYPTO',
  'US_CRYPTO',
]);

export const VALID_SESSIONS_LIST = Array.from(VALID_SESSIONS);

const MAX_LIMIT = 100;
const MIN_LIMIT = 1;

export function isValidSession(value: unknown): value is CryptoSession {
  return typeof value === 'string' && VALID_SESSIONS.has(value);
}

export function clampLimit(value: unknown): number | undefined {
  if (typeof value !== 'string') return undefined;
  const n = parseInt(value, 10);
  if (isNaN(n)) return undefined;
  return Math.min(Math.max(n, MIN_LIMIT), MAX_LIMIT);
}

export function parseDateParam(value: unknown): Date | undefined {
  if (typeof value !== 'string') return undefined;
  const d = new Date(value);
  return isNaN(d.getTime()) ? undefined : d;
}

type TriggerValidationSuccess = { ok: true; options: OverviewRunOptions };
type TriggerValidationFailure = { ok: false; error: string; code: string };
export type TriggerValidationResult = TriggerValidationSuccess | TriggerValidationFailure;

function isStringArray(arr: unknown[]): arr is string[] {
  return arr.every((x) => typeof x === 'string');
}

export function validateTriggerBody(body: unknown): TriggerValidationResult {
  if (typeof body !== 'object' || body === null) {
    return { ok: false, error: 'Request body must be a JSON object', code: 'INVALID_BODY' };
  }

  const { session, symbols, publish } = body as Record<string, unknown>;

  if (!isValidSession(session)) {
    return { ok: false, error: 'Invalid or missing session', code: 'INVALID_SESSION' };
  }

  if (typeof symbols !== 'object' || symbols === null || Array.isArray(symbols)) {
    return { ok: false, error: 'symbols must be an object with core, major, watch arrays', code: 'INVALID_SYMBOLS' };
  }

  const sym = symbols as Record<string, unknown>;

  if (!Array.isArray(sym['core']) || !Array.isArray(sym['major']) || !Array.isArray(sym['watch'])) {
    return { ok: false, error: 'symbols.core, symbols.major, and symbols.watch must be arrays', code: 'INVALID_SYMBOLS' };
  }

  if (!isStringArray(sym['core']) || !isStringArray(sym['major']) || !isStringArray(sym['watch'])) {
    return { ok: false, error: 'All symbol entries must be strings', code: 'INVALID_SYMBOLS' };
  }

  if (sym['core'].length === 0) {
    return { ok: false, error: 'symbols.core must contain at least one symbol', code: 'INVALID_SYMBOLS' };
  }

  return {
    ok: true,
    options: {
      session,
      symbols: { core: sym['core'], major: sym['major'], watch: sym['watch'] },
      ...(publish !== undefined ? { publish: Boolean(publish) } : {}),
    },
  };
}
