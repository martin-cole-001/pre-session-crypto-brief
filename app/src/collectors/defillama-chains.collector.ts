import type { ContextCollector, CollectorRunContext, CollectorResult, ChainFlowContext } from '../../../service/src/ports.js';

// Returns [{date, tvl}] for all chains combined, sorted ascending
const HISTORY_URL = 'https://api.llama.fi/v2/historicalChainTvl';
const CHAINS_URL = 'https://api.llama.fi/v2/chains';
const UA = 'trader-agent/session-overview';

interface TvlPoint { date: number; tvl: number }
interface ChainEntry { name: string; tvl: number }

function pctChange(current: number, previous: number): number {
  if (previous === 0) return 0;
  return parseFloat(((current - previous) / previous * 100).toFixed(2));
}

export class DefiLlamaChainsCollector implements ContextCollector<ChainFlowContext> {
  readonly sourceName = 'defillama-chains';

  async collect(_ctx: CollectorRunContext): Promise<CollectorResult<ChainFlowContext>> {
    const [histRes, chainsRes] = await Promise.all([
      fetch(HISTORY_URL, { headers: { 'User-Agent': UA } }),
      fetch(CHAINS_URL, { headers: { 'User-Agent': UA } }),
    ]);

    if (!histRes.ok) throw new Error(`DefiLlama TVL history: ${histRes.status} ${histRes.statusText}`);
    if (!chainsRes.ok) throw new Error(`DefiLlama chains: ${chainsRes.status} ${chainsRes.statusText}`);

    const history = await histRes.json() as TvlPoint[];
    const chains = await chainsRes.json() as ChainEntry[];

    if (!Array.isArray(history) || history.length < 2) {
      return { status: 'partial', itemCount: 0 };
    }

    // History is sorted ascending; take last 8 points for day/week change
    const sorted = [...history].sort((a, b) => a.date - b.date);
    const current = sorted.at(-1)!.tvl;
    const dayAgo = sorted.at(-2)?.tvl ?? current;
    const weekAgo = sorted.at(-8)?.tvl ?? sorted[0]!.tvl;

    const topChains = Array.isArray(chains)
      ? [...chains]
          .sort((a, b) => b.tvl - a.tvl)
          .slice(0, 8)
          .map((c) => ({ name: c.name, tvlUsd: c.tvl }))
      : [];

    const data: ChainFlowContext = {
      totalTvlUsd: current,
      dayChangePct: pctChange(current, dayAgo),
      weekChangePct: pctChange(current, weekAgo),
      topChains,
      dataDate: new Date().toISOString().slice(0, 10),
    };

    return { status: 'success', data, itemCount: topChains.length };
  }
}
