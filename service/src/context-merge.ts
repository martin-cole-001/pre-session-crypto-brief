import type {
  OverviewInput,
  CollectorResult,
  ContextCollector,
  LiquidityContext,
  EtfFlowContext,
  OptionsContext,
  MacroRatesContext,
  StablecoinContext,
  ChainFlowContext,
  AltsBreadthSummary,
} from './ports.js';
import type { ContextCollectorEntry } from './service-types.js';

export function mergeLiquidityContext(
  input: OverviewInput,
  result: CollectorResult<LiquidityContext>,
): OverviewInput {
  if (result.data === undefined) return input;
  return { ...input, liquidityContext: result.data };
}

export function mergeEtfFlowContext(
  input: OverviewInput,
  result: CollectorResult<EtfFlowContext>,
): OverviewInput {
  if (result.data === undefined) return input;
  return { ...input, etfFlowContext: result.data };
}

export function mergeOptionsContext(
  input: OverviewInput,
  result: CollectorResult<OptionsContext[]>,
): OverviewInput {
  if (result.data === undefined) return input;
  return { ...input, optionsContext: result.data };
}

// Deep-merge so multiple collectors (FRED for rates, BEA for GDP/PCE) can each contribute fields
export function mergeMacroRatesContext(
  input: OverviewInput,
  result: CollectorResult<MacroRatesContext>,
): OverviewInput {
  if (result.data === undefined) return input;
  return { ...input, macroRatesContext: { ...input.macroRatesContext, ...result.data } };
}

export function mergeStablecoinContext(
  input: OverviewInput,
  result: CollectorResult<StablecoinContext>,
): OverviewInput {
  if (result.data === undefined) return input;
  return { ...input, stablecoinContext: result.data };
}

export function mergeChainFlowContext(
  input: OverviewInput,
  result: CollectorResult<ChainFlowContext>,
): OverviewInput {
  if (result.data === undefined) return input;
  return { ...input, chainFlowContext: result.data };
}

export function mergeBreadthContext(
  input: OverviewInput,
  result: CollectorResult<AltsBreadthSummary>,
): OverviewInput {
  if (result.data === undefined) return input;
  return { ...input, altsBreadth: result.data };
}

// Type-safe constructor — erases T to unknown so entries can be stored in a plain array.
// TypeScript enforces that collector and merge are compatible at the call site.
export function contextCollectorEntry<T>(
  collector: ContextCollector<T>,
  merge: (input: OverviewInput, result: CollectorResult<T>) => OverviewInput,
): ContextCollectorEntry {
  return {
    collector: collector as ContextCollector<unknown>,
    merge: merge as (input: OverviewInput, result: CollectorResult<unknown>) => OverviewInput,
  };
}
