import type { Tree } from '@forkcast/shared';
import { countConfigurations } from './configurations';
import {
  CriteriaIndex,
  combineTotals,
  rangeOver,
  neutralNumeric,
  normalizeTotals,
  ownTotals,
  type Totals,
} from './totals';

export interface NodeAggregate {
  /** Values carried by the node itself. */
  own: Totals;
  /** Per criterion, the smallest total reachable in the subtree (normalized). */
  min: Totals;
  /** Per criterion, the largest total reachable in the subtree (normalized). */
  max: Totals;
  /** Number of configurations of the subtree. */
  count: number;
  /** True when the subtree holds at least one OR choice or optional node. */
  hasChoices: boolean;
}

interface RawAggregate {
  min: Totals;
  max: Totals;
  count: number;
}

/**
 * Per-node aggregates and [min, max] ranges, bottom-up, without enumerating. For an
 * optional child of an AND node, the min side includes the child only when that lowers
 * the total (e.g. negative sums) and the max side only when that raises it.
 */
export function computeAggregates(tree: Tree): Record<string, NodeAggregate> {
  const index = new CriteriaIndex(tree.criteria);
  const out: Record<string, NodeAggregate> = {};

  const visit = (nodeId: string): RawAggregate => {
    const node = tree.nodes[nodeId];
    if (!node) return { min: {}, max: {}, count: 1 };
    const own = ownTotals(index, node);
    const kids = tree.children[nodeId] ?? [];
    let raw: RawAggregate;

    if (kids.length === 0) {
      raw = { min: own, max: own, count: 1 };
    } else if (node.kind === 'or') {
      const mins: Totals[] = [];
      const maxs: Totals[] = [];
      let count = 0;
      for (const k of kids) {
        const child = visit(k);
        mins.push(combineTotals(index, own, child.min));
        maxs.push(combineTotals(index, own, child.max));
        count += child.count;
      }
      raw = { min: rangeOver(index, mins, 'min'), max: rangeOver(index, maxs, 'max'), count };
    } else {
      let min = own;
      let max = own;
      let count = 1;
      for (const k of kids) {
        const child = visit(k);
        const childNode = tree.nodes[k];
        if (childNode?.optional) {
          const cmin: Totals = {};
          const cmax: Totals = {};
          for (const c of index.list) {
            const neutral = neutralNumeric(c.aggregation);
            const lo = child.min[c.id];
            const hi = child.max[c.id];
            if (lo !== undefined && lo < neutral) cmin[c.id] = lo;
            if (hi !== undefined && hi > neutral) cmax[c.id] = hi;
          }
          min = combineTotals(index, min, cmin);
          max = combineTotals(index, max, cmax);
          count *= child.count + 1;
        } else {
          min = combineTotals(index, min, child.min);
          max = combineTotals(index, max, child.max);
          count *= child.count;
        }
      }
      raw = { min, max, count };
    }

    out[nodeId] = {
      own: normalizeTotals(index, own),
      min: normalizeTotals(index, raw.min),
      max: normalizeTotals(index, raw.max),
      count: raw.count,
      hasChoices: raw.count > 1,
    };
    return raw;
  };

  if (tree.nodes[tree.meta.rootId]) visit(tree.meta.rootId);
  // Nodes unreachable from the root (should not happen after snapshot repair) still get an entry.
  for (const id of Object.keys(tree.nodes)) if (!out[id]) visit(id);
  return out;
}

export { countConfigurations };
