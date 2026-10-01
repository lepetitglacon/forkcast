import { Injectable } from '@nestjs/common';
import type { McpScope } from '@forkcast/shared';
import type { McpIdentity } from '../common/types';
import { OAUTH_ACCESS_PREFIX, OAuthProviderService } from '../oauth/oauth-provider.service';
import { PAT_PREFIX, TokensService } from '../tokens/tokens.service';

/** Resolves the Bearer credential of an MCP request: personal token or OAuth access token. */
@Injectable()
export class McpAuthService {
  constructor(
    private readonly tokens: TokensService,
    private readonly oauth: OAuthProviderService,
  ) {}

  async authenticate(authorization: string | undefined): Promise<McpIdentity | null> {
    const bearer = authorization?.match(/^Bearer\s+(.+)$/i)?.[1]?.trim();
    if (!bearer) return null;
    if (bearer.startsWith(PAT_PREFIX)) {
      const pat = await this.tokens.verify(bearer);
      return pat ? { userId: pat.userId, scopes: pat.scopes, credentialId: pat.id, kind: 'pat', label: pat.name } : null;
    }
    if (bearer.startsWith(OAUTH_ACCESS_PREFIX)) {
      const info = await this.oauth.verifyAccessTokenSafe(bearer);
      const userId = info?.extra?.['userId'];
      if (!info || typeof userId !== 'string') return null;
      const scopes = info.scopes.filter((s): s is McpScope => s === 'read' || s === 'write');
      return { userId, scopes, credentialId: info.clientId, kind: 'oauth', label: `OAuth ${info.clientId}` };
    }
    return null;
  }
}
