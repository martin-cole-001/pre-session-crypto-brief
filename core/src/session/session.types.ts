export type CryptoSession = 'ASIA_CRYPTO' | 'EUROPE_CRYPTO' | 'US_CRYPTO';

export type SessionWindow = {
  session: CryptoSession;
  startUtcHour: number;
  endUtcHour: number;
};

export type SessionBoundary = {
  session: CryptoSession;
  startMs: number;
  endMs: number;
};
