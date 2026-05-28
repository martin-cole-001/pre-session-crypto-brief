export type HtfCandle = {
  openTimeMs: number;
  closeTimeMs: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

export type WeeklyLevels = {
  currentWeekOpen: number;
  previousWeekHigh: number;
  previousWeekLow: number;
  previousWeekClose: number;
  weeklyMidpoint: number;
  weeklyPosition: 'above_midpoint' | 'at_midpoint' | 'below_midpoint';
};

export type DailyLevels = {
  currentDayOpen: number;
  previousDayHigh: number;
  previousDayLow: number;
  previousDayClose: number;
  dailyMidpoint: number;
  dailyPosition: 'above_midpoint' | 'at_midpoint' | 'below_midpoint';
};

export type FourHourStructure = 'bullish' | 'bearish' | 'range' | 'transition';

export type FourHourLevels = {
  lastSwingHigh: number;
  lastSwingLow: number;
  structure: FourHourStructure;
  supportZone: { low: number; high: number };
  resistanceZone: { low: number; high: number };
};

export type HtfLevels = {
  weekly: WeeklyLevels;
  daily: DailyLevels;
  fourHour: FourHourLevels;
};

export function computeMidpoint(high: number, low: number): number {
  return (high + low) / 2;
}

export function computeDistanceTo(
  currentPrice: number,
  level: number
): { absoluteDistance: number; percentDistance: number; direction: 'above' | 'at' | 'below' } {
  const absoluteDistance = currentPrice - level;
  const percentDistance = Math.abs(absoluteDistance) / level * 100;
  const direction: 'above' | 'at' | 'below' =
    percentDistance <= 0.1 ? 'at' : absoluteDistance > 0 ? 'above' : 'below';
  return { absoluteDistance, percentDistance, direction };
}

function computePosition(
  currentPrice: number,
  midpoint: number
): 'above_midpoint' | 'at_midpoint' | 'below_midpoint' {
  const dist = computeDistanceTo(currentPrice, midpoint);
  if (dist.direction === 'at') return 'at_midpoint';
  return dist.direction === 'above' ? 'above_midpoint' : 'below_midpoint';
}

export function computeWeeklyLevels(currentPrice: number, weeklyCandles: HtfCandle[]): WeeklyLevels {
  const current = weeklyCandles[weeklyCandles.length - 1] ?? weeklyCandles[0];
  const previous = weeklyCandles.length >= 2
    ? weeklyCandles[weeklyCandles.length - 2]
    : current;

  if (current === undefined || previous === undefined) {
    return {
      currentWeekOpen: currentPrice,
      previousWeekHigh: currentPrice,
      previousWeekLow: currentPrice,
      previousWeekClose: currentPrice,
      weeklyMidpoint: currentPrice,
      weeklyPosition: 'at_midpoint',
    };
  }

  const weeklyMidpoint = computeMidpoint(previous.high, previous.low);
  return {
    currentWeekOpen: current.open,
    previousWeekHigh: previous.high,
    previousWeekLow: previous.low,
    previousWeekClose: previous.close,
    weeklyMidpoint,
    weeklyPosition: computePosition(currentPrice, weeklyMidpoint),
  };
}

export function computeDailyLevels(currentPrice: number, dailyCandles: HtfCandle[]): DailyLevels {
  const current = dailyCandles[dailyCandles.length - 1] ?? dailyCandles[0];
  const previous = dailyCandles.length >= 2
    ? dailyCandles[dailyCandles.length - 2]
    : current;

  if (current === undefined || previous === undefined) {
    return {
      currentDayOpen: currentPrice,
      previousDayHigh: currentPrice,
      previousDayLow: currentPrice,
      previousDayClose: currentPrice,
      dailyMidpoint: currentPrice,
      dailyPosition: 'at_midpoint',
    };
  }

  const dailyMidpoint = computeMidpoint(previous.high, previous.low);
  return {
    currentDayOpen: current.open,
    previousDayHigh: previous.high,
    previousDayLow: previous.low,
    previousDayClose: previous.close,
    dailyMidpoint,
    dailyPosition: computePosition(currentPrice, dailyMidpoint),
  };
}

export function computeFourHourLevels(currentPrice: number, h4Candles: HtfCandle[]): FourHourLevels {
  const candles = h4Candles.slice(-20);

  if (candles.length === 0) {
    return {
      lastSwingHigh: currentPrice,
      lastSwingLow: currentPrice,
      structure: 'range',
      supportZone: { low: currentPrice * 0.997, high: currentPrice * 1.003 },
      resistanceZone: { low: currentPrice * 0.997, high: currentPrice * 1.003 },
    };
  }

  const lastSwingHigh = Math.max(...candles.map((c) => c.high));
  const lastSwingLow = Math.min(...candles.map((c) => c.low));

  const latest = candles[candles.length - 1];
  const secondToLast = candles[candles.length - 2];

  let structure: FourHourStructure = 'range';
  if (latest !== undefined && secondToLast !== undefined) {
    if (latest.close > secondToLast.high) {
      structure = 'bullish';
    } else if (latest.close < secondToLast.low) {
      structure = 'bearish';
    } else if (latest.close >= lastSwingLow && latest.close <= lastSwingHigh) {
      structure = 'range';
    } else {
      structure = 'transition';
    }
  }

  return {
    lastSwingHigh,
    lastSwingLow,
    structure,
    supportZone: { low: lastSwingLow * 0.997, high: lastSwingLow * 1.003 },
    resistanceZone: { low: lastSwingHigh * 0.997, high: lastSwingHigh * 1.003 },
  };
}

export function computeHtfLevels(
  currentPrice: number,
  candles: { weekly: HtfCandle[]; daily: HtfCandle[]; fourHour: HtfCandle[] }
): HtfLevels {
  return {
    weekly: computeWeeklyLevels(currentPrice, candles.weekly),
    daily: computeDailyLevels(currentPrice, candles.daily),
    fourHour: computeFourHourLevels(currentPrice, candles.fourHour),
  };
}
