import * as Y from 'yjs';
import {
  NODE_KINDS,
  type NodeKind,
  type NodeValue,
  type TreeNode,
  type Criterion,
  AGGREGATIONS,
  DIRECTIONS,
} from '@forkcast/shared';
import type { CriterionMap, NodeMap } from './schema';

export interface NodeFields {
  id: string;
  parentId: string | null;
  orderKey: string;
  label: string;
  notes?: string;
  kind: NodeKind;
  optional?: boolean;
  values: Record<string, NodeValue>;
}

export function makeNodeMap(fields: NodeFields): NodeMap {
  const map: NodeMap = new Y.Map<unknown>();
  map.set('id', fields.id);
  map.set('parentId', fields.parentId);
  map.set('orderKey', fields.orderKey);
  map.set('label', fields.label);
  map.set('kind', fields.kind);
  if (fields.notes !== undefined && fields.notes !== '') map.set('notes', fields.notes);
  if (fields.optional) map.set('optional', true);
  const values = new Y.Map<NodeValue>();
  for (const [cid, v] of Object.entries(fields.values)) values.set(cid, cleanValue(v));
  map.set('values', values);
  return map;
}

export function cleanValue(v: NodeValue): NodeValue {
  const out: NodeValue = { value: v.value };
  if (v.estimatedBy) out.estimatedBy = v.estimatedBy;
  return out;
}

function isNodeValue(v: unknown): v is NodeValue {
  return (
    typeof v === 'object' &&
    v !== null &&
    typeof (v as { value?: unknown }).value === 'number' &&
    Number.isFinite((v as { value: number }).value)
  );
}

export function getValuesMap(map: NodeMap): Y.Map<NodeValue> | undefined {
  const values = map.get('values');
  return values instanceof Y.Map ? (values as Y.Map<NodeValue>) : undefined;
}

/** Read a node Y.Map defensively; returns null when the entry is not usable. */
export function readNode(map: NodeMap | undefined, key?: string): TreeNode | null {
  if (!(map instanceof Y.Map)) return null;
  const id = map.get('id');
  if (typeof id !== 'string' || id.length === 0) return null;
  if (key !== undefined && key !== id) return null;
  const parentIdRaw = map.get('parentId');
  const parentId = typeof parentIdRaw === 'string' ? parentIdRaw : null;
  const orderKeyRaw = map.get('orderKey');
  const orderKey = typeof orderKeyRaw === 'string' ? orderKeyRaw : '';
  const labelRaw = map.get('label');
  const label = typeof labelRaw === 'string' ? labelRaw : '';
  const kindRaw = map.get('kind');
  const kind: NodeKind = (NODE_KINDS as readonly string[]).includes(kindRaw as string)
    ? (kindRaw as NodeKind)
    : 'leaf';
  const values: Record<string, NodeValue> = {};
  const valuesRaw = map.get('values');
  if (valuesRaw instanceof Y.Map) {
    valuesRaw.forEach((v, cid) => {
      if (isNodeValue(v)) values[cid] = cleanValue(v);
      else if (typeof v === 'number' && Number.isFinite(v)) values[cid] = { value: v };
    });
  } else if (typeof valuesRaw === 'object' && valuesRaw !== null) {
    for (const [cid, v] of Object.entries(valuesRaw as Record<string, unknown>)) {
      if (isNodeValue(v)) values[cid] = cleanValue(v);
      else if (typeof v === 'number' && Number.isFinite(v)) values[cid] = { value: v };
    }
  }
  const node: TreeNode = { id, parentId, orderKey, label, kind, values };
  const notes = map.get('notes');
  if (typeof notes === 'string' && notes.length > 0) node.notes = notes;
  if (map.get('optional') === true) node.optional = true;
  return node;
}

export function makeCriterionMap(criterion: Criterion): CriterionMap {
  const map: CriterionMap = new Y.Map<unknown>();
  map.set('id', criterion.id);
  map.set('label', criterion.label);
  if (criterion.unit !== undefined && criterion.unit !== '') map.set('unit', criterion.unit);
  map.set('aggregation', criterion.aggregation);
  map.set('direction', criterion.direction);
  map.set('order', criterion.order);
  return map;
}

export function readCriterion(map: CriterionMap | undefined, key?: string): Criterion | null {
  if (!(map instanceof Y.Map)) return null;
  const id = map.get('id');
  if (typeof id !== 'string' || id.length === 0) return null;
  if (key !== undefined && key !== id) return null;
  const labelRaw = map.get('label');
  const aggregationRaw = map.get('aggregation');
  const directionRaw = map.get('direction');
  const orderRaw = map.get('order');
  const unitRaw = map.get('unit');
  const criterion: Criterion = {
    id,
    label: typeof labelRaw === 'string' && labelRaw.length > 0 ? labelRaw : id,
    aggregation: (AGGREGATIONS as readonly string[]).includes(aggregationRaw as string)
      ? (aggregationRaw as Criterion['aggregation'])
      : 'sum',
    direction: (DIRECTIONS as readonly string[]).includes(directionRaw as string)
      ? (directionRaw as Criterion['direction'])
      : 'minimize',
    order: typeof orderRaw === 'number' && Number.isFinite(orderRaw) ? orderRaw : 0,
  };
  if (typeof unitRaw === 'string' && unitRaw.length > 0) criterion.unit = unitRaw;
  return criterion;
}
