import { McpServer, ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { isDocError } from '@forkcast/doc';
import {
  AddCriterionToolInput,
  AddNodeToolInput,
  BuildSubtreeToolInput,
  ComputeConfigurationsToolInput,
  CreateTreeToolInput,
  DeleteNodeToolInput,
  ExplainConfigurationToolInput,
  ExportTreeToolInput,
  GetTreeToolInput,
  ImportTreeToolInput,
  ListTreesToolInput,
  MoveNodeToolInput,
  SetValuesToolInput,
  UpdateCriterionToolInput,
  UpdateNodeToolInput,
} from '@forkcast/shared';
import type { McpIdentity } from '../common/types';
import { McpToolError, TreeOpsService } from './tree-ops.service';

export const MCP_SERVER_NAME = 'forkcast';
export const MCP_SERVER_VERSION = '0.1.0';

const INSTRUCTIONS = `Forkcast edits collaborative AND/OR decision trees used to explore the technical options of a feature.
A tree has criteria (cost, dev time, risk…), each with an aggregation (sum | max | min | probOr) and a direction (minimize | maximize).
Nodes: "and" = every child is required, "or" = exactly one child is chosen, "leaf" = an option; a child of an AND node may be "optional".
Nodes carry values per criterion; the engine computes the totals of every configuration, the Pareto front and the best choices.
Typical flow: list_trees → get_tree (ids) → build_subtree to add whole branches in one call → set_values to estimate → compute_configurations to compare.
All values written through MCP are flagged as AI estimates so that users can review them. Changes appear live in the web UI and can be reverted by users.`;

function errorResult(error: unknown): CallToolResult {
  let text: string;
  if (error instanceof McpToolError) {
    text = `ERROR ${error.code}: ${error.message}${error.details ? `\n${JSON.stringify(error.details)}` : ''}`;
  } else if (isDocError(error)) {
    text = `ERROR ${error.code}: ${error.message}${error.details ? `\n${JSON.stringify(error.details)}` : ''}`;
  } else {
    text = `ERROR INTERNAL: ${(error as Error).message ?? String(error)}`;
  }
  return { isError: true, content: [{ type: 'text', text }] };
}

function okResult(result: unknown): CallToolResult {
  const payload = result === undefined ? null : result;
  return {
    content: [{ type: 'text', text: JSON.stringify(payload, null, 2) }],
    structuredContent: typeof payload === 'object' && payload !== null && !Array.isArray(payload) ? (payload as Record<string, unknown>) : { result: payload },
  };
}

/** Build a fresh MCP server bound to one authenticated identity (stateless transport). */
export function buildMcpServer(ops: TreeOpsService, identity: McpIdentity, publicUrl: string): McpServer {
  const server = new McpServer({ name: MCP_SERVER_NAME, version: MCP_SERVER_VERSION }, { instructions: INSTRUCTIONS });

  const run = async (tool: string, args: unknown, fn: () => Promise<unknown>): Promise<CallToolResult> => {
    const start = Date.now();
    try {
      const result = await fn();
      void ops.journal(identity, tool, args, { ok: true, durationMs: Date.now() - start });
      return okResult(result);
    } catch (error) {
      void ops.journal(identity, tool, args, { ok: false, error: (error as Error).message, durationMs: Date.now() - start });
      return errorResult(error);
    }
  };

  const canWrite = identity.scopes.includes('write');
  const writeHint = canWrite ? '' : ' (this token is read-only: the call will be refused)';

  server.registerTool(
    'list_trees',
    { title: 'List trees', description: 'List the decision trees the current user can access, with their ids and roles.', inputSchema: ListTreesToolInput, annotations: { readOnlyHint: true } },
    async (args) => run('list_trees', args, () => ops.listTrees(identity)),
  );

  server.registerTool(
    'create_tree',
    {
      title: 'Create a tree',
      description: `Create a new decision tree. Give criteria up front, and optionally the whole tree as a nested "root" (same format as build_subtree) to create everything in one call${writeHint}. Example: { "title": "Ajouter le paiement en ligne", "criteria": [{ "id": "cost", "label": "Coût mensuel", "unit": "€" }, { "id": "risk", "label": "Risque", "aggregation": "probOr" }], "root": { "label": "Ajouter le paiement en ligne", "kind": "and", "children": [{ "label": "PSP", "kind": "or", "children": [{ "label": "Stripe", "values": { "cost": 25, "risk": 0.05 } }] }] } }`,
      inputSchema: CreateTreeToolInput,
    },
    async (args) => run('create_tree', args, () => ops.createTree(identity, args)),
  );

  server.registerTool(
    'get_tree',
    {
      title: 'Read a tree',
      description: 'Return a tree as nested JSON with node ids, kinds, values, notes, and (by default) the [min, max] aggregates of every node that holds choices. Use the ids it returns for all other tools.',
      inputSchema: GetTreeToolInput,
      annotations: { readOnlyHint: true },
    },
    async (args) => run('get_tree', args, () => ops.getTree(identity, args)),
  );

  server.registerTool(
    'build_subtree',
    {
      title: 'Build a whole branch',
      description: `Insert a complete branch (nested nodes with values) under a parent in ONE call — the preferred way to build trees${writeHint}. Example: { "treeId": "…", "parentId": "<root id>", "subtree": { "label": "Hébergement", "kind": "or", "children": [{ "label": "Serverless", "values": { "cost": 20, "dev": 8 } }, { "label": "Conteneur", "values": { "cost": 5, "dev": 3 } }] } }. Returns the ids of the created nodes.`,
      inputSchema: BuildSubtreeToolInput,
    },
    async (args) => run('build_subtree', args, () => ops.buildSubtree(identity, args)),
  );

  server.registerTool(
    'add_node',
    { title: 'Add a node', description: `Add a single node under a parent${writeHint}. Prefer build_subtree for several nodes.`, inputSchema: AddNodeToolInput },
    async (args) => run('add_node', args, () => ops.addNode(identity, args)),
  );

  server.registerTool(
    'update_node',
    { title: 'Update a node', description: `Rename a node, change its kind (and/or/leaf), toggle optional, or set notes${writeHint}.`, inputSchema: UpdateNodeToolInput },
    async (args) => run('update_node', args, () => ops.updateNode(identity, args)),
  );

  server.registerTool(
    'move_node',
    { title: 'Move a node', description: `Move a node (with its whole branch) under another parent${writeHint}. Refused when the destination is the node itself or one of its descendants.`, inputSchema: MoveNodeToolInput },
    async (args) => run('move_node', args, () => ops.moveNode(identity, args)),
  );

  server.registerTool(
    'delete_node',
    {
      title: 'Delete a node',
      description: `Delete a node and its whole branch${writeHint}. Branches larger than a few nodes require "confirm": true (the error tells you).`,
      inputSchema: DeleteNodeToolInput,
      annotations: { destructiveHint: true },
    },
    async (args) => run('delete_node', args, () => ops.deleteNode(identity, args)),
  );

  server.registerTool(
    'set_values',
    {
      title: 'Set values (batch)',
      description: `Set several values at once: [{ nodeId, criterionId, value }]${writeHint}. A null value removes it. Values are flagged as AI estimates. Example: { "treeId": "…", "values": [{ "nodeId": "stripe", "criterionId": "cost", "value": 25 }] }`,
      inputSchema: SetValuesToolInput,
    },
    async (args) => run('set_values', args, () => ops.setValues(identity, args)),
  );

  server.registerTool(
    'add_criterion',
    { title: 'Add a criterion', description: `Add a criterion (e.g. cost, dev time, risk)${writeHint}. aggregation: sum | max | min | probOr; direction: minimize | maximize.`, inputSchema: AddCriterionToolInput },
    async (args) => run('add_criterion', args, () => ops.addCriterion(identity, args)),
  );

  server.registerTool(
    'update_criterion',
    { title: 'Update a criterion', description: `Change the label, unit, aggregation or direction of a criterion${writeHint}.`, inputSchema: UpdateCriterionToolInput },
    async (args) => run('update_criterion', args, () => ops.updateCriterion(identity, args)),
  );

  server.registerTool(
    'compute_configurations',
    {
      title: 'Compare configurations',
      description: 'Compute the configurations of a tree: total count, Pareto front (non-dominated combinations) and the best N per criterion, each with its totals and a readable summary of the choices.',
      inputSchema: ComputeConfigurationsToolInput,
      annotations: { readOnlyHint: true },
    },
    async (args) => run('compute_configurations', args, () => ops.computeConfigurations(identity, args)),
  );

  server.registerTool(
    'explain_configuration',
    {
      title: 'Explain a configuration',
      description: 'Detail one configuration: every included node with its own values and the subtotal of its branch, plus the totals. Pass the "choices" returned by compute_configurations.',
      inputSchema: ExplainConfigurationToolInput,
      annotations: { readOnlyHint: true },
    },
    async (args) => run('explain_configuration', args, () => ops.explainConfiguration(identity, args)),
  );

  server.registerTool(
    'export_tree',
    { title: 'Export a tree', description: 'Export a tree in the forkcast JSON format (criteria + nested root).', inputSchema: ExportTreeToolInput, annotations: { readOnlyHint: true } },
    async (args) => run('export_tree', args, () => ops.exportTree(identity, args)),
  );

  server.registerTool(
    'import_tree',
    { title: 'Import a tree', description: `Create a NEW tree from the forkcast JSON format (as returned by export_tree)${writeHint}.`, inputSchema: ImportTreeToolInput },
    async (args) => run('import_tree', args, () => ops.importTree(identity, args)),
  );

  server.registerResource(
    'tree',
    new ResourceTemplate('tree://{treeId}', {
      list: async () => {
        const { trees } = await ops.listTrees(identity);
        return { resources: trees.map((t) => ({ uri: `tree://${t.id}`, name: t.title, description: `Decision tree (${t.role})`, mimeType: 'application/json' })) };
      },
    }),
    { title: 'Decision tree', description: 'A forkcast decision tree as JSON, with aggregates.', mimeType: 'application/json' },
    async (uri, variables) => {
      const treeId = String(variables['treeId'] ?? '');
      const tree = await ops.getTree(identity, { treeId, includeAggregates: true });
      return { contents: [{ uri: uri.href, mimeType: 'application/json', text: JSON.stringify(tree, null, 2) }] };
    },
  );

  server.registerPrompt(
    'explore_feature_options',
    {
      title: 'Explore the options of a feature',
      description: 'Guide the assistant to build a complete AND/OR tree for a feature, propose alternatives and estimate costs and risks.',
      argsSchema: {
        feature: z.string().describe('The feature to explore, e.g. "Ajouter le paiement en ligne".'),
        context: z.string().optional().describe('Technical context: stack, constraints, team, budget…'),
        treeId: z.string().optional().describe('Existing tree to enrich (otherwise create one).'),
      },
    },
    ({ feature, context, treeId }) => ({
      messages: [
        {
          role: 'user',
          content: {
            type: 'text',
            text: [
              `Tu aides à explorer les options techniques de la fonctionnalité : « ${feature} ».`,
              context ? `Contexte : ${context}` : '',
              treeId ? `Travaille dans l'arbre existant ${treeId} (lis-le d'abord avec get_tree).` : `Crée un nouvel arbre avec create_tree, avec au moins les critères : coût mensuel (€, sum), temps de dev (jours, sum), risque (probOr, probabilité 0–1).`,
              'Méthode :',
              '1. Décompose la fonctionnalité en sous-besoins obligatoires (nœuds ET).',
              '2. Pour chaque sous-besoin ayant plusieurs solutions possibles (outil, service, approche), crée un nœud OU avec 2 à 4 alternatives concrètes.',
              '3. Marque comme optionnels les éléments qui améliorent la solution sans être indispensables.',
              '4. Utilise build_subtree pour créer chaque branche en un appel, puis set_values pour renseigner des estimations réalistes (elles seront marquées comme estimations IA).',
              '5. Termine avec compute_configurations et présente les 3 meilleures combinaisons (et le front de Pareto) en expliquant les compromis.',
              'Réponds en français, de façon concise, et indique les ids des nœuds créés.',
            ]
              .filter(Boolean)
              .join('\n'),
          },
        },
      ],
    }),
  );

  void publicUrl;
  return server;
}
