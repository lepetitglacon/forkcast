import type { Tree } from '@forkcast/shared';
import {
  toConfiguration,
  walkConfigurations,
  type Configuration,
  type PartialConfiguration,
} from './configurations';
import { CriteriaIndex, compareOn } from './totals';

/**
 * The `k` best configurations for one criterion, by dynamic programming (top-k kept at
 * every node). Exact for monotone aggregations. Ties are resolved by traversal order.
 */
export function kBest(tree: Tree, criterionId: string, k: number): Configuration[] {
  const index = new CriteriaIndex(tree.criteria);
  const criterion = index.get(criterionId);
  if (!criterion) throw new Error(`Unknown criterion "${criterionId}"`);
  const prune = (list: PartialConfiguration[]): PartialConfiguration[] =>
    [...list].sort((a, b) => compareOn(criterion, a.totals, b.totals)).slice(0, k);
  const partials = walkConfigurations(tree, index, prune);
  return partials
    .sort((a, b) => compareOn(criterion, a.totals, b.totals))
    .slice(0, k)
    .map((p) => toConfiguration(index, p));
}

/** Sort enumerated configurations by one criterion (best first), stable. */
export function sortByCriterion(
  tree: Tree,
  configurations: Configuration[],
  criterionId: string,
): Configuration[] {
  const criterion = tree.criteria.find((c) => c.id === criterionId);
  if (!criterion) throw new Error(`Unknown criterion "${criterionId}"`);
  return [...configurations].sort((a, b) => compareOn(criterion, a.totals, b.totals));
}
