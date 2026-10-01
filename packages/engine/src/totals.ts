import type { Aggregation, Criterion, TreeNode } from '@forkcast/shared';

/** Aggregated values per criterion id. A missing key means "no contribution" (neutral element). */
export type Totals = Record<string, number>;

/** Neutral element of an aggregation, as a number usable in comparisons. */
export function neutralNumeric(agg: Aggregation): number {
  switch (agg) {
    case 'sum':
    case 'probOr':
      return 0;
    case 'max':
      return -Infinity;
    case 'min':
      return Infinity;
  }
}

/** Combine two values (either may be absent = neutral). */
export function combine2(
  agg: Aggregation,
  a: number | undefined,
  b: number | undefined,
): number | undefined {
  if (a === undefined) return b;
  if (b === undefined) return a;
  switch (agg) {
    case 'sum':
      return a + b;
    case 'max':
      return a > b ? a : b;
    case 'min':
      return a < b ? a : b;
    case 'probOr':
      return 1 - (1 - a) * (1 - b);
  }
}

export function combineMany(agg: Aggregation, values: Array<number | undefined>): number | undefined {
  let acc: number | undefined;
  for (const v of values) acc = combine2(agg, acc, v);
  return acc;
}

/** Fast lookup over the criteria of a tree. */
export class CriteriaIndex {
  readonly list: readonly Criterion[];
  readonly byId: ReadonlyMap<string, Criterion>;

  constructor(criteria: readonly Criterion[]) {
    this.list = criteria;
    this.byId = new Map(criteria.map((c) => [c.id, c]));
  }

  get(id: string): Criterion | undefined {
    return this.byId.get(id);
  }
}

export function combineTotals(index: CriteriaIndex, a: Totals, b: Totals): Totals {
  const out: Totals = {};
  for (const c of index.list) {
    const v = combine2(c.aggregation, a[c.id], b[c.id]);
    if (v !== undefined) out[c.id] = v;
  }
  return out;
}

/** Values carried by the node itself (ignores unknown criteria and non-finite numbers). */
export function ownTotals(index: CriteriaIndex, node: TreeNode): Totals {
  const out: Totals = {};
  for (const c of index.list) {
    const v = node.values[c.id];
    if (v !== undefined && Number.isFinite(v.value)) out[c.id] = v.value;
  }
  return out;
}

/** Value used for ranking and dominance: an absent value is the neutral element. */
export function comparableValue(c: Criterion, totals: Totals): number {
  return totals[c.id] ?? neutralNumeric(c.aggregation);
}

/** Negative when `a` is better than `b` on criterion `c`, positive when worse, 0 when equal. */
export function compareOn(c: Criterion, a: Totals, b: Totals): number {
  const va = comparableValue(c, a);
  const vb = comparableValue(c, b);
  if (va === vb) return 0;
  const aLess = va < vb;
  if (c.direction === 'minimize') return aLess ? -1 : 1;
  return aLess ? 1 : -1;
}

function tidy(n: number): number {
  if (!Number.isFinite(n)) return n;
  return Number.parseFloat(n.toPrecision(12));
}

/**
 * Presentation form of totals: `sum`/`probOr` criteria get 0 when absent, `max`/`min`
 * stay absent (no contribution at all), and floating point noise is trimmed.
 */
export function normalizeTotals(index: CriteriaIndex, totals: Totals): Totals {
  const out: Totals = {};
  for (const c of index.list) {
    const v = totals[c.id];
    if (v !== undefined) out[c.id] = tidy(v);
    else if (c.aggregation === 'sum' || c.aggregation === 'probOr') out[c.id] = 0;
  }
  return out;
}

/**
 * Elementwise min or max over candidate totals, where an absent value counts as the
 * neutral element of its aggregation. A result that is not finite (e.g. the min of a
 * `max`-aggregated criterion that some candidate does not carry) is left absent.
 */
export function rangeOver(index: CriteriaIndex, candidates: Totals[], pick: 'min' | 'max'): Totals {
  const out: Totals = {};
  for (const c of index.list) {
    const neutral = neutralNumeric(c.aggregation);
    let best: number | undefined;
    for (const t of candidates) {
      const v = t[c.id] ?? neutral;
      if (best === undefined) best = v;
      else best = pick === 'min' ? Math.min(best, v) : Math.max(best, v);
    }
    if (best !== undefined && Number.isFinite(best)) out[c.id] = best;
  }
  return out;
}
