import type { Tree } from '@forkcast/shared';
import { ENUMERATION_LIMIT } from '@forkcast/shared';
import { CriteriaIndex, combineTotals, normalizeTotals, ownTotals, type Totals } from './totals';

/** One complete choice of every reachable OR node and optional node. */
export interface Configuration {
  /** Stable key derived from the choices; identical across clients. */
  key: string;
  /** Chosen child per OR node reached by the configuration. */
  choices: Record<string, string>;
  /** Inclusion flag per optional node reached by the configuration. */
  included: Record<string, boolean>;
  totals: Totals;
}

/** Partial configuration of a subtree while walking the tree bottom-up. */
export interface PartialConfiguration {
  choices: Record<string, string>;
  included: Record<string, boolean>;
  totals: Totals;
}

export type Prune = (list: PartialConfiguration[]) => PartialConfiguration[];

export function configurationKey(p: Pick<PartialConfiguration, 'choices' | 'included'>): string {
  const choices = Object.keys(p.choices)
    .sort()
    .map((k) => `${k}=${p.choices[k]}`)
    .join(',');
  const included = Object.keys(p.included)
    .sort()
    .map((k) => `${k}=${p.included[k] ? 1 : 0}`)
    .join(',');
  return `${choices}|${included}`;
}

function childrenOf(tree: Tree, nodeId: string): readonly string[] {
  return tree.children[nodeId] ?? [];
}

/**
 * Number of configurations of the subtree rooted at `nodeId` (the whole tree by default).
 * leaf = 1, OR = Σ children, AND = Π children (an optional child counts its configurations + 1).
 */
export function countConfigurations(tree: Tree, nodeId: string = tree.meta.rootId): number {
  const node = tree.nodes[nodeId];
  if (!node) return 0;
  const kids = childrenOf(tree, nodeId);
  if (kids.length === 0) return 1;
  if (node.kind === 'or') {
    let total = 0;
    for (const k of kids) total += countConfigurations(tree, k);
    return total;
  }
  let total = 1;
  for (const k of kids) {
    const child = tree.nodes[k];
    const c = countConfigurations(tree, k);
    total *= child?.optional ? c + 1 : c;
  }
  return total;
}

function mergeRecords<T>(a: Record<string, T>, b: Record<string, T>): Record<string, T> {
  const ka = Object.keys(a);
  const kb = Object.keys(b);
  if (kb.length === 0) return a;
  if (ka.length === 0) return b;
  return { ...a, ...b };
}

/**
 * Generic bottom-up walk producing the configurations of a subtree. `prune` is applied
 * after every union (OR) and product (AND) step; it must keep the "interesting" partial
 * configurations only when the combination operators are monotone, which holds for all
 * supported aggregations (sum, max, min, probOr).
 */
export function walkConfigurations(
  tree: Tree,
  index: CriteriaIndex,
  prune: Prune | null,
  nodeId: string = tree.meta.rootId,
): PartialConfiguration[] {
  const node = tree.nodes[nodeId];
  if (!node) return [];
  const own = ownTotals(index, node);
  const single: PartialConfiguration[] = [{ choices: {}, included: {}, totals: own }];
  const kids = childrenOf(tree, nodeId);
  if (kids.length === 0) return single;

  if (node.kind === 'or') {
    const out: PartialConfiguration[] = [];
    for (const k of kids) {
      for (const pc of walkConfigurations(tree, index, prune, k)) {
        out.push({
          choices: { ...pc.choices, [nodeId]: k },
          included: pc.included,
          totals: combineTotals(index, own, pc.totals),
        });
      }
    }
    return prune ? prune(out) : out;
  }

  // 'and' (a 'leaf' that still has children is treated as 'and')
  let acc = single;
  for (const k of kids) {
    const child = tree.nodes[k];
    let options = walkConfigurations(tree, index, prune, k);
    if (child?.optional) {
      options = [
        { choices: {}, included: { [k]: false }, totals: {} },
        ...options.map((o) => ({ ...o, included: { ...o.included, [k]: true } })),
      ];
    }
    const next: PartialConfiguration[] = [];
    for (const a of acc) {
      for (const o of options) {
        next.push({
          choices: mergeRecords(a.choices, o.choices),
          included: mergeRecords(a.included, o.included),
          totals: combineTotals(index, a.totals, o.totals),
        });
      }
    }
    acc = prune ? prune(next) : next;
  }
  return acc;
}

export function toConfiguration(index: CriteriaIndex, p: PartialConfiguration): Configuration {
  return {
    key: configurationKey(p),
    choices: p.choices,
    included: p.included,
    totals: normalizeTotals(index, p.totals),
  };
}

export interface EnumerationResult {
  /** Total number of configurations, even when not enumerated. */
  total: number;
  /** Empty when `total` exceeds the limit. */
  configurations: Configuration[];
  truncated: boolean;
}

/** Enumerate every configuration, unless there are more than `limit` of them. */
export function enumerateConfigurations(
  tree: Tree,
  options: { limit?: number } = {},
): EnumerationResult {
  const limit = options.limit ?? ENUMERATION_LIMIT;
  const total = countConfigurations(tree);
  if (total > limit) return { total, configurations: [], truncated: true };
  const index = new CriteriaIndex(tree.criteria);
  const partials = walkConfigurations(tree, index, null);
  return {
    total,
    configurations: partials.map((p) => toConfiguration(index, p)),
    truncated: false,
  };
}
