import type { Tree } from '@forkcast/shared';
import { DEFAULT_TOP_N, ENUMERATION_LIMIT, PARETO_CAP } from '@forkcast/shared';
import { computeAggregates, type NodeAggregate } from './aggregates';
import { countConfigurations, enumerateConfigurations, type Configuration } from './configurations';
import { kBest } from './kbest';
import { paretoFront, paretoKeys } from './pareto';
import { CriteriaIndex, compareOn } from './totals';

export interface AnalysisOptions {
  enumerationLimit?: number;
  topN?: number;
  paretoCap?: number;
}

export interface Analysis {
  /** Total number of configurations. */
  count: number;
  /** True when `configurations` holds them all. */
  enumerated: boolean;
  enumerationLimit: number;
  /** All configurations (empty when not enumerated). */
  configurations: Configuration[];
  /** Keys of the Pareto-optimal configurations. */
  paretoKeys: string[];
  /** The Pareto front itself (from enumeration, or from DP when too many configurations). */
  pareto: Configuration[];
  paretoExact: boolean;
  /** Best configurations per criterion id (best first). */
  best: Record<string, Configuration[]>;
  aggregates: Record<string, NodeAggregate>;
  warnings: string[];
}

/** One-shot analysis used by the comparison table and by the MCP `compute_configurations` tool. */
export function analyzeTree(tree: Tree, options: AnalysisOptions = {}): Analysis {
  const enumerationLimit = options.enumerationLimit ?? ENUMERATION_LIMIT;
  const topN = options.topN ?? DEFAULT_TOP_N;
  const index = new CriteriaIndex(tree.criteria);
  const warnings: string[] = [];

  for (const [id, node] of Object.entries(tree.nodes)) {
    if (node.kind === 'or' && (tree.children[id] ?? []).length === 0) {
      warnings.push(`OR node "${node.label}" (${id}) has no children; treated as a single option.`);
    }
  }

  const aggregates = computeAggregates(tree);
  const count = countConfigurations(tree);
  const best: Record<string, Configuration[]> = {};

  if (count <= enumerationLimit) {
    const { configurations } = enumerateConfigurations(tree, { limit: enumerationLimit });
    const keys = paretoKeys(index, configurations);
    for (const c of index.list) {
      best[c.id] = [...configurations].sort((a, b) => compareOn(c, a.totals, b.totals)).slice(0, topN);
    }
    return {
      count,
      enumerated: true,
      enumerationLimit,
      configurations,
      paretoKeys: [...keys],
      pareto: configurations.filter((c) => keys.has(c.key)),
      paretoExact: true,
      best,
      aggregates,
      warnings,
    };
  }

  warnings.push(
    `${count} configurations exceed the enumeration limit (${enumerationLimit}); only the Pareto front and the best configurations per criterion are computed.`,
  );
  const pareto = paretoFront(tree, { cap: options.paretoCap ?? PARETO_CAP });
  for (const c of index.list) best[c.id] = kBest(tree, c.id, topN);
  return {
    count,
    enumerated: false,
    enumerationLimit,
    configurations: [],
    paretoKeys: pareto.front.map((c) => c.key),
    pareto: pareto.front,
    paretoExact: pareto.exact,
    best,
    aggregates,
    warnings,
  };
}
