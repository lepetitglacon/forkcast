import { All, Controller, Req, Res } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import type { Request, Response } from 'express';
import type { Env } from '../config/env';
import { McpAuthService } from './mcp-auth.service';
import { buildMcpServer } from './mcp-server.factory';
import { McpRateLimiter } from './rate-limiter';
import { TreeOpsService } from './tree-ops.service';

export const MCP_PATH = '/mcp';

/**
 * MCP endpoint (Streamable HTTP, stateless): every POST authenticates the Bearer credential,
 * builds a server bound to that identity, handles the JSON-RPC request and tears down.
 */
@Controller()
export class McpController {
  private readonly publicUrl: string;

  constructor(
    config: ConfigService<Env, true>,
    private readonly auth: McpAuthService,
    private readonly ops: TreeOpsService,
    private readonly limiter: McpRateLimiter,
  ) {
    this.publicUrl = config.get('PUBLIC_URL', { infer: true }).replace(/\/$/, '');
  }

  @All('mcp')
  async handle(@Req() req: Request, @Res() res: Response): Promise<void> {
    const identity = await this.auth.authenticate(req.headers.authorization);
    if (!identity) {
      res
        .status(401)
        .set('WWW-Authenticate', `Bearer resource_metadata="${this.publicUrl}/.well-known/oauth-protected-resource/mcp"`)
        .json({ jsonrpc: '2.0', error: { code: -32001, message: 'Unauthorized: send a Forkcast personal token (Settings → Tokens MCP) or an OAuth access token as "Authorization: Bearer …".' }, id: null });
      return;
    }
    if (!this.limiter.allow(`${identity.kind}:${identity.credentialId}`)) {
      res.status(429).json({ jsonrpc: '2.0', error: { code: -32000, message: `Rate limit exceeded (${this.limiter.limit} requests per minute).` }, id: null });
      return;
    }
    if (req.method !== 'POST') {
      res.status(405).set('Allow', 'POST').json({ jsonrpc: '2.0', error: { code: -32000, message: 'Method not allowed: this MCP server is stateless, use POST.' }, id: null });
      return;
    }
    const server = buildMcpServer(this.ops, identity, this.publicUrl);
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
    res.on('close', () => {
      void transport.close();
      void server.close();
    });
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  }
}
