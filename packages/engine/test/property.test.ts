import { describe, expect, it } from 'vitest';
import {
  CriteriaIndex,
  comparableValue,
  computeAggregates,
  countConfigurations,
  enumerateConfigurations,
  kBest,
  paretoFilter,
  paretoFront,
  resolveConfiguration,
} from '../src';
import { randomTree } from './fixtures';

const totalsSignature = (t: Record<string, number>) =>
  JSON.stringify(Object.keys(t).sort().map((k) => [k, Number(t[k]!.toFixed(9))]));

describe('dynamic programming agrees with brute force on random trees', () => {
  const seeds = Array.from({ length: 60 }, (_, i) => i + 1);

  it.each(seeds)('seed %i', (seed) => {
    const tree = randomTree(seed);
    const index = new CriteriaIndex(tree.criteria);
    const count = countConfigurations(tree);
    const { configurations } = enumerateConfigurations(tree, { limit: 20000 });
    expect(configurations).toHaveLength(count);

    // Pareto front: same set of totals vectors
    const brute = new Set(paretoFilter(index, configurations).map((c) => totalsSignature(c.totals)));
    const dp = paretoFront(tree, { cap: 100000 });
    expect(dp.exact).toBe(true);
    expect(new Set(dp.front.map((c) => totalsSignature(c.totals)))).toEqual(brute);

    // every DP front member is a real configuration with the same totals
    const byKey = new Map(configurations.map((c) => [c.key, c]));
    for (const f of dp.front) {
      expect(byKey.get(f.key)?.totals).toEqual(f.totals);
      expect(resolveConfiguration(tree, f).totals).toEqual(f.totals);
    }

    // k-best per criterion: same sorted values
    for (const c of tree.criteria) {
      const sortedBrute = configurations
        .map((cfg) => comparableValue(c, cfg.totals))
        .sort((a, b) => (c.direction === 'minimize' ? a - b : b - a))
        .slice(0, 3);
      const sortedDp = kBest(tree, c.id, 3).map((cfg) => comparableValue(c, cfg.totals));
      expect(sortedDp).toEqual(sortedBrute);
    }

    // ranges of the root: min/max over all configurations
    const agg = computeAggregates(tree)[tree.meta.rootId]!;
    expect(agg.count).toBe(count);
    for (const c of tree.criteria) {
      // absent = neutral element; a non-finite bound is reported as absent
      const vals = configurations.map((cfg) => comparableValue(c, cfg.totals));
      const lo = Math.min(...vals);
      const hi = Math.max(...vals);
      if (Number.isFinite(lo)) expect(agg.min[c.id]).toBeCloseTo(lo, 9);
      else expect(agg.min[c.id]).toBeUndefined();
      if (Number.isFinite(hi)) expect(agg.max[c.id]).toBeCloseTo(hi, 9);
      else expect(agg.max[c.id]).toBeUndefined();
    }
  });
});
