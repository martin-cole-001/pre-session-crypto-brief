import type { ContextCollector, CollectorRunContext, CollectorResult, MacroRatesContext } from '../../../service/src/ports.js';

const BEA_BASE = 'https://apps.bea.gov/api/data/';
const UA = 'trader-agent/session-overview';

interface BeaDataRow { Year: string; Period: string; DataValue: string; LineNumber: string }
interface BeaResponse {
  BEAAPI?: {
    Results?: {
      Data?: BeaDataRow[];
    };
  };
}

function parseBeaValue(str: string): number | undefined {
  const cleaned = str.replace(/,/g, '');
  const n = parseFloat(cleaned);
  return isNaN(n) ? undefined : n;
}

function latestQuarter(rows: BeaDataRow[], lineNumber: string): number | undefined {
  const filtered = rows
    .filter((r) => r.LineNumber === lineNumber)
    .sort((a, b) => {
      const aKey = `${a.Year}${a.Period}`;
      const bKey = `${b.Year}${b.Period}`;
      return bKey.localeCompare(aKey);
    });
  return filtered.length > 0 ? parseBeaValue(filtered[0]!.DataValue) : undefined;
}

export class BeaGdpCollector implements ContextCollector<MacroRatesContext> {
  readonly sourceName = 'bea-gdp';

  constructor(private readonly apiKey: string) {}

  async collect(_ctx: CollectorRunContext): Promise<CollectorResult<MacroRatesContext>> {
    const params = new URLSearchParams({
      UserID: this.apiKey,
      method: 'GetData',
      datasetname: 'NIPA',
      TableName: 'T10109',
      Frequency: 'Q',
      Year: 'LAST5',
      ResultFormat: 'JSON',
    });
    const url = `${BEA_BASE}?${params.toString()}`;
    const res = await fetch(url, { headers: { 'User-Agent': UA } });
    if (!res.ok) throw new Error(`BEA GDP: ${res.status} ${res.statusText}`);

    const json = await res.json() as BeaResponse;
    const rows = json.BEAAPI?.Results?.Data;
    if (!Array.isArray(rows) || rows.length === 0) {
      return { status: 'partial', itemCount: 0 };
    }

    // T10109 Line 1 = Percent change in Real GDP
    const gdpGrowthQoQ = latestQuarter(rows, '1');
    if (gdpGrowthQoQ === undefined) {
      return { status: 'partial', itemCount: 0 };
    }

    const data: MacroRatesContext = {
      gdpGrowthQoQ,
      dataDate: new Date().toISOString().slice(0, 10),
    };

    return { status: 'success', data, itemCount: 1 };
  }
}
