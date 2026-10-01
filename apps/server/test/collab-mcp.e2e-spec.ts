import { HocuspocusProvider } from '@hocuspocus/provider';
import * as Y from 'yjs';
import { buildSnapshot, listActivity, rename } from '@forkcast/doc';
import { api, bootTestServer, callTool, createPat, mcpClient, registerUser, waitFor, TestServer } from './utils';

interface ConnectedClient {
  doc: Y.Doc;
  provider: HocuspocusProvider;
}

async function connectClient(server: TestServer, treeId: string, jwt: string): Promise<ConnectedClient> {
  const doc = new Y.Doc();
  let synced = false;
  const provider = new HocuspocusProvider({ url: server.wsUrl, name: treeId, document: doc, token: jwt, onSynced: () => (synced = true) });
  await waitFor(() => synced, 10_000, 'provider sync');
  return { doc, provider };
}

describe('MCP tools and live Yjs clients', () => {
  let server: TestServer;
  let alice: { token: string; userId: string };
  let bob: { token: string; userId: string };
  let pat: { id: string; token: string };
  let treeId: string;
  const clients: ConnectedClient[] = [];

  beforeAll(async () => {
    server = await bootTestServer();
    alice = await registerUser(server.url, 'alice@example.com', 'Alice');
    bob = await registerUser(server.url, 'bob@example.com', 'Bob');
    pat = await createPat(server.url, alice.token);
  });

  afterAll(async () => {
    for (const c of clients) c.provider.destroy();
    await server.stop();
  });

  it('creates a tree through MCP and lists it', async () => {
    const client = await mcpClient(server.url, pat.token);
    const tools = await client.listTools();
    expect(tools.tools.map((t) => t.name)).toEqual(expect.arrayContaining(['list_trees', 'create_tree', 'build_subtree', 'compute_configurations', 'explain_configuration']));
    const created = await callTool<{ id: string; rootId: string; criteria: string[] }>(client, 'create_tree', {
      title: 'Via MCP',
      criteria: [
        { id: 'cost', label: 'Coût', unit: '€' },
        { id: 'risk', label: 'Risque', aggregation: 'probOr' },
      ],
    });
    expect(created.result.isError).toBeFalsy();
    treeId = created.data.id;
    expect(created.data.criteria).toEqual(['cost', 'risk']);
    const list = await callTool<{ trees: Array<{ id: string; role: string }> }>(client, 'list_trees');
    expect(list.data.trees.map((t) => t.id)).toContain(treeId);
    const resources = await client.listResources();
    expect(resources.resources.map((r) => r.uri)).toContain(`tree://${treeId}`);
    const prompts = await client.listPrompts();
    expect(prompts.prompts.map((p) => p.name)).toContain('explore_feature_options');
    await client.close();
  });

  it('a tool call is visible on a connected Yjs client, with AI flags and an activity entry', async () => {
    const aliceClient = await connectClient(server, treeId, alice.token);
    clients.push(aliceClient);
    const rootId = buildSnapshot(aliceClient.doc).meta.rootId;
    expect(rootId).toBeTruthy();

    const client = await mcpClient(server.url, pat.token);
    const built = await callTool<{ id: string; nodeIds: string[] }>(client, 'build_subtree', {
      treeId,
      parentId: rootId,
      subtree: {
        id: 'psp',
        label: 'PSP',
        kind: 'or',
        children: [
          { id: 'stripe', label: 'Stripe', values: { cost: 25, risk: 0.05 } },
          { id: 'adyen', label: 'Adyen', values: { cost: 60, risk: 0.1 } },
        ],
      },
    });
    expect(built.result.isError).toBeFalsy();
    expect(built.data.nodeIds).toEqual(['psp', 'stripe', 'adyen']);

    await waitFor(() => buildSnapshot(aliceClient.doc).nodes['adyen'] !== undefined, 5000, 'subtree on client');
    const tree = buildSnapshot(aliceClient.doc);
    expect(tree.nodes['psp']).toMatchObject({ kind: 'or', parentId: rootId });
    expect(tree.nodes['stripe']!.values['cost']).toEqual({ value: 25, estimatedBy: 'ai' });
    const activity = listActivity(aliceClient.doc);
    expect(activity).toHaveLength(1);
    expect(activity[0]).toMatchObject({ actor: 'ai', tool: 'build_subtree' });
    expect(activity[0]!.inverse?.[0]).toEqual({ type: 'remove', nodeId: 'psp' });

    // batch values + compute
    const values = await callTool<{ count: number }>(client, 'set_values', { treeId, values: [{ nodeId: 'stripe', criterionId: 'cost', value: 30 }, { nodeId: 'adyen', criterionId: 'risk', value: 0.2 }] });
    expect(values.result.isError).toBeFalsy();
    await waitFor(() => buildSnapshot(aliceClient.doc).nodes['stripe']!.values['cost']!.value === 30, 5000, 'value on client');
    const computed = await callTool<{ count: number; pareto: Array<{ summary: string }>; best: Record<string, Array<{ totals: Record<string, number> }>> }>(client, 'compute_configurations', { treeId, topN: 2 });
    expect(computed.data.count).toBe(2);
    expect(computed.data.best['cost']![0]!.totals['cost']).toBe(30);
    expect(computed.data.pareto[0]!.summary).toContain('PSP →');
    const explained = await callTool<{ totals: Record<string, number>; nodes: Array<{ id: string }> }>(client, 'explain_configuration', { treeId, choices: { psp: 'adyen' } });
    expect(explained.data.totals['cost']).toBe(60);
    expect(explained.data.nodes.map((n) => n.id)).toEqual([rootId, 'psp', 'adyen']);

    // errors are explicit
    const unknown = await callTool(client, 'add_node', { treeId, parentId: 'nope', label: 'x' });
    expect(unknown.result.isError).toBe(true);
    expect(unknown.text).toContain('NODE_NOT_FOUND');
    const badCriterion = await callTool(client, 'set_values', { treeId, values: [{ nodeId: 'stripe', criterionId: 'zzz', value: 1 }] });
    expect(badCriterion.text).toContain('CRITERION_NOT_FOUND');
    const badMove = await callTool(client, 'move_node', { treeId, nodeId: 'psp', newParentId: 'stripe' });
    expect(badMove.text).toContain('INVALID_MOVE');
    await client.close();
  });

  it('client edits are visible to MCP reads, and destructive deletes need confirmation', async () => {
    const aliceClient = clients[0]!;
    rename(aliceClient.doc, { nodeId: 'stripe', label: 'Stripe Checkout' }, 'local');
    const client = await mcpClient(server.url, pat.token);
    await waitFor(() => true);
    let seen = '';
    await waitFor(() => {
      void callTool<{ root: { children: Array<{ children: Array<{ label: string }> }> } }>(client, 'get_tree', { treeId }).then((r) => {
        seen = r.data.root.children[0]?.children[0]?.label ?? '';
      });
      return seen === 'Stripe Checkout';
    }, 5000, 'rename visible through MCP');

    const bigger = await callTool(client, 'build_subtree', { treeId, parentId: 'psp', subtree: { label: 'More', children: [{ label: 'a' }, { label: 'b' }, { label: 'c' }, { label: 'd' }, { label: 'e' }] } });
    expect(bigger.result.isError).toBeFalsy();
    const refused = await callTool(client, 'delete_node', { treeId, nodeId: 'psp' });
    expect(refused.result.isError).toBe(true);
    expect(refused.text).toContain('CONFIRM_REQUIRED');
    const deleted = await callTool<{ removedIds: string[] }>(client, 'delete_node', { treeId, nodeId: 'psp', confirm: true });
    expect(deleted.data.removedIds).toContain('adyen');
    await waitFor(() => buildSnapshot(aliceClient.doc).nodes['psp'] === undefined, 5000, 'delete on client');
    await client.close();
  });

  it('read-only tokens and viewer members cannot write', async () => {
    const readPat = await createPat(server.url, alice.token, ['read']);
    const client = await mcpClient(server.url, readPat.token);
    const ok = await callTool<{ title: string }>(client, 'get_tree', { treeId });
    expect(ok.result.isError).toBeFalsy();
    const refused = await callTool(client, 'add_node', { treeId, parentId: buildSnapshot(clients[0]!.doc).meta.rootId, label: 'x' });
    expect(refused.text).toContain('READ_ONLY_TOKEN');
    await client.close();

    // Bob is not a member: MCP refuses, WebSocket refuses
    const bobPat = await createPat(server.url, bob.token);
    const bobClient = await mcpClient(server.url, bobPat.token);
    const forbidden = await callTool(bobClient, 'get_tree', { treeId });
    expect(forbidden.text).toContain('FORBIDDEN');
    await bobClient.close();
    let failed = false;
    const bobDoc = new Y.Doc();
    const bobProvider = new HocuspocusProvider({ url: server.wsUrl, name: treeId, document: bobDoc, token: bob.token, onAuthenticationFailed: () => (failed = true) });
    await waitFor(() => failed, 10_000, 'auth failure for non-member');
    bobProvider.destroy();

    // Bob becomes a viewer: he syncs but his writes are dropped by the server
    const invitation = await api<{ token: string }>(server.url, 'POST', `/api/trees/${treeId}/invitations`, { token: alice.token, body: { role: 'viewer' } });
    await api(server.url, 'POST', `/api/invitations/${invitation.body.token}/accept`, { token: bob.token });
    const viewer = await connectClient(server, treeId, bob.token);
    clients.push(viewer);
    expect(viewer.provider.authorizedScope).toBe('readonly');
    const rootId = buildSnapshot(viewer.doc).meta.rootId;
    rename(viewer.doc, { nodeId: rootId, label: 'Hacked by viewer' }, 'local');
    await new Promise((r) => setTimeout(r, 500));
    const check = await mcpClient(server.url, pat.token);
    const tree = await callTool<{ root: { label: string } }>(check, 'get_tree', { treeId });
    expect(tree.data.root.label).toBe('Via MCP');
    await check.close();
  });
});
