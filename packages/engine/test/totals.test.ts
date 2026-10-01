import { describe, expect, it } from 'vitest';
import type { Criterion } from '@forkcast/shared';
import {
  CriteriaIndex,
  combine2,
  combineMany,
  combineTotals,
  compareOn,
  neutralNumeric,
  normalizeTotals,
} from '../src';

const crit = (id: string, aggregation: Criterion['aggregation'], direction: Criterion['direction'] = 'minimize'): Criterion => ({
  id,
  label: id,
  aggregation,
  direction,
  order: 0,
});

describe('combine2', () => {
  it('applies each aggregation', () => {
    expect(combine2('sum', 2, 3)).toBe(5);
    expect(combine2('max', 2, 3)).toBe(3);
    expect(combine2('min', 2, 3)).toBe(2);
    expect(combine2('probOr', 0.5, 0.5)).toBeCloseTo(0.75);
  });

  it('treats an absent value as the neutral element', () => {
    for (const agg of ['sum', 'max', 'min', 'probOr'] as const) {
      expect(combine2(agg, undefined, 4)).toBe(4);
      expect(combine2(agg, 4, undefined)).toBe(4);
      expect(combine2(agg, undefined, undefined)).toBeUndefined();
      expect(combine2(agg, neutralNumeric(agg), 4)).toBe(4);
    }
    expect(combineMany('probOr', [0.1, undefined, 0.2])).toBeCloseTo(0.28);
  });
});

describe('totals helpers', () => {
  const index = new CriteriaIndex([crit('s', 'sum'), crit('m', 'max'), crit('b', 'sum', 'maximize')]);

  it('combines per criterion and skips unknown criteria', () => {
    expect(combineTotals(index, { s: 1, m: 2, zz: 9 }, { s: 3, b: 1 })).toEqual({ s: 4, m: 2, b: 1 });
  });

  it('normalizes: sum gets 0 when absent, max stays absent, floats tidied', () => {
    expect(normalizeTotals(index, { s: 0.1 + 0.2 })).toEqual({ s: 0.3, b: 0 });
  });

  it('compares with direction', () => {
    const s = index.get('s')!;
    const b = index.get('b')!;
    expect(compareOn(s, { s: 1 }, { s: 2 })).toBeLessThan(0);
    expect(compareOn(b, { b: 1 }, { b: 2 })).toBeGreaterThan(0);
    expect(compareOn(s, {}, { s: 0 })).toBe(0);
  });
});
