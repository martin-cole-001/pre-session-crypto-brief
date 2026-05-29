import type { ContextCollector, CollectorRunContext, CollectorResult, StablecoinContext } from '../../../service/src/ports.js';

const API_URL = 'https://stablecoins.llama.fi/stablecoins?includePrices=true';
const UA = 'trader-agent/session-overview';

interface PeggedAsset {
  symbol: string;
  name: string;
  pegType: string;
  price?: number;
  circulating?: { peggedUSD?: number };
  circulatingPrevDay?: { peggedUSD?: number };
  circulatingPrevWeek?: { peggedUSD?: number };
}

interface StablecoinsResponse {
  peggedAssets?: PeggedAsset[];
}

function usdSupply(asset: PeggedAsset): number {
  return asset.circulating?.peggedUSD ?? 0;
}

function pegStatus(asset: PeggedAsset): 'pegged' | 'depegged' {
  if (asset.price === undefined) return 'pegged';
  return asset.price >= 0.99 && asset.price <= 1.01 ? 'pegged' : 'depegged';
}

export class DefiLlamaStablecoinsCollector implements ContextCollector<StablecoinContext> {
  readonly sourceName = 'defillama-stablecoins';

  async collect(_ctx: CollectorRunContext): Promise<CollectorResult<StablecoinContext>> {
    const res = await fetch(API_URL, { headers: { 'User-Agent': UA } });
    if (!res.ok) throw new Error(`DefiLlama stablecoins: ${res.status} ${res.statusText}`);

    const json = await res.json() as StablecoinsResponse;
    const assets = json.peggedAssets;
    if (!Array.isArray(assets) || assets.length === 0) {
      return { status: 'partial', itemCount: 0 };
    }

    // Only USD-pegged stablecoins
    const usdPegged = assets.filter((a) => a.pegType === 'peggedUSD');

    let totalSupply = 0;
    let totalPrevDay = 0;
    let totalPrevWeek = 0;

    for (const a of usdPegged) {
      totalSupply += usdSupply(a);
      totalPrevDay += a.circulatingPrevDay?.peggedUSD ?? usdSupply(a);
      totalPrevWeek += a.circulatingPrevWeek?.peggedUSD ?? usdSupply(a);
    }

    const top = [...usdPegged]
      .sort((a, b) => usdSupply(b) - usdSupply(a))
      .slice(0, 5)
      .map((a) => ({ symbol: a.symbol, supplyUsd: usdSupply(a), pegStatus: pegStatus(a) }));

    const data: StablecoinContext = {
      totalSupplyUsd: totalSupply,
      dayChangeUsd: totalSupply - totalPrevDay,
      weekChangeUsd: totalSupply - totalPrevWeek,
      topStablecoins: top,
      dataDate: new Date().toISOString().slice(0, 10),
    };

    return { status: 'success', data, itemCount: usdPegged.length };
  }
}
