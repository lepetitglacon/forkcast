import type * as Y from 'yjs';
import {
  CommandSchema,
  MAX_TREE_NODES,
  normalizeValue,
  type Command,
  type Criterion,
  type CriterionInit,
  type CriterionPatch,
  type EstimatedBy,
  type NodeInit,
  type NodeJson,
  type NodeKind,
  type NodeValue,
  type Position,
  type TreeNode,
  type ValueInput,
} from '@forkcast/shared';
import { DocError } from './errors';
import { newId, slugify } from './ids';
import { generateNKeysBetween, keyForIndex } from './order';
import {
  cleanValue,
  getValuesMap,
  makeCriterionMap,
  makeNodeMap,
  readCriterion,
  readNode,
  type NodeFields,
} from './nodes';
import { getCriteria, getMeta, getNodes, type NodeMap, type Origin } from './schema';
import { buildSnapshot, isAncestor, subtreeIds } from './snapshot';
import * as Yjs from 'yjs';

/** What every command returns: a result, the commands that undo it, and the touched nodes. */
export interface CommandResult<T = unknown> {
  result: T;
  inverse: Command[];
  affectedNodeIds: string[];
}

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

function requireInit(doc: Y.Doc): string {
  const rootId = getMeta(doc).get('rootId');
  if (typeof rootId !== 'string' || !getNodes(doc).has(rootId)) {
    throw new DocError('NOT_INITIALIZED', 'The document has no root node yet (call initDoc first).');
  }
  return rootId;
}

function requireNodeMap(doc: Y.Doc, nodeId: string): NodeMap {
  const map = getNodes(doc).get(nodeId);
  if (!map) throw new DocError('NODE_NOT_FOUND', `Node "${nodeId}" does not exist.`, { nodeId });
  return map;
}

function requireNode(doc: Y.Doc, nodeId: string): TreeNode {
  const node = readNode(requireNodeMap(doc, nodeId), nodeId);
  if (!node) throw new DocError('NODE_NOT_FOUND', `Node "${nodeId}" is unreadable.`, { nodeId });
  return node;
}

function compareSiblings(a: TreeNode, b: TreeNode): number {
  if (a.orderKey < b.orderKey) return -1;
  if (a.orderKey > b.orderKey) return 1;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

/** Raw children of a node (sorted), read from the maps. */
function childrenOf(doc: Y.Doc, parentId: string): TreeNode[] {
  const out: TreeNode[] = [];
  getNodes(doc).forEach((map, key) => {
    const n = readNode(map, key);
    if (n && n.parentId === parentId && n.id !== parentId) out.push(n);
  });
  return out.sort(compareSiblings);
}

function assertCapacity(doc: Y.Doc, adding: number): void {
  const total = getNodes(doc).size + adding;
  if (total > MAX_TREE_NODES) {
    throw new DocError(
      'LIMIT_EXCEEDED',
      `The tree would hold ${total} nodes, above the limit of ${MAX_TREE_NODES}.`,
      { limit: MAX_TREE_NODES, total },
    );
  }
}

function knownCriteria(doc: Y.Doc): string[] {
  return Array.from(getCriteria(doc).keys()).sort();
}

/** Validate criterion ids and normalize values (null = unset). */
function normalizeValues(
  doc: Y.Doc,
  values: Record<string, ValueInput | null> | undefined,
  estimatedBy: EstimatedBy | undefined,
  path = 'values',
): Record<string, NodeValue | null> {
  const out: Record<string, NodeValue | null> = {};
  if (!values) return out;
  const criteria = getCriteria(doc);
  for (const [cid, v] of Object.entries(values)) {
    if (!criteria.has(cid)) {
      throw new DocError('CRITERION_NOT_FOUND', `Unknown criterion "${cid}" (${path}). Known criteria: ${knownCriteria(doc).join(', ') || 'none'}.`, {
        criterionId: cid,
        known: knownCriteria(doc),
        path,
      });
    }
    out[cid] = v === null ? null : normalizeValue(v, estimatedBy);
  }
  return out;
}

function presentValues(values: Record<string, NodeValue | null>): Record<string, NodeValue> {
  const out: Record<string, NodeValue> = {};
  for (const [k, v] of Object.entries(values)) if (v !== null) out[k] = v;
  return out;
}

/** A leaf receiving children becomes an AND node; returns the command that undoes it. */
function promoteIfLeaf(parentMap: NodeMap, parentId: string): Command[] {
  if (parentMap.get('kind') === 'leaf') {
    parentMap.set('kind', 'and');
    return [{ type: 'setKind', nodeId: parentId, kind: 'leaf' }];
  }
  return [];
}

function uniq(ids: string[]): string[] {
  return Array.from(new Set(ids));
}

// ---------------------------------------------------------------------------
// title
// ---------------------------------------------------------------------------

export function setTitle(doc: Y.Doc, title: string, origin: Origin = 'local'): CommandResult<{ title: string }> {
  requireInit(doc);
  const meta = getMeta(doc);
  const old = typeof meta.get('title') === 'string' ? (meta.get('title') as string) : '';
  doc.transact(() => meta.set('title', title), origin);
  return { result: { title }, inverse: [{ type: 'setTitle', title: old }], affectedNodeIds: [] };
}

// ---------------------------------------------------------------------------
// node creation
// ---------------------------------------------------------------------------

export interface AddChildInput {
  parentId: string;
  node: NodeInit;
  id?: string;
  position?: Position;
  index?: number;
  estimatedBy?: EstimatedBy;
}

export function addChild(doc: Y.Doc, input: AddChildInput, origin: Origin = 'local'): CommandResult<{ id: string }> {
  requireInit(doc);
  const parentMap = requireNodeMap(doc, input.parentId);
  assertCapacity(doc, 1);
  const nodes = getNodes(doc);
  const id = input.id && !nodes.has(input.id) ? input.id : newId();
  const values = presentValues(normalizeValues(doc, input.node.values, input.estimatedBy));
  const keys = childrenOf(doc, input.parentId).map((n) => n.orderKey);
  const index = input.index ?? (input.position === 'first' ? 0 : keys.length);
  const orderKey = keyForIndex(keys, index);
  let inverse: Command[] = [];
  doc.transact(() => {
    nodes.set(
      id,
      makeNodeMap({
        id,
        parentId: input.parentId,
        orderKey,
        label: input.node.label,
        kind: input.node.kind ?? 'leaf',
        optional: input.node.optional,
        notes: input.node.notes,
        values,
      }),
    );
    inverse = [{ type: 'remove', nodeId: id }, ...promoteIfLeaf(parentMap, input.parentId)];
  }, origin);
  return { result: { id }, inverse, affectedNodeIds: [id, input.parentId] };
}

export interface AddSiblingInput {
  siblingId: string;
  node: NodeInit;
  id?: string;
  where?: 'before' | 'after';
  estimatedBy?: EstimatedBy;
}

export function addSibling(doc: Y.Doc, input: AddSiblingInput, origin: Origin = 'local'): CommandResult<{ id: string }> {
  const rootId = requireInit(doc);
  const sibling = requireNode(doc, input.siblingId);
  if (sibling.id === rootId) throw new DocError('ROOT_IMMUTABLE', 'The root node cannot have siblings.', { nodeId: rootId });
  const parentId = sibling.parentId !== null && getNodes(doc).has(sibling.parentId) ? sibling.parentId : rootId;
  const siblings = childrenOf(doc, parentId);
  const at = siblings.findIndex((n) => n.id === sibling.id);
  const index = at < 0 ? siblings.length : input.where === 'before' ? at : at + 1;
  return addChild(doc, { parentId, node: input.node, id: input.id, index, estimatedBy: input.estimatedBy }, origin);
}

export interface AddSubtreeInput {
  parentId: string;
  subtree: NodeJson;
  position?: Position;
  index?: number;
  estimatedBy?: EstimatedBy;
}

export interface AddSubtreeResult {
  /** Id of the top node of the inserted branch. */
  id: string;
  /** Every created node id, parents first. */
  nodeIds: string[];
  /** Requested id → actual id, for ids that were already taken. */
  idMap: Record<string, string>;
}

/** Insert a whole branch (nested JSON) under a parent, in one transaction. */
export function addSubtree(doc: Y.Doc, input: AddSubtreeInput, origin: Origin = 'local'): CommandResult<AddSubtreeResult> {
  requireInit(doc);
  const parentMap = requireNodeMap(doc, input.parentId);
  const nodes = getNodes(doc);
  const used = new Set<string>(nodes.keys());
  const idMap: Record<string, string> = {};
  const nodeIds: string[] = [];
  const plan: NodeFields[] = [];

  const assign = (given: string | undefined): string => {
    if (given && !used.has(given)) {
      used.add(given);
      return given;
    }
    const id = newId();
    used.add(id);
    if (given) idMap[given] = id;
    return id;
  };
  const build = (json: NodeJson, parentId: string, orderKey: string, path: string): void => {
    const id = assign(json.id);
    const kids = json.children ?? [];
    const kind: NodeKind = json.kind ?? (kids.length > 0 ? 'and' : 'leaf');
    plan.push({
      id,
      parentId,
      orderKey,
      label: json.label,
      kind,
      optional: json.optional,
      notes: json.notes,
      values: presentValues(normalizeValues(doc, json.values, input.estimatedBy, `${path}.values`)),
    });
    nodeIds.push(id);
    const keys = generateNKeysBetween(null, null, kids.length);
    kids.forEach((k, i) => build(k, id, keys[i]!, `${path}.children[${i}]`));
  };

  const siblingKeys = childrenOf(doc, input.parentId).map((n) => n.orderKey);
  const index = input.index ?? (input.position === 'first' ? 0 : siblingKeys.length);
  build(input.subtree, input.parentId, keyForIndex(siblingKeys, index), 'subtree');
  assertCapacity(doc, plan.length);

  let inverse: Command[] = [];
  doc.transact(() => {
    for (const fields of plan) nodes.set(fields.id, makeNodeMap(fields));
    inverse = [{ type: 'remove', nodeId: plan[0]!.id }, ...promoteIfLeaf(parentMap, input.parentId)];
  }, origin);
  return {
    result: { id: plan[0]!.id, nodeIds, idMap },
    inverse,
    affectedNodeIds: [...nodeIds, input.parentId],
  };
}

export interface RestoreNodesResult {
  restoredIds: string[];
  skippedIds: string[];
}

/** Re-create nodes exactly as given (inverse of `remove`). Existing ids are skipped. */
export function restoreNodes(doc: Y.Doc, input: { nodes: TreeNode[] }, origin: Origin = 'local'): CommandResult<RestoreNodesResult> {
  const rootId = requireInit(doc);
  const nodes = getNodes(doc);
  assertCapacity(doc, input.nodes.length);
  const batch = new Set(input.nodes.map((n) => n.id));
  const restoredIds: string[] = [];
  const skippedIds: string[] = [];
  doc.transact(() => {
    for (const n of input.nodes) {
      if (nodes.has(n.id)) {
        skippedIds.push(n.id);
        continue;
      }
      let parentId = n.parentId;
      if (parentId === null || parentId === n.id || (!nodes.has(parentId) && !batch.has(parentId))) parentId = rootId;
      nodes.set(n.id, makeNodeMap({ ...n, parentId, values: n.values }));
      restoredIds.push(n.id);
    }
  }, origin);
  const restoredSet = new Set(restoredIds);
  const tops = input.nodes.filter((n) => restoredSet.has(n.id) && (n.parentId === null || !restoredSet.has(n.parentId)));
  return {
    result: { restoredIds, skippedIds },
    inverse: tops.map((n) => ({ type: 'remove', nodeId: n.id })),
    affectedNodeIds: restoredIds,
  };
}

// ---------------------------------------------------------------------------
// move / remove
// ---------------------------------------------------------------------------

export interface MoveInput {
  nodeId: string;
  parentId: string;
  index?: number;
}

function assertMovable(doc: Y.Doc, nodeId: string, parentId: string): { rootId: string; node: TreeNode } {
  const rootId = requireInit(doc);
  if (nodeId === rootId) throw new DocError('ROOT_IMMUTABLE', 'The root node cannot be moved.', { nodeId });
  requireNodeMap(doc, nodeId);
  requireNodeMap(doc, parentId);
  if (parentId === nodeId) throw new DocError('INVALID_MOVE', 'A node cannot be its own parent.', { nodeId, parentId });
  const tree = buildSnapshot(doc);
  if (isAncestor(tree, nodeId, parentId)) {
    throw new DocError('INVALID_MOVE', `Cannot move "${nodeId}" under "${parentId}": it is one of its descendants.`, { nodeId, parentId });
  }
  return { rootId, node: tree.nodes[nodeId]! };
}

export function move(doc: Y.Doc, input: MoveInput, origin: Origin = 'local'): CommandResult<{ orderKey: string }> {
  const { rootId, node } = assertMovable(doc, input.nodeId, input.parentId);
  const keys = childrenOf(doc, input.parentId)
    .filter((n) => n.id !== input.nodeId)
    .map((n) => n.orderKey);
  const orderKey = keyForIndex(keys, input.index ?? keys.length);
  return placeAt(doc, { nodeId: input.nodeId, parentId: input.parentId, orderKey }, origin, { rootId, node });
}

export interface PlaceAtInput {
  nodeId: string;
  parentId: string;
  orderKey: string;
}

/** Low-level move with an explicit order key (used by inverses). */
export function placeAt(
  doc: Y.Doc,
  input: PlaceAtInput,
  origin: Origin = 'local',
  checked?: { rootId: string; node: TreeNode },
): CommandResult<{ orderKey: string }> {
  const { rootId, node } = checked ?? assertMovable(doc, input.nodeId, input.parentId);
  const nodeMap = requireNodeMap(doc, input.nodeId);
  const parentMap = requireNodeMap(doc, input.parentId);
  const oldParent = node.parentId ?? rootId;
  const oldKey = node.orderKey;
  let inverse: Command[] = [];
  doc.transact(() => {
    nodeMap.set('parentId', input.parentId);
    nodeMap.set('orderKey', input.orderKey);
    inverse = [
      { type: 'placeAt', nodeId: input.nodeId, parentId: oldParent, orderKey: oldKey },
      ...promoteIfLeaf(parentMap, input.parentId),
    ];
  }, origin);
  return {
    result: { orderKey: input.orderKey },
    inverse,
    affectedNodeIds: uniq([input.nodeId, oldParent, input.parentId]),
  };
}

export function remove(doc: Y.Doc, input: { nodeId: string }, origin: Origin = 'local'): CommandResult<{ removedIds: string[] }> {
  const rootId = requireInit(doc);
  if (input.nodeId === rootId) throw new DocError('ROOT_IMMUTABLE', 'The root node cannot be removed.', { nodeId: rootId });
  requireNodeMap(doc, input.nodeId);
  const tree = buildSnapshot(doc);
  const ids = subtreeIds(tree, input.nodeId);
  const removed = ids.map((id) => tree.nodes[id]!);
  const nodes = getNodes(doc);
  doc.transact(() => {
    for (const id of ids) nodes.delete(id);
  }, origin);
  const parentId = removed[0]?.parentId ?? rootId;
  return {
    result: { removedIds: ids },
    inverse: [{ type: 'restoreNodes', nodes: removed }],
    affectedNodeIds: uniq([...ids, parentId]),
  };
}

// ---------------------------------------------------------------------------
// node fields
// ---------------------------------------------------------------------------

export function setKind(doc: Y.Doc, input: { nodeId: string; kind: NodeKind }, origin: Origin = 'local'): CommandResult<{ kind: NodeKind }> {
  requireInit(doc);
  const node = requireNode(doc, input.nodeId);
  if (input.kind === 'leaf' && childrenOf(doc, input.nodeId).length > 0) {
    throw new DocError('HAS_CHILDREN', `"${node.label}" still has children; remove or move them before making it a leaf.`, { nodeId: input.nodeId });
  }
  const map = requireNodeMap(doc, input.nodeId);
  doc.transact(() => map.set('kind', input.kind), origin);
  return { result: { kind: input.kind }, inverse: [{ type: 'setKind', nodeId: input.nodeId, kind: node.kind }], affectedNodeIds: [input.nodeId] };
}

export function rename(doc: Y.Doc, input: { nodeId: string; label: string }, origin: Origin = 'local'): CommandResult<{ label: string }> {
  requireInit(doc);
  const node = requireNode(doc, input.nodeId);
  const map = requireNodeMap(doc, input.nodeId);
  doc.transact(() => map.set('label', input.label), origin);
  return { result: { label: input.label }, inverse: [{ type: 'rename', nodeId: input.nodeId, label: node.label }], affectedNodeIds: [input.nodeId] };
}

export function setNotes(doc: Y.Doc, input: { nodeId: string; notes: string | null }, origin: Origin = 'local'): CommandResult<{ notes: string | null }> {
  requireInit(doc);
  const node = requireNode(doc, input.nodeId);
  const map = requireNodeMap(doc, input.nodeId);
  doc.transact(() => {
    if (input.notes === null || input.notes === '') map.delete('notes');
    else map.set('notes', input.notes);
  }, origin);
  return {
    result: { notes: input.notes },
    inverse: [{ type: 'setNotes', nodeId: input.nodeId, notes: node.notes ?? null }],
    affectedNodeIds: [input.nodeId],
  };
}

export function setOptional(doc: Y.Doc, input: { nodeId: string; optional: boolean }, origin: Origin = 'local'): CommandResult<{ optional: boolean }> {
  const rootId = requireInit(doc);
  if (input.nodeId === rootId) throw new DocError('ROOT_IMMUTABLE', 'The root node cannot be optional.', { nodeId: rootId });
  const node = requireNode(doc, input.nodeId);
  const map = requireNodeMap(doc, input.nodeId);
  doc.transact(() => {
    if (input.optional) map.set('optional', true);
    else map.delete('optional');
  }, origin);
  return {
    result: { optional: input.optional },
    inverse: [{ type: 'setOptional', nodeId: input.nodeId, optional: node.optional === true }],
    affectedNodeIds: [input.nodeId],
  };
}

export interface SetValuesInput {
  nodeId: string;
  values: Record<string, ValueInput | null>;
  estimatedBy?: EstimatedBy;
}

export function setValues(doc: Y.Doc, input: SetValuesInput, origin: Origin = 'local'): CommandResult<{ values: Record<string, NodeValue> }> {
  requireInit(doc);
  const node = requireNode(doc, input.nodeId);
  const map = requireNodeMap(doc, input.nodeId);
  const normalized = normalizeValues(doc, input.values, input.estimatedBy);
  const previous: Record<string, NodeValue | null> = {};
  for (const cid of Object.keys(normalized)) previous[cid] = node.values[cid] ?? null;
  doc.transact(() => {
    let values = getValuesMap(map);
    if (!values) {
      values = new Yjs.Map<NodeValue>();
      map.set('values', values);
    }
    for (const [cid, v] of Object.entries(normalized)) {
      if (v === null) values.delete(cid);
      else values.set(cid, cleanValue(v));
    }
  }, origin);
  return {
    result: { values: { ...node.values, ...presentValues(normalized) } },
    inverse: [{ type: 'setValues', nodeId: input.nodeId, values: previous }],
    affectedNodeIds: [input.nodeId],
  };
}

// ---------------------------------------------------------------------------
// criteria
// ---------------------------------------------------------------------------

export function addCriterion(doc: Y.Doc, input: { criterion: CriterionInit }, origin: Origin = 'local'): CommandResult<{ id: string; criterion: Criterion }> {
  requireInit(doc);
  const criteria = getCriteria(doc);
  const init = input.criterion;
  let id: string;
  if (init.id !== undefined) {
    if (criteria.has(init.id)) throw new DocError('CRITERION_EXISTS', `Criterion "${init.id}" already exists.`, { criterionId: init.id });
    id = init.id;
  } else {
    const base = slugify(init.label);
    id = base;
    let n = 2;
    while (criteria.has(id)) id = `${base}-${n++}`;
  }
  let maxOrder = -1;
  criteria.forEach((map, key) => {
    const c = readCriterion(map, key);
    if (c && c.order > maxOrder) maxOrder = c.order;
  });
  const criterion: Criterion = {
    id,
    label: init.label,
    aggregation: init.aggregation ?? 'sum',
    direction: init.direction ?? 'minimize',
    order: init.order ?? maxOrder + 1,
  };
  if (init.unit !== undefined && init.unit !== '') criterion.unit = init.unit;
  doc.transact(() => criteria.set(id, makeCriterionMap(criterion)), origin);
  return { result: { id, criterion }, inverse: [{ type: 'removeCriterion', criterionId: id }], affectedNodeIds: [] };
}

function requireCriterion(doc: Y.Doc, criterionId: string): { map: Y.Map<unknown>; criterion: Criterion } {
  const map = getCriteria(doc).get(criterionId);
  const criterion = map ? readCriterion(map, criterionId) : null;
  if (!map || !criterion) {
    throw new DocError('CRITERION_NOT_FOUND', `Unknown criterion "${criterionId}". Known criteria: ${knownCriteria(doc).join(', ') || 'none'}.`, {
      criterionId,
      known: knownCriteria(doc),
    });
  }
  return { map, criterion };
}

export function updateCriterion(doc: Y.Doc, input: { criterionId: string; patch: CriterionPatch }, origin: Origin = 'local'): CommandResult<{ criterion: Criterion }> {
  requireInit(doc);
  const { map, criterion: old } = requireCriterion(doc, input.criterionId);
  const patch = input.patch;
  const inversePatch: CriterionPatch = {};
  doc.transact(() => {
    if (patch.label !== undefined) {
      map.set('label', patch.label);
      inversePatch.label = old.label;
    }
    if (patch.unit !== undefined) {
      if (patch.unit === null || patch.unit === '') map.delete('unit');
      else map.set('unit', patch.unit);
      inversePatch.unit = old.unit ?? null;
    }
    if (patch.aggregation !== undefined) {
      map.set('aggregation', patch.aggregation);
      inversePatch.aggregation = old.aggregation;
    }
    if (patch.direction !== undefined) {
      map.set('direction', patch.direction);
      inversePatch.direction = old.direction;
    }
    if (patch.order !== undefined) {
      map.set('order', patch.order);
      inversePatch.order = old.order;
    }
  }, origin);
  const criterion = readCriterion(map, input.criterionId) ?? old;
  return { result: { criterion }, inverse: [{ type: 'updateCriterion', criterionId: input.criterionId, patch: inversePatch }], affectedNodeIds: [] };
}

export function removeCriterion(doc: Y.Doc, input: { criterionId: string }, origin: Origin = 'local'): CommandResult<{ criterion: Criterion; affectedNodes: number }> {
  requireInit(doc);
  const { criterion } = requireCriterion(doc, input.criterionId);
  const values: Record<string, NodeValue> = {};
  const touched: string[] = [];
  getNodes(doc).forEach((map, key) => {
    const n = readNode(map, key);
    const v = n?.values[input.criterionId];
    if (n && v) {
      values[n.id] = v;
      touched.push(n.id);
    }
  });
  doc.transact(() => {
    getCriteria(doc).delete(input.criterionId);
    for (const nodeId of touched) getValuesMap(getNodes(doc).get(nodeId)!)?.delete(input.criterionId);
  }, origin);
  return {
    result: { criterion, affectedNodes: touched.length },
    inverse: [{ type: 'restoreCriterion', criterion, values }],
    affectedNodeIds: touched,
  };
}

export function restoreCriterion(doc: Y.Doc, input: { criterion: Criterion; values: Record<string, NodeValue> }, origin: Origin = 'local'): CommandResult<{ id: string }> {
  requireInit(doc);
  const criteria = getCriteria(doc);
  const nodes = getNodes(doc);
  const touched: string[] = [];
  doc.transact(() => {
    criteria.set(input.criterion.id, makeCriterionMap(input.criterion));
    for (const [nodeId, v] of Object.entries(input.values)) {
      const map = nodes.get(nodeId);
      if (!map) continue;
      let values = getValuesMap(map);
      if (!values) {
        values = new Yjs.Map<NodeValue>();
        map.set('values', values);
      }
      values.set(input.criterion.id, cleanValue(v));
      touched.push(nodeId);
    }
  }, origin);
  return { result: { id: input.criterion.id }, inverse: [{ type: 'removeCriterion', criterionId: input.criterion.id }], affectedNodeIds: touched };
}

// ---------------------------------------------------------------------------
// dispatcher
// ---------------------------------------------------------------------------

export function parseCommand(input: unknown): Command {
  const parsed = CommandSchema.safeParse(input);
  if (!parsed.success) {
    throw new DocError('VALIDATION', `Invalid command: ${parsed.error.issues.map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`).join('; ')}`, parsed.error.issues);
  }
  return parsed.data;
}

/** Apply one serializable command (validated with Zod). */
export function applyCommand(doc: Y.Doc, input: unknown, origin: Origin = 'local'): CommandResult {
  const command = parseCommand(input);
  switch (command.type) {
    case 'setTitle':
      return setTitle(doc, command.title, origin);
    case 'addChild':
      return addChild(doc, command, origin);
    case 'addSibling':
      return addSibling(doc, command, origin);
    case 'addSubtree':
      return addSubtree(doc, command, origin);
    case 'restoreNodes':
      return restoreNodes(doc, command, origin);
    case 'move':
      return move(doc, command, origin);
    case 'placeAt':
      return placeAt(doc, command, origin);
    case 'remove':
      return remove(doc, command, origin);
    case 'setKind':
      return setKind(doc, command, origin);
    case 'rename':
      return rename(doc, command, origin);
    case 'setNotes':
      return setNotes(doc, command, origin);
    case 'setOptional':
      return setOptional(doc, command, origin);
    case 'setValues':
      return setValues(doc, command, origin);
    case 'addCriterion':
      return addCriterion(doc, command, origin);
    case 'updateCriterion':
      return updateCriterion(doc, command, origin);
    case 'removeCriterion':
      return removeCriterion(doc, command, origin);
    case 'restoreCriterion':
      return restoreCriterion(doc, command, origin);
  }
}

export interface BatchResult {
  results: CommandResult[];
  /** Commands that undo the whole batch (already in the right order). */
  inverse: Command[];
  affectedNodeIds: string[];
}

/**
 * Apply several commands in ONE transaction. Yjs cannot roll a transaction back, so when a
 * command fails the inverses of the commands already applied are run before rethrowing:
 * the batch is atomic from the point of view of other clients.
 */
export function applyCommands(doc: Y.Doc, inputs: unknown[], origin: Origin = 'local'): BatchResult {
  const commands = inputs.map(parseCommand);
  const results: CommandResult[] = [];
  doc.transact(() => {
    try {
      for (const command of commands) results.push(applyCommand(doc, command, origin));
    } catch (error) {
      for (const r of [...results].reverse()) {
        for (const inv of r.inverse) applyCommand(doc, inv, origin);
      }
      throw error;
    }
  }, origin);
  const inverse: Command[] = [];
  for (const r of [...results].reverse()) inverse.push(...r.inverse);
  return { results, inverse, affectedNodeIds: uniq(results.flatMap((r) => r.affectedNodeIds)) };
}
