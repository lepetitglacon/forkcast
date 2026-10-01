import type * as Y from 'yjs';
import type { ActivityEntry } from '@forkcast/shared';

export const SCHEMA_VERSION = 1;

export const Y_META = 'meta';
export const Y_CRITERIA = 'criteria';
export const Y_NODES = 'nodes';
export const Y_ACTIVITY = 'activity';

/** Origin of a Yjs transaction. Only `local` transactions are undoable in the UI. */
export type Origin = 'local' | 'mcp' | 'import' | 'system';

export type NodeMap = Y.Map<unknown>;
export type CriterionMap = Y.Map<unknown>;

export const getMeta = (doc: Y.Doc): Y.Map<unknown> => doc.getMap<unknown>(Y_META);
export const getNodes = (doc: Y.Doc): Y.Map<NodeMap> => doc.getMap<NodeMap>(Y_NODES);
export const getCriteria = (doc: Y.Doc): Y.Map<CriterionMap> => doc.getMap<CriterionMap>(Y_CRITERIA);
export const getActivity = (doc: Y.Doc): Y.Array<ActivityEntry> => doc.getArray<ActivityEntry>(Y_ACTIVITY);

/** Fields of a node Y.Map. `values` is a nested Y.Map<criterionId, NodeValue>. */
export const NODE_FIELDS = {
  id: 'id',
  parentId: 'parentId',
  orderKey: 'orderKey',
  label: 'label',
  notes: 'notes',
  kind: 'kind',
  optional: 'optional',
  values: 'values',
} as const;
