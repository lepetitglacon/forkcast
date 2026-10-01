import { useMemo } from 'react';
import type { Tree } from '@forkcast/shared';
import { analyzeTree, type Analysis, type AnalysisOptions } from '@forkcast/engine';

/** Memoized full analysis (configurations, Pareto front, best per criterion). */
export function useAnalysis(tree: Tree, options?: AnalysisOptions): Analysis {
  const topN = options?.topN;
  const enumerationLimit = options?.enumerationLimit;
  return useMemo(
    () =>
      analyzeTree(tree, {
        ...(topN !== undefined ? { topN } : {}),
        ...(enumerationLimit !== undefined ? { enumerationLimit } : {}),
      }),
    [tree, topN, enumerationLimit],
  );
}
