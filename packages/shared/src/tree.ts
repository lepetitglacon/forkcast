import { z } from 'zod';

export const AGGREGATIONS = ['sum', 'max', 'min', 'probOr'] as const;
export const DIRECTIONS = ['minimize', 'maximize'] as const;
export const NODE_KINDS = ['and', 'or', 'leaf'] as const;
export const ESTIMATED_BY = ['ai'] as const;

export const AggregationSchema = z.enum(AGGREGATIONS);
export const DirectionSchema = z.enum(DIRECTIONS);
export const NodeKindSchema = z.enum(NODE_KINDS);
export const EstimatedBySchema = z.enum(ESTIMATED_BY);

export type Aggregation = z.infer<typeof AggregationSchema>;
export type Direction = z.infer<typeof DirectionSchema>;
export type NodeKind = z.infer<typeof NodeKindSchema>;
export type EstimatedBy = z.infer<typeof EstimatedBySchema>;

/** Identifiers are client-generated (nanoid) or user-provided slugs; never numeric increments. */
export const IdSchema = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[A-Za-z0-9_-]+$/, 'ids may only contain letters, digits, "_" and "-"');

export const LabelSchema = z.string().max(500);
export const NotesSchema = z.string().max(10_000);

// ---------------------------------------------------------------------------
// Criteria
// ---------------------------------------------------------------------------

export const CriterionSchema = z.object({
  id: IdSchema,
  label: z.string().min(1).max(200),
  unit: z.string().max(20).optional(),
  aggregation: AggregationSchema,
  direction: DirectionSchema,
  order: z.number(),
});
export type Criterion = z.infer<typeof CriterionSchema>;

/** Input accepted when creating a criterion: id/order/aggregation/direction are optional. */
export const CriterionInitSchema = z.object({
  id: IdSchema.optional(),
  label: z.string().min(1).max(200),
  unit: z.string().max(20).optional(),
  aggregation: AggregationSchema.optional(),
  direction: DirectionSchema.optional(),
  order: z.number().optional(),
});
export type CriterionInit = z.infer<typeof CriterionInitSchema>;

export const CriterionPatchSchema = z.object({
  label: z.string().min(1).max(200).optional(),
  /** `null` removes the unit. */
  unit: z.string().max(20).nullable().optional(),
  aggregation: AggregationSchema.optional(),
  direction: DirectionSchema.optional(),
  order: z.number().optional(),
});
export type CriterionPatch = z.infer<typeof CriterionPatchSchema>;

// ---------------------------------------------------------------------------
// Values
// ---------------------------------------------------------------------------

/** A value carried by a node for one criterion. `estimatedBy: 'ai'` flags assistant estimates. */
export const NodeValueSchema = z.object({
  value: z.number(),
  estimatedBy: EstimatedBySchema.optional(),
});
export type NodeValue = z.infer<typeof NodeValueSchema>;

/** Values may be given as bare numbers (JSON, tools) or as full objects. */
export const ValueInputSchema = z.union([z.number(), NodeValueSchema]);
export type ValueInput = z.infer<typeof ValueInputSchema>;
export const ValuesInputSchema = z.record(IdSchema, ValueInputSchema);
export type ValuesInput = z.infer<typeof ValuesInputSchema>;

export function normalizeValue(input: ValueInput, estimatedBy?: EstimatedBy): NodeValue {
  const base: NodeValue = typeof input === 'number' ? { value: input } : { ...input };
  if (estimatedBy && !base.estimatedBy) base.estimatedBy = estimatedBy;
  if (base.estimatedBy === undefined) delete base.estimatedBy;
  return base;
}

// ---------------------------------------------------------------------------
// Snapshot (immutable, derived from the Y.Doc)
// ---------------------------------------------------------------------------

export const TreeNodeSchema = z.object({
  id: IdSchema,
  parentId: IdSchema.nullable(),
  orderKey: z.string(),
  label: LabelSchema,
  notes: NotesSchema.optional(),
  kind: NodeKindSchema,
  optional: z.boolean().optional(),
  values: z.record(IdSchema, NodeValueSchema),
});
export type TreeNode = z.infer<typeof TreeNodeSchema>;

export interface TreeMeta {
  schemaVersion: number;
  title: string;
  rootId: string;
}

/** Immutable snapshot of a tree, the only structure the engine and the UI read. */
export interface Tree {
  meta: TreeMeta;
  /** Sorted by `order` then `id`. */
  criteria: Criterion[];
  nodes: Record<string, TreeNode>;
  /** Children ids per node, sorted by `orderKey` then `id`. Every node has an entry. */
  children: Record<string, string[]>;
}

// ---------------------------------------------------------------------------
// Node creation inputs & nested JSON (import/export, build_subtree)
// ---------------------------------------------------------------------------

export const NodeInitSchema = z.object({
  label: LabelSchema,
  kind: NodeKindSchema.optional(),
  optional: z.boolean().optional(),
  notes: NotesSchema.optional(),
  values: ValuesInputSchema.optional(),
});
export type NodeInit = z.infer<typeof NodeInitSchema>;

export interface NodeJson {
  id?: string;
  label: string;
  /** Defaults to `and` when the node has children, `leaf` otherwise. */
  kind?: NodeKind;
  optional?: boolean;
  notes?: string;
  values?: Record<string, ValueInput>;
  children?: NodeJson[];
}

export const NodeJsonSchema: z.ZodType<NodeJson> = z.lazy(() =>
  z.object({
    id: IdSchema.optional(),
    label: LabelSchema,
    kind: NodeKindSchema.optional(),
    optional: z.boolean().optional(),
    notes: NotesSchema.optional(),
    values: ValuesInputSchema.optional(),
    children: z.array(NodeJsonSchema).optional(),
  }),
);

export const TREE_JSON_FORMAT = 'forkcast-tree' as const;
export const TREE_JSON_VERSION = 1 as const;

export const TreeJsonSchema = z.object({
  format: z.literal(TREE_JSON_FORMAT),
  version: z.literal(TREE_JSON_VERSION),
  title: z.string().max(200),
  criteria: z.array(CriterionInitSchema),
  root: NodeJsonSchema,
});
export type TreeJson = z.infer<typeof TreeJsonSchema>;

export function countJsonNodes(node: NodeJson): number {
  let n = 1;
  for (const child of node.children ?? []) n += countJsonNodes(child);
  return n;
}
