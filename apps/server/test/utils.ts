import type { NestExpressApplication } from '@nestjs/platform-express';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';

export interface TestServer {
  app: NestExpressApplication;
  url: string;
  wsUrl: string;
  stop: () => Promise<void>;
}

export async function bootTestServer(): Promise<TestServer> {
  const mongo = await MongoMemoryServer.create();
  process.env['MONGO_URI'] = mongo.getUri('forkcast-test');
  process.env['JWT_SECRET'] = 'test-secret-test-secret';
  process.env['COLLAB_DEBOUNCE'] = '50';
  process.env['MCP_RATE_LIMIT'] = '1000';
  process.env['PUBLIC_URL'] = 'http://127.0.0.1:3999';
  process.env['WEB_URL'] = 'http://127.0.0.1:5199';
  // Imported only now: `ConfigModule.forRoot` reads the environment when the module file loads.
  const { createApp, startApp } = await import('../src/bootstrap.js');
  const app = await createApp({ logger: ['error'] });
  const rawUrl = await startApp(app, 0);
  const url = rawUrl.replace('[::1]', '127.0.0.1');
  return {
    app,
    url,
    wsUrl: url.replace(/^http/, 'ws') + '/collab',
    stop: async () => {
      await app.close();
      await mongo.stop();
    },
  };
}

export interface ApiOptions {
  token?: string;
  body?: unknown;
}

export async function api<T = unknown>(url: string, method: string, path: string, options: ApiOptions = {}): Promise<{ status: number; body: T }> {
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (options.body !== undefined) headers['Content-Type'] = 'application/json';
  if (options.token) headers['Authorization'] = `Bearer ${options.token}`;
  const res = await fetch(url + path, { method, headers, body: options.body === undefined ? undefined : JSON.stringify(options.body) });
  const text = await res.text();
  let body: unknown = null;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }
  }
  return { status: res.status, body: body as T };
}

export async function registerUser(url: string, email: string, name = email.split('@')[0] ?? 'user'): Promise<{ token: string; userId: string }> {
  const res = await api<{ token: string; user: { id: string } }>(url, 'POST', '/api/auth/register', { body: { email, password: 'password123', name } });
  if (res.status !== 201) throw new Error(`register failed: ${res.status} ${JSON.stringify(res.body)}`);
  return { token: res.body.token, userId: res.body.user.id };
}

export async function createPat(url: string, jwt: string, scopes: Array<'read' | 'write'> = ['read', 'write']): Promise<{ id: string; token: string }> {
  const res = await api<{ id: string; token: string }>(url, 'POST', '/api/tokens', { token: jwt, body: { name: 'test', scopes } });
  if (res.status !== 201) throw new Error(`token failed: ${res.status} ${JSON.stringify(res.body)}`);
  return res.body;
}

export async function mcpClient(url: string, bearer: string): Promise<Client> {
  const client = new Client({ name: 'forkcast-e2e', version: '0.0.0' });
  const transport = new StreamableHTTPClientTransport(new URL(url + '/mcp'), { requestInit: { headers: { Authorization: `Bearer ${bearer}` } } });
  await client.connect(transport);
  return client;
}

export async function callTool<T = unknown>(client: Client, name: string, args: Record<string, unknown> = {}): Promise<{ result: CallToolResult; data: T; text: string }> {
  const result = (await client.callTool({ name, arguments: args })) as CallToolResult;
  const text = result.content.map((c) => (c.type === 'text' ? c.text : '')).join('\n');
  let data: unknown = undefined;
  if (!result.isError) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }
  return { result, data: data as T, text };
}

export async function waitFor(predicate: () => boolean, timeoutMs = 5000, label = 'condition'): Promise<void> {
  const start = Date.now();
  while (!predicate()) {
    if (Date.now() - start > timeoutMs) throw new Error(`Timed out waiting for ${label}`);
    await new Promise((r) => setTimeout(r, 25));
  }
}
