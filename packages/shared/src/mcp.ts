import { z } from 'zod';
import {
  AggregationSchema,
  CriterionInitSchema,
  DirectionSchema,
  IdSchema,
  LabelSchema,
  NodeJsonSchema,
  NodeKindSchema,
  NotesSchema,
  TreeJsonSchema,
  ValuesInputSchema,
} from './tree';
import { PositionSchema } from './commands';

/**
 * Input shapes of the MCP tools. Kept as raw shapes so that `McpServer.registerTool`
 * can turn them into JSON Schema; `z.object(shape)` gives the full schema when needed.
 */

const treeId = IdSchema.describe('Identifier of the tree (as returned by list_trees / create_tree).');
const nodeId = IdSchema.describe('Identifier of a node (as returned by get_tree or by the tool that created it).');

export const ListTreesToolInput = {};

export const CreateTreeToolInput = {
  title: z.string().min(1).max(200).describe('Title of the new tree, e.g. "Ajouter le paiement en ligne".'),
  criteria: z
    .array(CriterionInitSchema)
    .optional()
    .describe(
      'Criteria to create. `aggregation`: sum | max | min | probOr (probOr = 1 − Π(1 − pᵢ), for risks in [0,1]). `direction`: minimize | maximize. Example: [{ "id": "cost", "label": "Coût mensuel", "unit": "€", "aggregation": "sum", "direction": "minimize" }].',
    ),
  root: NodeJsonSchema.optional().describe(
    'Optional whole tree as a nested structure (same format as build_subtree). Its label becomes the root label. When omitted an empty root AND node is created with the title as label.',
  ),
};

export const GetTreeToolInput = {
  treeId,
  includeAggregates: z
    .boolean()
    .optional()
    .describe('Include per-node aggregates and [min, max] ranges of OR nodes (default true).'),
};

export const BuildSubtreeToolInput = {
  treeId,
  parentId: nodeId.describe('Node under which the branch is inserted (use the root id to add a top-level branch).'),
  subtree: NodeJsonSchema.describe(
    'Nested branch. Each node: { label, kind?: "and"|"or"|"leaf", optional?, notes?, values?: { [criterionId]: number }, children?: [...] }. `kind` defaults to "and" when there are children and "leaf" otherwise. `or` = exactly one child is chosen; `and` = all children are required; `optional: true` on a child of an AND node makes it includable or not. Values use the criterion ids of the tree. All values written through MCP are flagged as AI estimates.',
  ),
  position: PositionSchema.optional().describe('Insert as first or last child (default last).'),
};

export const AddNodeToolInput = {
  treeId,
  parentId: nodeId,
  label: LabelSchema.describe('Label of the node.'),
  kind: NodeKindSchema.optional().describe('and | or | leaf (default leaf).'),
  optional: z.boolean().optional().describe('Only meaningful for a child of an AND node.'),
  notes: NotesSchema.optional(),
  values: ValuesInputSchema.optional().describe('Values per criterion id, e.g. { "cost": 25, "dev": 5 }.'),
  position: PositionSchema.optional(),
};

export const UpdateNodeToolInput = {
  treeId,
  nodeId,
  label: LabelSchema.optional(),
  kind: NodeKindSchema.optional().describe('Changing to "leaf" is refused while the node has children.'),
  optional: z.boolean().optional(),
  notes: NotesSchema.nullable().optional().describe('`null` clears the notes.'),
};

export const MoveNodeToolInput = {
  treeId,
  nodeId,
  newParentId: nodeId.describe('Destination parent. Must not be the node itself or one of its descendants.'),
  index: z.number().int().nonnegative().optional().describe('Position among the new siblings (default: last).'),
};

export const DeleteNodeToolInput = {
  treeId,
  nodeId,
  confirm: z
    .boolean()
    .optional()
    .describe('Required (true) when the branch holds more than a few nodes. The error message tells you when it is needed.'),
};

export const SetValuesToolInput = {
  treeId,
  values: z
    .array(
      z.object({
        nodeId,
        criterionId: IdSchema,
        value: z.number().nullable().describe('`null` removes the value.'),
      }),
    )
    .min(1)
    .max(500)
    .describe('Batch of values to set. All are flagged as AI estimates.'),
};

export const AddCriterionToolInput = {
  treeId,
  id: IdSchema.optional().describe('Short stable id, e.g. "cost". Generated from the label when omitted.'),
  label: z.string().min(1).max(200),
  unit: z.string().max(20).optional(),
  aggregation: AggregationSchema.optional().describe('sum (default) | max | min | probOr.'),
  direction: DirectionSchema.optional().describe('minimize (default) | maximize.'),
};

export const UpdateCriterionToolInput = {
  treeId,
  criterionId: IdSchema,
  label: z.string().min(1).max(200).optional(),
  unit: z.string().max(20).nullable().optional(),
  aggregation: AggregationSchema.optional(),
  direction: DirectionSchema.optional(),
};

export const ComputeConfigurationsToolInput = {
  treeId,
  topN: z.number().int().positive().max(50).optional().describe('How many best configurations to return per criterion (default 5).'),
  criterionId: IdSchema.optional().describe('When given, only rank by this criterion.'),
};

export const ExplainConfigurationToolInput = {
  treeId,
  choices: z
    .record(IdSchema, IdSchema)
    .describe('Chosen child per OR node: { [orNodeId]: childId }. Missing OR nodes default to their first child.'),
  included: z
    .record(IdSchema, z.boolean())
    .optional()
    .describe('Inclusion of optional nodes: { [nodeId]: true|false }. Missing optional nodes default to included.'),
};

export const ExportTreeToolInput = { treeId };

export const ImportTreeToolInput = {
  tree: TreeJsonSchema.describe('A tree in the forkcast JSON format (as produced by export_tree).'),
  title: z.string().max(200).optional().describe('Overrides the title of the imported tree.'),
};

export const McpToolNames = [
  'list_trees',
  'create_tree',
  'get_tree',
  'build_subtree',
  'add_node',
  'update_node',
  'move_node',
  'delete_node',
  'set_values',
  'add_criterion',
  'update_criterion',
  'compute_configurations',
  'explain_configuration',
  'export_tree',
  'import_tree',
] as const;
export type McpToolName = (typeof McpToolNames)[number];
