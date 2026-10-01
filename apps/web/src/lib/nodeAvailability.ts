import type { NodeKind, Tree } from '@forkcast/shared';

export interface NodeAvailability {
  nodeId: string;
  isRoot: boolean;
  hasChildren: boolean;
  /** False in read-only mode: no action changes the document. */
  canEdit: boolean;
  addChild: boolean;
  addSibling: boolean;
  kind: NodeKind;
  changeKind: boolean;
  /** A node with children cannot become a leaf. */
  leafDisabled: boolean;
  /** "Optionnel" only makes sense for a child of an AND node (never the root). */
  optionalAvailable: boolean;
  optional: boolean;
  /** Collapse / expand is view state: available even in read-only mode. */
  collapseAvailable: boolean;
  collapsed: boolean;
  rename: boolean;
  remove: boolean;
}

/** Which actions make sense for a node (toolbar, context menu, details card). */
export function getNodeAvailability(
  tree: Tree,
  nodeId: string | null,
  options: { readOnly: boolean; collapsed: boolean },
): NodeAvailability | null {
  if (!nodeId) return null;
  const node = tree.nodes[nodeId];
  if (!node) return null;
  const isRoot = nodeId === tree.meta.rootId;
  const hasChildren = (tree.children[nodeId] ?? []).length > 0;
  const parent = node.parentId ? tree.nodes[node.parentId] : undefined;
  const canEdit = !options.readOnly;
  const optionalAvailable = canEdit && !isRoot && parent?.kind === 'and';
  return {
    nodeId,
    isRoot,
    hasChildren,
    canEdit,
    addChild: canEdit,
    addSibling: canEdit && !isRoot,
    kind: node.kind,
    changeKind: canEdit,
    leafDisabled: hasChildren,
    optionalAvailable,
    optional: node.optional === true,
    collapseAvailable: hasChildren,
    collapsed: hasChildren && options.collapsed,
    rename: canEdit,
    remove: canEdit && !isRoot,
  };
}
