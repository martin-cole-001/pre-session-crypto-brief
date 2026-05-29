import type { ContextCollector, CollectorRunContext, CollectorResult, MacroRatesContext } from '../../../service/src/ports.js';

const FRED_BASE = 'https://api.stlouisfed.org/fred/series/observations';
const UA = 'trader-agent/session-overview';

interface FredObs { date: string; value: string }
interface FredResponse { observations?: FredObs[] }

async function fetchLatest(apiKey: string, seriesId: string, limit = 1): Promise<FredObs[]> {
  const url = `${FRED_BASE}?series_id=${seriesId}&api_key=${apiKey}&sort_order=desc&limit=${limit}&file_type=json`;
  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`FRED ${seriesId}: ${res.status} ${res.statusText}`);
  const json = await res.json() as FredResponse;
  return json.observations ?? [];
}

function parseValue(obs: FredObs[]): number | undefined {
  const v = obs.find((o) => o.value !== '.' && o.value !== '')?.value;
  if (v === undefined) return undefined;
  const n = parseFloat(v);
  return isNaN(n) ? undefined : n;
}

function computePceYoY(obs: FredObs[]): number | undefined {
  // obs sorted desc: [0]=latest, [12]=~12 months ago
  const recent = parseFloat(obs[0]?.value ?? '');
  const yearAgo = parseFloat(obs[12]?.value ?? '');
  if (isNaN(recent) || isNaN(yearAgo) || yearAgo === 0) return undefined;
  return parseFloat(((recent - yearAgo) / yearAgo * 100).toFixed(2));
}

export class FredRatesCollector implements ContextCollector<MacroRatesContext> {
  readonly sourceName = 'fred-rates';

  constructor(private readonly apiKey: string) {}

  async collect(_ctx: CollectorRunContext): Promise<CollectorResult<MacroRatesContext>> {
    const [fedFundsObs, dgs10Obs, dgs2Obs, pcepObs] = await Promise.all([
      fetchLatest(this.apiKey, 'FEDFUNDS', 1),
      fetchLatest(this.apiKey, 'DGS10', 1),
      fetchLatest(this.apiKey, 'DGS2', 1),
      fetchLatest(this.apiKey, 'PCEPI', 14),
    ]);

    const fedFundsRate = parseValue(fedFundsObs);
    const us10yYield = parseValue(dgs10Obs);
    const us2yYield = parseValue(dgs2Obs);
    const pceYoY = computePceYoY(pcepObs);

    const fieldCount = [fedFundsRate, us10yYield, us2yYield, pceYoY].filter((v) => v !== undefined).length;
    if (fieldCount === 0) {
      return { status: 'partial', itemCount: 0 };
    }

    const data: MacroRatesContext = {
      ...(fedFundsRate !== undefined ? { fedFundsRate } : {}),
      ...(us10yYield !== undefined ? { us10yYield } : {}),
      ...(us2yYield !== undefined ? { us2yYield } : {}),
      ...(pceYoY !== undefined ? { pceYoY } : {}),
      dataDate: new Date().toISOString().slice(0, 10),
    };

    return { status: 'success', data, itemCount: fieldCount };
  }
}
