import { createDocFromJson, encodeDocState, exampleTreeJson } from '@forkcast/doc';
import { api, bootTestServer, callTool, createPat, mcpClient, registerUser, TestServer } from './utils';

describe('REST API: auth, trees, rights, tokens', () => {
  let server: TestServer;
  let alice: { token: string; userId: string };
  let bob: { token: string; userId: string };

  beforeAll(async () => {
    server = await bootTestServer();
    alice = await registerUser(server.url, 'alice@example.com', 'Alice');
    bob = await registerUser(server.url, 'bob@example.com', 'Bob');
  });

  afterAll(async () => {
    await server.stop();
  });

  it('registers, logs in, rejects duplicates and bad credentials', async () => {
    expect((await api(server.url, 'GET', '/api/health')).status).toBe(200);
    const me = await api<{ email: string; color: string }>(server.url, 'GET', '/api/auth/me', { token: alice.token });
    expect(me.status).toBe(200);
    expect(me.body.email).toBe('alice@example.com');
    expect(me.body.color).toMatch(/^#/);
    expect((await api(server.url, 'GET', '/api/auth/me')).status).toBe(401);
    const dup = await api(server.url, 'POST', '/api/auth/register', { body: { email: 'alice@example.com', password: 'password123', name: 'A' } });
    expect(dup.status).toBe(409);
    const bad = await api(server.url, 'POST', '/api/auth/login', { body: { email: 'alice@example.com', password: 'nope-nope' } });
    expect(bad.status).toBe(401);
    const ok = await api<{ token: string }>(server.url, 'POST', '/api/auth/login', { body: { email: 'alice@example.com', password: 'password123' } });
    expect(ok.status).toBe(200);
    expect(ok.body.token).toBeTruthy();
    const invalid = await api(server.url, 'POST', '/api/auth/register', { body: { email: 'not-an-email', password: 'short', name: '' } });
    expect(invalid.status).toBe(400);
  });

  it('enforces roles on trees, members and invitations', async () => {
    const created = await api<{ id: string; role: string; title: string }>(server.url, 'POST', '/api/trees', { token: alice.token, body: { title: 'Projet' } });
    expect(created.status).toBe(201);
    expect(created.body.role).toBe('owner');
    const treeId = created.body.id;

    expect((await api<unknown[]>(server.url, 'GET', '/api/trees', { token: alice.token })).body).toHaveLength(1);
    expect((await api<unknown[]>(server.url, 'GET', '/api/trees', { token: bob.token })).body).toHaveLength(0);
    expect((await api(server.url, 'GET', `/api/trees/${treeId}`, { token: bob.token })).status).toBe(403);
    expect((await api(server.url, 'GET', `/api/trees/000000000000000000000000`, { token: bob.token })).status).toBe(404);

    // Bob cannot invite, Alice invites Bob as viewer
    expect((await api(server.url, 'POST', `/api/trees/${treeId}/invitations`, { token: bob.token, body: { role: 'viewer' } })).status).toBe(403);
    const invitation = await api<{ token: string }>(server.url, 'POST', `/api/trees/${treeId}/invitations`, { token: alice.token, body: { role: 'viewer' } });
    expect(invitation.status).toBe(201);
    const preview = await api<{ title: string; role: string; invitedBy: string }>(server.url, 'GET', `/api/invitations/${invitation.body.token}`, { token: bob.token });
    expect(preview.body).toMatchObject({ title: 'Projet', role: 'viewer', invitedBy: 'Alice' });
    const accepted = await api<{ role: string }>(server.url, 'POST', `/api/invitations/${invitation.body.token}/accept`, { token: bob.token });
    expect(accepted.status).toBe(201);
    expect(accepted.body.role).toBe('viewer');
    expect((await api(server.url, 'GET', `/api/invitations/does-not-exist`, { token: bob.token })).status).toBe(404);

    // viewer cannot rename, owner can; owner promotes Bob to editor
    expect((await api(server.url, 'PATCH', `/api/trees/${treeId}`, { token: bob.token, body: { title: 'Hack' } })).status).toBe(403);
    const renamed = await api<{ title: string }>(server.url, 'PATCH', `/api/trees/${treeId}`, { token: alice.token, body: { title: 'Projet 2' } });
    expect(renamed.status).toBe(200);
    expect(renamed.body.title).toBe('Projet 2');
    const members = await api<Array<{ userId: string; role: string }>>(server.url, 'GET', `/api/trees/${treeId}/members`, { token: bob.token });
    expect(members.body.map((m) => m.role).sort()).toEqual(['owner', 'viewer']);
    expect((await api(server.url, 'PATCH', `/api/trees/${treeId}/members/${alice.userId}`, { token: bob.token, body: { role: 'viewer' } })).status).toBe(403);
    expect((await api(server.url, 'PATCH', `/api/trees/${treeId}/members/${alice.userId}`, { token: alice.token, body: { role: 'viewer' } })).status).toBe(403);
    const promoted = await api<{ role: string }>(server.url, 'PATCH', `/api/trees/${treeId}/members/${bob.userId}`, { token: alice.token, body: { role: 'editor' } });
    expect(promoted.body.role).toBe('editor');
    expect((await api(server.url, 'PATCH', `/api/trees/${treeId}`, { token: bob.token, body: { title: 'Projet 3' } })).status).toBe(200);

    // only the owner deletes; Bob can leave
    expect((await api(server.url, 'DELETE', `/api/trees/${treeId}`, { token: bob.token })).status).toBe(403);
    expect((await api(server.url, 'DELETE', `/api/trees/${treeId}/members/${bob.userId}`, { token: bob.token })).status).toBe(204);
    expect((await api(server.url, 'GET', `/api/trees/${treeId}`, { token: bob.token })).status).toBe(403);
    expect((await api(server.url, 'DELETE', `/api/trees/${treeId}`, { token: alice.token })).status).toBe(204);
    expect((await api(server.url, 'GET', `/api/trees/${treeId}`, { token: alice.token })).status).toBe(404);
  });

  it('accepts an initial Yjs state and exposes the tree to MCP tokens', async () => {
    const doc = createDocFromJson(exampleTreeJson());
    const initialState = Buffer.from(encodeDocState(doc)).toString('base64');
    const created = await api<{ id: string }>(server.url, 'POST', '/api/trees', { token: alice.token, body: { title: 'Paiement', initialState } });
    expect(created.status).toBe(201);
    expect((await api(server.url, 'POST', '/api/trees', { token: alice.token, body: { title: 'Bad', initialState: 'not-base64-yjs' } })).status).toBe(400);

    const pat = await createPat(server.url, alice.token);
    expect(pat.token.startsWith('fkp_')).toBe(true);
    const list = await api<Array<{ id: string; name: string; scopes: string[] }>>(server.url, 'GET', '/api/tokens', { token: alice.token });
    expect(list.body).toHaveLength(1);
    expect(list.body[0]!.scopes).toEqual(['read', 'write']);

    const client = await mcpClient(server.url, pat.token);
    const tree = await callTool<{ nodeCount: number; configurationsCount: number; title: string }>(client, 'get_tree', { treeId: created.body.id });
    expect(tree.result.isError).toBeFalsy();
    expect(tree.data.nodeCount).toBe(17);
    expect(tree.data.configurationsCount).toBe(32);
    expect(tree.data.title).toBe('Ajouter le paiement en ligne');
    await client.close();

    // unauthenticated / revoked tokens are refused with a WWW-Authenticate hint
    const noAuth = await fetch(server.url + '/mcp', { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream' }, body: '{}' });
    expect(noAuth.status).toBe(401);
    expect(noAuth.headers.get('www-authenticate')).toContain('oauth-protected-resource/mcp');
    expect((await api(server.url, 'DELETE', `/api/tokens/${pat.id}`, { token: alice.token })).status).toBe(204);
    const revoked = await fetch(server.url + '/mcp', { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream', Authorization: `Bearer ${pat.token}` }, body: '{}' });
    expect(revoked.status).toBe(401);
  });

  it('serves the OAuth metadata and registers clients dynamically', async () => {
    const meta = await api<{ authorization_endpoint: string; registration_endpoint: string; code_challenge_methods_supported: string[] }>(server.url, 'GET', '/.well-known/oauth-authorization-server');
    expect(meta.status).toBe(200);
    expect(meta.body.authorization_endpoint).toContain('/authorize');
    expect(meta.body.code_challenge_methods_supported).toContain('S256');
    const resource = await api<{ resource: string; authorization_servers: string[] }>(server.url, 'GET', '/.well-known/oauth-protected-resource/mcp');
    expect(resource.status).toBe(200);
    expect(resource.body.resource).toContain('/mcp');
    const registered = await api<{ client_id: string; redirect_uris: string[] }>(server.url, 'POST', '/register', { body: { client_name: 'Claude', redirect_uris: ['https://claude.ai/api/mcp/auth_callback'], token_endpoint_auth_method: 'none' } });
    expect(registered.status).toBe(201);
    expect(registered.body.client_id.startsWith('fkc_')).toBe(true);
  });
});
