import type { Tree } from '@forkcast/shared';

export interface ConfigurationSelection {
  choices: Record<string, string>;
  included: Record<string, boolean>;
}

export interface ChoiceDescription {
  nodeId: string;
  kind: 'or' | 'optional';
  /** Label of the OR node or of the optional node. */
  label: string;
  /** Chosen child label, or "inclus"/"exclu" for optional nodes. */
  detail: string;
  included?: boolean;
}

/** Depth-first order of the node ids, so that descriptions follow the tree. */
function depthFirstIds(tree: Tree): string[] {
  const out: string[] = [];
  const visit = (id: string): void => {
    if (!tree.nodes[id]) return;
    out.push(id);
    for (const c of tree.children[id] ?? []) visit(c);
  };
  if (tree.meta.rootId) visit(tree.meta.rootId);
  for (const id of Object.keys(tree.nodes)) if (!out.includes(id)) out.push(id);
  return out;
}

/** Human readable description of a configuration: one entry per OR choice and per optional node. */
export function describeConfiguration(tree: Tree, config: ConfigurationSelection): ChoiceDescription[] {
  const out: ChoiceDescription[] = [];
  for (const id of depthFirstIds(tree)) {
    const node = tree.nodes[id];
    if (!node) continue;
    const chosen = config.choices[id];
    if (chosen !== undefined) {
      const child = tree.nodes[chosen];
      out.push({ nodeId: id, kind: 'or', label: node.label || '(sans titre)', detail: child?.label || chosen });
    }
    const flag = config.included[id];
    if (flag !== undefined) {
      out.push({
        nodeId: id,
        kind: 'optional',
        label: node.label || '(sans titre)',
        detail: flag ? 'inclus' : 'exclu',
        included: flag,
      });
    }
  }
  return out;
}

export function describeConfigurationText(tree: Tree, config: ConfigurationSelection): string {
  const parts = describeConfiguration(tree, config).map((d) =>
    d.kind === 'or' ? `${d.label} → ${d.detail}` : `${d.label} : ${d.detail}`,
  );
  return parts.length > 0 ? parts.join(' ; ') : 'Aucun choix (arbre sans alternative)';
}
