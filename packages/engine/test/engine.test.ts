import { describe, expect, it } from 'vitest';
import {
  analyzeTree,
  computeAggregates,
  countConfigurations,
  enumerateConfigurations,
  kBest,
  paretoFront,
  resolveConfiguration,
} from '../src';
import { buildTree } from './fixtures';

const criteria = [
  { id: 'cost', aggregation: 'sum' as const },
  { id: 'risk', aggregation: 'probOr' as const },
  { id: 'time', aggregation: 'max' as const },
];

/** root AND [ OR psp (stripe | adyen), host (leaf), AND sec [ 3ds, optional fraud ] ] */
const sample = () =>
  buildTree(
    {
      id: 'root',
      kind: 'and',
      values: { cost: 1 },
      children: [
        {
          id: 'psp',
          kind: 'or',
          children: [
            { id: 'stripe', values: { cost: 25, risk: 0.05, time: 5 } },
            { id: 'adyen', values: { cost: 60, risk: 0.1, time: 10 } },
          ],
        },
        { id: 'host', values: { cost: 5, time: 3 } },
        {
          id: 'sec',
          kind: 'and',
          children: [
            { id: 'tds', values: { risk: 0.05, time: 3 } },
            { id: 'fraud', optional: true, values: { cost: 30, risk: 0.02 } },
          ],
        },
      ],
    },
    criteria,
  );

describe('countConfigurations', () => {
  it('multiplies AND children, sums OR children, adds one for optional', () => {
    expect(countConfigurations(sample())).toBe(2 * 1 * 2);
    expect(countConfigurations(sample(), 'psp')).toBe(2);
    expect(countConfigurations(sample(), 'sec')).toBe(2);
    expect(countConfigurations(sample(), 'stripe')).toBe(1);
  });

  it('handles nested OR nodes', () => {
    const t = buildTree(
      {
        kind: 'or',
        children: [
          { kind: 'or', children: [{}, {}, {}] },
          { kind: 'and', children: [{ kind: 'or', children: [{}, {}] }, { kind: 'or', children: [{}, {}] }] },
        ],
      },
      criteria,
    );
    expect(countConfigurations(t)).toBe(3 + 4);
  });

  it('treats an empty tree and an OR without children as one configuration', () => {
    expect(countConfigurations(buildTree({}, criteria))).toBe(1);
    expect(countConfigurations(buildTree({ kind: 'or' }, criteria))).toBe(1);
  });
});

describe('enumerateConfigurations', () => {
  it('produces every configuration with the right totals', () => {
    const { configurations, total, truncated } = enumerateConfigurations(sample());
    expect(total).toBe(4);
    expect(truncated).toBe(false);
    expect(configurations).toHaveLength(4);
    const stripeNoFraud = configurations.find((c) => c.choices['psp'] === 'stripe' && c.included['fraud'] === false)!;
    expect(stripeNoFraud.totals['cost']).toBe(1 + 25 + 5);
    expect(stripeNoFraud.totals['time']).toBe(5);
    expect(stripeNoFraud.totals['risk']).toBeCloseTo(1 - (1 - 0.05) * (1 - 0.05), 9);
    const adyenFraud = configurations.find((c) => c.choices['psp'] === 'adyen' && c.included['fraud'] === true)!;
    expect(adyenFraud.totals['cost']).toBe(1 + 60 + 5 + 30);
    expect(adyenFraud.totals['time']).toBe(10);
    expect(adyenFraud.totals['risk']).toBeCloseTo(1 - 0.9 * 0.95 * 0.98);
    expect(new Set(configurations.map((c) => c.key)).size).toBe(4);
  });

  it('refuses to enumerate above the limit but still counts', () => {
    const t = buildTree(
      { kind: 'and', children: Array.from({ length: 13 }, () => ({ kind: 'or', children: [{}, {}] })) },
      criteria,
    );
    const r = enumerateConfigurations(t, { limit: 5000 });
    expect(r.total).toBe(2 ** 13);
    expect(r.truncated).toBe(true);
    expect(r.configurations).toEqual([]);
  });
});

describe('computeAggregates', () => {
  it('gives ranges for OR nodes and exact values for fixed subtrees', () => {
    const agg = computeAggregates(sample());
    expect(agg['psp']!.min).toEqual({ cost: 25, risk: 0.05, time: 5 });
    expect(agg['psp']!.max).toEqual({ cost: 60, risk: 0.1, time: 10 });
    expect(agg['psp']!.count).toBe(2);
    expect(agg['host']!.min).toEqual(agg['host']!.max);
    expect(agg['host']!.hasChoices).toBe(false);
    // optional child: min excludes it, max includes it
    expect(agg['sec']!.min).toEqual({ cost: 0, risk: 0.05, time: 3 });
    expect(agg['sec']!.max['cost']).toBe(30);
    expect(agg['sec']!.max['risk']).toBeCloseTo(1 - 0.95 * 0.98);
    expect(agg['root']!.min['cost']).toBe(1 + 25 + 5);
    expect(agg['root']!.max['cost']).toBe(1 + 60 + 5 + 30);
    expect(agg['root']!.count).toBe(4);
  });

  it('handles a negative optional value on the min side', () => {
    const t = buildTree(
      { kind: 'and', children: [{ values: { cost: 10 } }, { optional: true, values: { cost: -4 } }] },
      [{ id: 'cost' }],
    );
    const agg = computeAggregates(t);
    expect(agg[t.meta.rootId]!.min['cost']).toBe(6);
    expect(agg[t.meta.rootId]!.max['cost']).toBe(10);
  });

  it('max aggregation: absent values stay absent', () => {
    const t = buildTree({ kind: 'and', children: [{ values: {} }, { values: {} }] }, [{ id: 'time', aggregation: 'max' }]);
    expect(computeAggregates(t)[t.meta.rootId]!.min).toEqual({});
  });
});

describe('paretoFront / kBest', () => {
  it('finds the non-dominated configurations', () => {
    const { front, exact } = paretoFront(sample());
    expect(exact).toBe(true);
    // stripe/no-fraud dominates everything on cost & time; adding fraud lowers nothing (risk goes up), so the front is a single config
    expect(front).toHaveLength(1);
    expect(front[0]!.choices['psp']).toBe('stripe');
    expect(front[0]!.included['fraud']).toBe(false);
  });

  it('keeps trade-offs', () => {
    const t = buildTree(
      { kind: 'or', children: [{ values: { cost: 1, time: 9 } }, { values: { cost: 9, time: 1 } }, { values: { cost: 9, time: 9 } }] },
      [{ id: 'cost' }, { id: 'time', aggregation: 'max' }],
    );
    expect(paretoFront(t).front).toHaveLength(2);
    expect(kBest(t, 'cost', 1)[0]!.totals['cost']).toBe(1);
    expect(kBest(t, 'time', 2).map((c) => c.totals['time'])).toEqual([1, 9]);
  });
});

describe('resolveConfiguration', () => {
  it('lists included nodes, contributions and defaults', () => {
    const r = resolveConfiguration(sample(), { choices: { psp: 'adyen' } });
    expect(r.nodeIds).toEqual(['root', 'psp', 'adyen', 'host', 'sec', 'tds', 'fraud']);
    expect(r.defaultedOptional).toEqual(['fraud']);
    expect(r.defaultedOr).toEqual([]);
    expect(r.totals['cost']).toBe(1 + 60 + 5 + 30);
    expect(r.contributions['sec']!.subtotal['cost']).toBe(30);
    expect(r.contributions['root']!.own['cost']).toBe(1);
  });

  it('falls back to the first child for invalid choices', () => {
    const r = resolveConfiguration(sample(), { choices: { psp: 'host' }, included: { fraud: false } });
    expect(r.invalidChoices).toEqual(['psp']);
    expect(r.choices['psp']).toBe('stripe');
    expect(r.nodeIds).not.toContain('fraud');
  });
});

describe('analyzeTree', () => {
  it('enumerates small trees and flags Pareto rows', () => {
    const a = analyzeTree(sample());
    expect(a.enumerated).toBe(true);
    expect(a.configurations).toHaveLength(4);
    expect(a.paretoKeys).toHaveLength(1);
    expect(a.best['cost']![0]!.totals['cost']).toBe(31);
    expect(a.warnings).toEqual([]);
  });

  it('warns on empty OR nodes and on too many configurations', () => {
    const t = buildTree(
      { kind: 'and', children: [{ kind: 'or' }, ...Array.from({ length: 20 }, () => ({ kind: 'or' as const, children: [{ values: { cost: 1 } }, { values: { cost: 2 } }] }))] },
      [{ id: 'cost' }],
    );
    const a = analyzeTree(t, { topN: 3 });
    expect(a.count).toBe(2 ** 20);
    expect(a.enumerated).toBe(false);
    expect(a.warnings.length).toBe(2);
    expect(a.pareto).toHaveLength(1);
    expect(a.best['cost']!.map((c) => c.totals['cost'])).toEqual([20, 21, 21]);
  });

  it('is fast on a large tree', () => {
    const t = buildTree(
      {
        kind: 'and',
        children: Array.from({ length: 40 }, (_, i) => ({
          kind: 'or',
          children: Array.from({ length: 4 }, (_, j) => ({ values: { cost: i + j, time: (i * j) % 7, risk: 0.01 * j } })),
        })),
      },
      criteria,
    );
    const start = performance.now();
    const a = analyzeTree(t);
    expect(a.count).toBe(4 ** 40);
    expect(a.pareto.length).toBeGreaterThan(0);
    expect(performance.now() - start).toBeLessThan(3000);
  });
});
