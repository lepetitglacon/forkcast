import type { Tree } from '@forkcast/shared';
import { PARETO_CAP } from '@forkcast/shared';
import {
  configurationKey,
  toConfiguration,
  walkConfigurations,
  type Configuration,
  type PartialConfiguration,
} from './configurations';
import { CriteriaIndex, compareOn, type Totals } from './totals';

/** `a` dominates `b`: at least as good on every criterion and strictly better on one. */
export function dominates(index: CriteriaIndex, a: Totals, b: Totals): boolean {
  let strict = false;
  for (const c of index.list) {
    const cmp = compareOn(c, a, b);
    if (cmp > 0) return false;
    if (cmp < 0) strict = true;
  }
  return strict;
}

/** Keep only non-dominated entries (stable order, duplicates kept). */
export function paretoFilter<T extends { totals: Totals }>(index: CriteriaIndex, list: T[]): T[] {
  const kept: T[] = [];
  outer: for (const cand of list) {
    for (let i = kept.length - 1; i >= 0; i--) {
      const k = kept[i]!;
      if (dominates(index, k.totals, cand.totals)) continue outer;
      if (dominates(index, cand.totals, k.totals)) kept.splice(i, 1);
    }
    kept.push(cand);
  }
  return kept;
}

export interface ParetoResult {
  front: Configuration[];
  /** False when the per-node cap truncated the dynamic programming (front may be incomplete). */
  exact: boolean;
}

/**
 * Pareto front of the whole tree by dynamic programming: non-dominated partial
 * configurations are kept at every node, which is exact because every aggregation is
 * monotone. Does not enumerate the configurations.
 */
export function paretoFront(tree: Tree, options: { cap?: number } = {}): ParetoResult {
  const cap = options.cap ?? PARETO_CAP;
  const index = new CriteriaIndex(tree.criteria);
  let exact = true;
  const prune = (list: PartialConfiguration[]): PartialConfiguration[] => {
    let kept = paretoFilter(index, list);
    if (kept.length > cap) {
      exact = false;
      kept = [...kept]
        .sort((a, b) => configurationKey(a).localeCompare(configurationKey(b)))
        .slice(0, cap);
    }
    return kept;
  };
  const partials = walkConfigurations(tree, index, prune);
  const front = partials.map((p) => toConfiguration(index, p));
  return { front, exact };
}

/** Keys of the Pareto-optimal configurations among an enumerated list. */
export function paretoKeys(index: CriteriaIndex, configurations: Configuration[]): Set<string> {
  return new Set(paretoFilter(index, configurations).map((c) => c.key));
}
