import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import type * as Y from 'yjs';
import { z } from 'zod';
import {
  addChild,
  addCriterion,
  addSubtree,
  applyCommands,
  buildSnapshot,
  createDoc,
  createDocFromJson,
  docToJson,
  encodeDocState,
  move,
  recordActivity,
  remove,
  subtreeIds,
  updateCriterion,
  depthOf,
  type CommandResult,
  DocError,
} from '@forkcast/doc';
import { analyzeTree, computeAggregates, countConfigurations, resolveConfiguration, Configuration, NodeAggregate } from '@forkcast/engine';
import {
  type AddCriterionToolInput,
  type AddNodeToolInput,
  type BuildSubtreeToolInput,
  type ComputeConfigurationsToolInput,
  type CreateTreeToolInput,
  DESTRUCTIVE_CONFIRM_THRESHOLD,
  type DeleteNodeToolInput,
  type ExplainConfigurationToolInput,
  type ExportTreeToolInput,
  type GetTreeToolInput,
  type ImportTreeToolInput,
  type MoveNodeToolInput,
  type SetValuesToolInput,
  type UpdateCriterionToolInput,
  type UpdateNodeToolInput,
  type Command,
  type Role,
  type Tree,
  type TreeJson,
} from '@forkcast/shared';
import { CollabService } from '../collab/collab.service';
import type { McpIdentity } from '../common/types';
import { AccessService } from '../trees/access.service';
import { TreesService } from '../trees/trees.service';
import { McpOperation } from './mcp-log.schema';

type Args<S extends z.ZodRawShape> = z.infer<z.ZodObject<S>>;

/** Error surfaced to the LLM with a stable code. */
export class McpToolError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
  }
}

interface NodeOut {
  id: string;
  label: string;
  kind: string;
  optional?: boolean;
  notes?: string;
  values?: Record<string, number | { value: number; estimatedBy: 'ai' }>;
  aggregate?: { min: Record<string, number>; max: Record<string, number>; configurations: number };
  children?: NodeOut[];
}

@Injectable()
export class TreeOpsService {
  private readonly logger = new Logger(TreeOpsService.name);

  constructor(
    private readonly collab: CollabService,
    private readonly trees: TreesService,
    private readonly access: AccessService,
    @InjectModel(McpOperation.name) private readonly log: Model<McpOperation>,
  ) {}

  // ------------------------------------------------------------------ helpers

  private async requireRole(identity: McpIdentity, treeId: string, minimum: Role): Promise<Role> {
    const tree = await this.access.findTree(treeId);
    if (!tree) throw new McpToolError('TREE_NOT_FOUND', `Tree "${treeId}" does not exist. Use list_trees to find valid ids.`);
    const role = await this.access.getRole(identity.userId, treeId);
    if (!role) throw new McpToolError('FORBIDDEN', `You have no access to tree "${treeId}".`);
    if (minimum !== 'viewer') {
      if (!identity.scopes.includes('write')) throw new McpToolError('READ_ONLY_TOKEN', 'This token only has the "read" scope; writing requires a token with the "write" scope.');
      if (role === 'viewer') throw new McpToolError('FORBIDDEN', `You are a viewer on tree "${treeId}": writes are not allowed.`);
    }
    return role;
  }

  private async read<T>(identity: McpIdentity, treeId: string, fn: (doc: Y.Doc) => T): Promise<T> {
    const role = await this.requireRole(identity, treeId, 'viewer');
    return this.collab.withDocument(treeId, { userId: identity.userId, role, via: 'mcp', readOnly: true }, fn);
  }

  private async write<T>(identity: McpIdentity, treeId: string, fn: (doc: Y.Doc) => T): Promise<T> {
    const role = await this.requireRole(identity, treeId, 'editor');
    return this.collab.withDocument(treeId, { userId: identity.userId, role, via: 'mcp' }, fn);
  }

  private record(doc: Y.Doc, identity: McpIdentity, tool: string, summary: string, result: { inverse: Command[]; affectedNodeIds: string[] }): void {
    recordActivity(
      doc,
      { actor: 'ai', actorId: identity.userId, actorLabel: `Assistant IA · ${identity.label}`, tool, command: tool, summary, nodeIds: result.affectedNodeIds, inverse: result.inverse, coalesce: false },
      'mcp',
    );
  }

  /** Audit log in MongoDB; never throws. */
  async journal(identity: McpIdentity, tool: string, args: unknown, outcome: { ok: boolean; error?: string; durationMs: number }): Promise<void> {
    try {
      const treeId = typeof args === 'object' && args !== null ? (args as { treeId?: unknown }).treeId : undefined;
      await this.log.create({
        treeId: typeof treeId === 'string' ? treeId : undefined,
        userId: identity.userId,
        credentialId: identity.credentialId,
        tool,
        args,
        ok: outcome.ok,
        error: outcome.error,
        durationMs: outcome.durationMs,
        at: new Date(),
      });
    } catch (error) {
      this.logger.warn(`Could not journal MCP operation: ${(error as Error).message}`);
    }
  }

  private labelOf(tree: Tree, id: string): string {
    return tree.nodes[id]?.label ?? id;
  }

  private nodeOut(tree: Tree, id: string, aggregates?: Record<string, NodeAggregate>): NodeOut {
    const node = tree.nodes[id]!;
    const out: NodeOut = { id, label: node.label, kind: node.kind };
    if (node.optional) out.optional = true;
    if (node.notes) out.notes = node.notes;
    const entries = Object.entries(node.values);
    if (entries.length > 0) {
      out.values = Object.fromEntries(entries.map(([k, v]) => [k, v.estimatedBy ? { value: v.value, estimatedBy: v.estimatedBy } : v.value]));
    }
    const agg = aggregates?.[id];
    if (agg && agg.hasChoices) out.aggregate = { min: agg.min, max: agg.max, configurations: agg.count };
    const kids = tree.children[id] ?? [];
    if (kids.length > 0) out.children = kids.map((k) => this.nodeOut(tree, k, aggregates));
    return out;
  }

  private describeConfiguration(tree: Tree, c: Configuration): { key: string; totals: Record<string, number>; choices: Array<{ orNode: { id: string; label: string }; chosen: { id: string; label: string } }>; optional: Array<{ node: { id: string; label: string }; included: boolean }>; summary: string } {
    const choices = Object.entries(c.choices).map(([orId, childId]) => ({
      orNode: { id: orId, label: this.labelOf(tree, orId) },
      chosen: { id: childId, label: this.labelOf(tree, childId) },
    }));
    const optional = Object.entries(c.included).map(([id, included]) => ({ node: { id, label: this.labelOf(tree, id) }, included }));
    const summary = [
      ...choices.map((ch) => `${ch.orNode.label} → ${ch.chosen.label}`),
      ...optional.map((o) => `${o.node.label}: ${o.included ? 'inclus' : 'exclu'}`),
    ].join(' ; ');
    return { key: c.key, totals: c.totals, choices, optional, summary };
  }

  // ------------------------------------------------------------------ tools

  async listTrees(identity: McpIdentity): Promise<{ trees: Array<{ id: string; title: string; role: Role; updatedAt: string }> }> {
    const trees = await this.trees.list(identity.userId);
    return { trees: trees.map((t) => ({ id: t.id, title: t.title, role: t.role, updatedAt: t.updatedAt })) };
  }

  async createTree(identity: McpIdentity, args: Args<typeof CreateTreeToolInput>): Promise<{ id: string; title: string; rootId: string; criteria: string[]; nodeCount: number }> {
    if (!identity.scopes.includes('write')) throw new McpToolError('READ_ONLY_TOKEN', 'Creating a tree requires the "write" scope.');
    let doc: Y.Doc;
    if (args.root) {
      const json: TreeJson = { format: 'forkcast-tree', version: 1, title: args.title, criteria: args.criteria ?? [], root: args.root };
      doc = createDocFromJson(json, { estimatedBy: 'ai' });
    } else {
      doc = createDoc({ title: args.title }, 'mcp');
      for (const c of args.criteria ?? []) addCriterion(doc, { criterion: c }, 'mcp');
    }
    const tree = buildSnapshot(doc);
    const meta = await this.trees.createWithState(identity.userId, args.title, encodeDocState(doc));
    return { id: meta.id, title: meta.title, rootId: tree.meta.rootId, criteria: tree.criteria.map((c) => c.id), nodeCount: Object.keys(tree.nodes).length };
  }

  async getTree(identity: McpIdentity, args: Args<typeof GetTreeToolInput>): Promise<unknown> {
    return this.read(identity, args.treeId, (doc) => {
      const tree = buildSnapshot(doc);
      const includeAggregates = args.includeAggregates ?? true;
      const aggregates = includeAggregates ? computeAggregates(tree) : undefined;
      return {
        id: args.treeId,
        title: tree.meta.title,
        rootId: tree.meta.rootId,
        criteria: tree.criteria,
        nodeCount: Object.keys(tree.nodes).length,
        configurationsCount: countConfigurations(tree),
        legend: 'kind: and = all children required, or = exactly one child chosen, leaf = option. optional: true = may be excluded. values: { criterionId: number } ({ value, estimatedBy: "ai" } when estimated by an assistant). aggregate (nodes with choices): [min, max] totals reachable in the subtree.',
        root: tree.meta.rootId ? this.nodeOut(tree, tree.meta.rootId, aggregates) : null,
      };
    });
  }

  async buildSubtree(identity: McpIdentity, args: Args<typeof BuildSubtreeToolInput>): Promise<unknown> {
    return this.write(identity, args.treeId, (doc) => {
      const r = addSubtree(doc, { parentId: args.parentId, subtree: args.subtree, position: args.position, estimatedBy: 'ai' }, 'mcp');
      this.record(doc, identity, 'build_subtree', `Ajout de la branche « ${args.subtree.label} » (${r.result.nodeIds.length} nœud${r.result.nodeIds.length > 1 ? 's' : ''})`, r);
      return { id: r.result.id, nodeIds: r.result.nodeIds, idMap: r.result.idMap, nodeCount: r.result.nodeIds.length };
    });
  }

  async addNode(identity: McpIdentity, args: Args<typeof AddNodeToolInput>): Promise<unknown> {
    return this.write(identity, args.treeId, (doc) => {
      const r = addChild(doc, { parentId: args.parentId, node: { label: args.label, kind: args.kind, optional: args.optional, notes: args.notes, values: args.values }, position: args.position, estimatedBy: 'ai' }, 'mcp');
      this.record(doc, identity, 'add_node', `Ajout du nœud « ${args.label} »`, r);
      return { id: r.result.id };
    });
  }

  async updateNode(identity: McpIdentity, args: Args<typeof UpdateNodeToolInput>): Promise<unknown> {
    return this.write(identity, args.treeId, (doc) => {
      const commands: Command[] = [];
      if (args.label !== undefined) commands.push({ type: 'rename', nodeId: args.nodeId, label: args.label });
      if (args.kind !== undefined) commands.push({ type: 'setKind', nodeId: args.nodeId, kind: args.kind });
      if (args.optional !== undefined) commands.push({ type: 'setOptional', nodeId: args.nodeId, optional: args.optional });
      if (args.notes !== undefined) commands.push({ type: 'setNotes', nodeId: args.nodeId, notes: args.notes });
      if (commands.length === 0) throw new McpToolError('NOTHING_TO_UPDATE', 'Provide at least one of label, kind, optional, notes.');
      const batch = applyCommands(doc, commands, 'mcp');
      const label = buildSnapshot(doc).nodes[args.nodeId]?.label ?? args.nodeId;
      this.record(doc, identity, 'update_node', `Modification du nœud « ${label} » (${commands.map((c) => c.type).join(', ')})`, batch);
      return { id: args.nodeId, applied: commands.map((c) => c.type) };
    });
  }

  async moveNode(identity: McpIdentity, args: Args<typeof MoveNodeToolInput>): Promise<unknown> {
    return this.write(identity, args.treeId, (doc) => {
      const before = buildSnapshot(doc);
      const r = move(doc, { nodeId: args.nodeId, parentId: args.newParentId, index: args.index }, 'mcp');
      this.record(doc, identity, 'move_node', `Déplacement de « ${this.labelOf(before, args.nodeId)} » sous « ${this.labelOf(before, args.newParentId)} »`, r);
      return { id: args.nodeId, parentId: args.newParentId };
    });
  }

  async deleteNode(identity: McpIdentity, args: Args<typeof DeleteNodeToolInput>): Promise<unknown> {
    return this.write(identity, args.treeId, (doc) => {
      const tree = buildSnapshot(doc);
      if (!tree.nodes[args.nodeId]) throw new DocError('NODE_NOT_FOUND', `Node "${args.nodeId}" does not exist.`, { nodeId: args.nodeId });
      const ids = subtreeIds(tree, args.nodeId);
      if (ids.length > DESTRUCTIVE_CONFIRM_THRESHOLD && args.confirm !== true) {
        throw new McpToolError('CONFIRM_REQUIRED', `Deleting "${this.labelOf(tree, args.nodeId)}" removes ${ids.length} nodes (${ids.slice(0, 8).map((id) => this.labelOf(tree, id)).join(', ')}${ids.length > 8 ? ', …' : ''}). Call again with confirm: true to proceed.`, { nodeCount: ids.length });
      }
      const r = remove(doc, { nodeId: args.nodeId }, 'mcp');
      this.record(doc, identity, 'delete_node', `Suppression de « ${this.labelOf(tree, args.nodeId)} » (${ids.length} nœud${ids.length > 1 ? 's' : ''})`, r);
      return { removedIds: r.result.removedIds };
    });
  }

  async setValues(identity: McpIdentity, args: Args<typeof SetValuesToolInput>): Promise<unknown> {
    return this.write(identity, args.treeId, (doc) => {
      const byNode = new Map<string, Record<string, number | null>>();
      for (const v of args.values) {
        const entry = byNode.get(v.nodeId) ?? {};
        entry[v.criterionId] = v.value;
        byNode.set(v.nodeId, entry);
      }
      const commands: Command[] = [...byNode.entries()].map(([nodeId, values]) => ({ type: 'setValues', nodeId, values, estimatedBy: 'ai' }));
      const batch = applyCommands(doc, commands, 'mcp');
      this.record(doc, identity, 'set_values', `Estimation de ${args.values.length} valeur${args.values.length > 1 ? 's' : ''} sur ${byNode.size} nœud${byNode.size > 1 ? 's' : ''}`, batch);
      return { updatedNodes: [...byNode.keys()], count: args.values.length };
    });
  }

  async addCriterion(identity: McpIdentity, args: Args<typeof AddCriterionToolInput>): Promise<unknown> {
    return this.write(identity, args.treeId, (doc) => {
      const r = addCriterion(doc, { criterion: { id: args.id, label: args.label, unit: args.unit, aggregation: args.aggregation, direction: args.direction } }, 'mcp');
      this.record(doc, identity, 'add_criterion', `Ajout du critère « ${args.label} »`, r);
      return { id: r.result.id, criterion: r.result.criterion };
    });
  }

  async updateCriterion(identity: McpIdentity, args: Args<typeof UpdateCriterionToolInput>): Promise<unknown> {
    return this.write(identity, args.treeId, (doc) => {
      const r: CommandResult<{ criterion: unknown }> = updateCriterion(doc, { criterionId: args.criterionId, patch: { label: args.label, unit: args.unit, aggregation: args.aggregation, direction: args.direction } }, 'mcp');
      this.record(doc, identity, 'update_criterion', `Modification du critère « ${args.criterionId} »`, r);
      return { criterion: r.result.criterion };
    });
  }

  async computeConfigurations(identity: McpIdentity, args: Args<typeof ComputeConfigurationsToolInput>): Promise<unknown> {
    return this.read(identity, args.treeId, (doc) => {
      const tree = buildSnapshot(doc);
      const topN = args.topN ?? 5;
      const analysis = analyzeTree(tree, { topN });
      if (args.criterionId && !tree.criteria.some((c) => c.id === args.criterionId)) {
        throw new McpToolError('CRITERION_NOT_FOUND', `Unknown criterion "${args.criterionId}". Known: ${tree.criteria.map((c) => c.id).join(', ')}.`);
      }
      const best = Object.fromEntries(
        Object.entries(analysis.best)
          .filter(([cid]) => !args.criterionId || cid === args.criterionId)
          .map(([cid, list]) => [cid, list.map((c) => this.describeConfiguration(tree, c))]),
      );
      return {
        count: analysis.count,
        enumerated: analysis.enumerated,
        criteria: tree.criteria.map((c) => ({ id: c.id, label: c.label, unit: c.unit, aggregation: c.aggregation, direction: c.direction })),
        pareto: analysis.pareto.slice(0, 50).map((c) => this.describeConfiguration(tree, c)),
        paretoCount: analysis.pareto.length,
        paretoExact: analysis.paretoExact,
        best,
        warnings: analysis.warnings,
        hint: 'Use explain_configuration with a configuration\'s "choices" (and optional "included") to see every node and its contribution.',
      };
    });
  }

  async explainConfiguration(identity: McpIdentity, args: Args<typeof ExplainConfigurationToolInput>): Promise<unknown> {
    return this.read(identity, args.treeId, (doc) => {
      const tree = buildSnapshot(doc);
      const r = resolveConfiguration(tree, { choices: args.choices, included: args.included });
      return {
        key: r.key,
        totals: r.totals,
        summary: this.describeConfiguration(tree, { key: r.key, choices: r.choices, included: r.included, totals: r.totals }).summary,
        nodes: r.nodeIds.map((id) => ({
          id,
          label: this.labelOf(tree, id),
          kind: tree.nodes[id]?.kind,
          depth: depthOf(tree, id),
          own: r.contributions[id]?.own ?? {},
          subtotal: r.contributions[id]?.subtotal ?? {},
        })),
        defaultedOr: r.defaultedOr.map((id) => ({ id, label: this.labelOf(tree, id), chosen: r.choices[id] })),
        defaultedOptional: r.defaultedOptional.map((id) => ({ id, label: this.labelOf(tree, id) })),
        invalidChoices: r.invalidChoices,
      };
    });
  }

  async exportTree(identity: McpIdentity, args: Args<typeof ExportTreeToolInput>): Promise<TreeJson> {
    return this.read(identity, args.treeId, (doc) => docToJson(doc));
  }

  async importTree(identity: McpIdentity, args: Args<typeof ImportTreeToolInput>): Promise<unknown> {
    if (!identity.scopes.includes('write')) throw new McpToolError('READ_ONLY_TOKEN', 'Importing a tree requires the "write" scope.');
    const doc = createDocFromJson(args.tree, { estimatedBy: 'ai', title: args.title });
    const tree = buildSnapshot(doc);
    const meta = await this.trees.createWithState(identity.userId, tree.meta.title, encodeDocState(doc));
    return { id: meta.id, title: meta.title, rootId: tree.meta.rootId, nodeCount: Object.keys(tree.nodes).length };
  }
}
