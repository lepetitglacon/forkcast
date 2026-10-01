import { useMemo } from 'react';
import type { Tree } from '@forkcast/shared';
import { computeAggregates, type NodeAggregate } from '@forkcast/engine';

/** Memoized per-node aggregates and [min, max] ranges. */
export function useAggregates(tree: Tree): Record<string, NodeAggregate> {
  return useMemo(() => computeAggregates(tree), [tree]);
}
