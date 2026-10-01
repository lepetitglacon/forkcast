import { z } from 'zod';
import {
  CriterionInitSchema,
  CriterionPatchSchema,
  CriterionSchema,
  EstimatedBySchema,
  IdSchema,
  LabelSchema,
  NodeInitSchema,
  NodeJsonSchema,
  NodeKindSchema,
  NodeValueSchema,
  NotesSchema,
  TreeNodeSchema,
  ValueInputSchema,
} from './tree';

export const PositionSchema = z.enum(['first', 'last']);
export type Position = z.infer<typeof PositionSchema>;

const IndexSchema = z.number().int().nonnegative();

/**
 * Serializable description of a write on a document. Every write goes through
 * `applyCommand` in `@forkcast/doc`; commands are also what the activity log stores
 * as inverses, so that assistant changes can be reverted from any client.
 */
export const CommandSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('setTitle'), title: z.string().max(200) }),
  z.object({
    type: z.literal('addChild'),
    parentId: IdSchema,
    node: NodeInitSchema,
    id: IdSchema.optional(),
    position: PositionSchema.optional(),
    index: IndexSchema.optional(),
    estimatedBy: EstimatedBySchema.optional(),
  }),
  z.object({
    type: z.literal('addSibling'),
    siblingId: IdSchema,
    node: NodeInitSchema,
    id: IdSchema.optional(),
    where: z.enum(['before', 'after']).optional(),
    estimatedBy: EstimatedBySchema.optional(),
  }),
  z.object({
    type: z.literal('addSubtree'),
    parentId: IdSchema,
    subtree: NodeJsonSchema,
    position: PositionSchema.optional(),
    index: IndexSchema.optional(),
    estimatedBy: EstimatedBySchema.optional(),
  }),
  z.object({ type: z.literal('restoreNodes'), nodes: z.array(TreeNodeSchema) }),
  z.object({
    type: z.literal('move'),
    nodeId: IdSchema,
    parentId: IdSchema,
    index: IndexSchema.optional(),
  }),
  z.object({
    type: z.literal('placeAt'),
    nodeId: IdSchema,
    parentId: IdSchema,
    orderKey: z.string(),
  }),
  z.object({ type: z.literal('remove'), nodeId: IdSchema }),
  z.object({ type: z.literal('setKind'), nodeId: IdSchema, kind: NodeKindSchema }),
  z.object({ type: z.literal('rename'), nodeId: IdSchema, label: LabelSchema }),
  z.object({ type: z.literal('setNotes'), nodeId: IdSchema, notes: NotesSchema.nullable() }),
  z.object({ type: z.literal('setOptional'), nodeId: IdSchema, optional: z.boolean() }),
  z.object({
    type: z.literal('setValues'),
    nodeId: IdSchema,
    /** `null` unsets the value for that criterion. */
    values: z.record(IdSchema, ValueInputSchema.nullable()),
    estimatedBy: EstimatedBySchema.optional(),
  }),
  z.object({ type: z.literal('addCriterion'), criterion: CriterionInitSchema }),
  z.object({
    type: z.literal('updateCriterion'),
    criterionId: IdSchema,
    patch: CriterionPatchSchema,
  }),
  z.object({ type: z.literal('removeCriterion'), criterionId: IdSchema }),
  z.object({
    type: z.literal('restoreCriterion'),
    criterion: CriterionSchema,
    values: z.record(IdSchema, NodeValueSchema),
  }),
]);
export type Command = z.infer<typeof CommandSchema>;
export type CommandType = Command['type'];

export const ACTIVITY_ACTORS = ['ai', 'user', 'import'] as const;
export const ActivityActorSchema = z.enum(ACTIVITY_ACTORS);
export type ActivityActor = z.infer<typeof ActivityActorSchema>;

/**
 * Entry of the per-document activity log: every change, by a person or by an assistant
 * (MCP), with its author. Assistant entries keep their inverse commands so that any client
 * can revert them.
 */
export const ActivityEntrySchema = z.object({
  id: z.string(),
  at: z.number(),
  actor: ActivityActorSchema,
  /** Stable id of the author (user id, or local device id when not signed in). */
  actorId: z.string().optional(),
  actorLabel: z.string().optional(),
  /** Presence color of the author (hex). */
  color: z.string().optional(),
  /** MCP tool name for assistant entries. */
  tool: z.string().optional(),
  /** Command type for single-command entries. */
  command: z.string().optional(),
  summary: z.string(),
  nodeIds: z.array(z.string()),
  /** Commands that undo the entry (kept for assistant entries). */
  inverse: z.array(CommandSchema).optional(),
  reverted: z.boolean().optional(),
});
export type ActivityEntry = z.infer<typeof ActivityEntrySchema>;
