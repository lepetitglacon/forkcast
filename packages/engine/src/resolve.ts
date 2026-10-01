import type { Tree } from '@forkcast/shared';
import { configurationKey } from './configurations';
import { CriteriaIndex, combineTotals, normalizeTotals, ownTotals, type Totals } from './totals';

export interface Selection {
  /** Chosen child per OR node. */
  choices?: Record<string, string>;
  /** Inclusion per optional node. */
  included?: Record<string, boolean>;
}

export interface Contribution {
  nodeId: string;
  /** Values carried by the node itself. */
  own: Totals;
  /** Total of the node's subtree within this configuration. */
  subtotal: Totals;
}

export interface ResolvedConfiguration {
  key: string;
  choices: Record<string, string>;
  included: Record<string, boolean>;
  /** Every node that is part of the configuration, in depth-first order. */
  nodeIds: string[];
  totals: Totals;
  contributions: Record<string, Contribution>;
  /** OR nodes for which no (valid) choice was given: their first child was used. */
  defaultedOr: string[];
  /** Optional nodes with no inclusion flag: included by default. */
  defaultedOptional: string[];
  /** Choices that referenced a node that is not a child of the OR node. */
  invalidChoices: string[];
}

/**
 * Resolve a (possibly partial) selection into the set of included nodes, the totals and
 * the contribution of every node. Missing choices fall back to deterministic defaults.
 */
export function resolveConfiguration(tree: Tree, selection: Selection = {}): ResolvedConfiguration {
  const index = new CriteriaIndex(tree.criteria);
  const choices: Record<string, string> = {};
  const included: Record<string, boolean> = {};
  const nodeIds: string[] = [];
  const contributions: Record<string, Contribution> = {};
  const defaultedOr: string[] = [];
  const defaultedOptional: string[] = [];
  const invalidChoices: string[] = [];

  const visit = (nodeId: string): Totals => {
    const node = tree.nodes[nodeId];
    if (!node) return {};
    nodeIds.push(nodeId);
    const own = ownTotals(index, node);
    const kids = tree.children[nodeId] ?? [];
    let subtotal = own;

    if (kids.length > 0 && node.kind === 'or') {
      const wanted = selection.choices?.[nodeId];
      let chosen = kids[0]!;
      if (wanted !== undefined && kids.includes(wanted)) chosen = wanted;
      else {
        if (wanted !== undefined) invalidChoices.push(nodeId);
        defaultedOr.push(nodeId);
      }
      choices[nodeId] = chosen;
      subtotal = combineTotals(index, own, visit(chosen));
    } else if (kids.length > 0) {
      for (const k of kids) {
        const child = tree.nodes[k];
        if (child?.optional) {
          const flag = selection.included?.[k];
          const isIn = flag ?? true;
          if (flag === undefined) defaultedOptional.push(k);
          included[k] = isIn;
          if (!isIn) continue;
        }
        subtotal = combineTotals(index, subtotal, visit(k));
      }
    }

    contributions[nodeId] = {
      nodeId,
      own: normalizeTotals(index, own),
      subtotal: normalizeTotals(index, subtotal),
    };
    return subtotal;
  };

  const totals = tree.nodes[tree.meta.rootId] ? visit(tree.meta.rootId) : {};
  return {
    key: configurationKey({ choices, included }),
    choices,
    included,
    nodeIds,
    totals: normalizeTotals(index, totals),
    contributions,
    defaultedOr,
    defaultedOptional,
    invalidChoices,
  };
}
