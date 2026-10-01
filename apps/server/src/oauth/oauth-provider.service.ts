import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import type { Response } from 'express';
import type { AuthorizationParams, OAuthServerProvider } from '@modelcontextprotocol/sdk/server/auth/provider.js';
import type { OAuthRegisteredClientsStore } from '@modelcontextprotocol/sdk/server/auth/clients.js';
import type { AuthInfo } from '@modelcontextprotocol/sdk/server/auth/types.js';
import { InvalidGrantError, InvalidTokenError } from '@modelcontextprotocol/sdk/server/auth/errors.js';
import type { OAuthClientInformationFull, OAuthTokenRevocationRequest, OAuthTokens } from '@modelcontextprotocol/sdk/shared/auth.js';
import { MCP_SCOPES, McpScope, OAuthConsentDto } from '@forkcast/shared';
import { randomToken, sha256 } from '../common/crypto';
import type { Env } from '../config/env';
import { OAuthClient, OAuthCode, OAuthPendingRequest, OAuthToken } from './schemas';

export const OAUTH_ACCESS_PREFIX = 'fko_';
export const OAUTH_REFRESH_PREFIX = 'fkr_';
const ACCESS_TTL_S = 3600;
const REFRESH_TTL_S = 30 * 86_400;
const CODE_TTL_MS = 5 * 60_000;
const REQUEST_TTL_MS = 10 * 60_000;

/**
 * OAuth 2.1 authorization server for remote MCP connectors (claude.ai, …), as described by
 * the MCP authorization spec: dynamic client registration, PKCE authorization code flow,
 * refresh tokens, revocation. The consent screen lives in the web app.
 */
@Injectable()
export class OAuthProviderService implements OAuthServerProvider {
  private readonly webUrl: string;

  constructor(
    config: ConfigService<Env, true>,
    @InjectModel(OAuthClient.name) private readonly clients: Model<OAuthClient>,
    @InjectModel(OAuthPendingRequest.name) private readonly requests: Model<OAuthPendingRequest>,
    @InjectModel(OAuthCode.name) private readonly codes: Model<OAuthCode>,
    @InjectModel(OAuthToken.name) private readonly tokens: Model<OAuthToken>,
  ) {
    this.webUrl = config.get('WEB_URL', { infer: true });
  }

  get clientsStore(): OAuthRegisteredClientsStore {
    return {
      getClient: async (clientId: string) => {
        const doc = await this.clients.findOne({ clientId }).lean().exec();
        return doc ? (doc.info as unknown as OAuthClientInformationFull) : undefined;
      },
      registerClient: async (client) => {
        const full: OAuthClientInformationFull = {
          ...client,
          client_id: 'fkc_' + randomToken(24),
          client_id_issued_at: Math.floor(Date.now() / 1000),
        };
        if (client.token_endpoint_auth_method && client.token_endpoint_auth_method !== 'none') {
          full.client_secret = randomToken(48);
        }
        await this.clients.create({ clientId: full.client_id, info: full as unknown as Record<string, unknown> });
        return full;
      },
    };
  }

  private normalizeScopes(scopes: string[] | undefined): McpScope[] {
    const wanted = (scopes ?? []).filter((s): s is McpScope => (MCP_SCOPES as readonly string[]).includes(s));
    return wanted.length > 0 ? [...new Set(wanted)] : [...MCP_SCOPES];
  }

  async authorize(client: OAuthClientInformationFull, params: AuthorizationParams, res: Response): Promise<void> {
    const requestId = 'fkr' + randomToken(32);
    await this.requests.create({
      requestId,
      clientId: client.client_id,
      params: {
        state: params.state,
        scopes: this.normalizeScopes(params.scopes),
        codeChallenge: params.codeChallenge,
        redirectUri: params.redirectUri,
        resource: params.resource?.href,
      },
      expiresAt: new Date(Date.now() + REQUEST_TTL_MS),
    });
    const target = new URL('/oauth/consent', this.webUrl);
    target.searchParams.set('request', requestId);
    res.redirect(target.href);
  }

  /** Consent screen data for the web app. */
  async consent(requestId: string): Promise<OAuthConsentDto> {
    const request = await this.requests.findOne({ requestId }).lean().exec();
    if (!request || request.expiresAt.getTime() < Date.now()) {
      throw new NotFoundException({ statusCode: 404, message: "Demande d'autorisation introuvable ou expirée.", code: 'OAUTH_REQUEST_INVALID' });
    }
    const client = await this.clients.findOne({ clientId: request.clientId }).lean().exec();
    const info = client?.info as { client_name?: string } | undefined;
    return {
      requestId,
      clientId: request.clientId,
      clientName: info?.client_name ?? request.clientId,
      scopes: request.params.scopes ?? [],
      redirectUri: request.params.redirectUri,
    };
  }

  /** The user approved or denied the request: returns the URL to redirect the browser to. */
  async decide(userId: string, requestId: string, approve: boolean): Promise<string> {
    const request = await this.requests.findOneAndDelete({ requestId }).lean().exec();
    if (!request || request.expiresAt.getTime() < Date.now()) {
      throw new NotFoundException({ statusCode: 404, message: "Demande d'autorisation introuvable ou expirée.", code: 'OAUTH_REQUEST_INVALID' });
    }
    const redirect = new URL(request.params.redirectUri);
    if (request.params.state) redirect.searchParams.set('state', request.params.state);
    if (!approve) {
      redirect.searchParams.set('error', 'access_denied');
      redirect.searchParams.set('error_description', 'The user denied the request');
      return redirect.href;
    }
    const code = 'fkac_' + randomToken(40);
    await this.codes.create({
      code,
      clientId: request.clientId,
      userId,
      scopes: request.params.scopes ?? [...MCP_SCOPES],
      codeChallenge: request.params.codeChallenge,
      redirectUri: request.params.redirectUri,
      resource: request.params.resource,
      expiresAt: new Date(Date.now() + CODE_TTL_MS),
    });
    redirect.searchParams.set('code', code);
    return redirect.href;
  }

  async challengeForAuthorizationCode(client: OAuthClientInformationFull, authorizationCode: string): Promise<string> {
    const code = await this.codes.findOne({ code: authorizationCode, clientId: client.client_id }).lean().exec();
    if (!code || code.expiresAt.getTime() < Date.now()) throw new InvalidGrantError('Invalid or expired authorization code');
    return code.codeChallenge;
  }

  private async issueTokens(clientId: string, userId: string, scopes: string[], resource?: string): Promise<OAuthTokens> {
    const access = OAUTH_ACCESS_PREFIX + randomToken(48);
    const refresh = OAUTH_REFRESH_PREFIX + randomToken(48);
    await this.tokens.create([
      { hash: sha256(access), kind: 'access', clientId, userId, scopes, resource, expiresAt: new Date(Date.now() + ACCESS_TTL_S * 1000) },
      { hash: sha256(refresh), kind: 'refresh', clientId, userId, scopes, resource, expiresAt: new Date(Date.now() + REFRESH_TTL_S * 1000) },
    ]);
    return { access_token: access, token_type: 'bearer', expires_in: ACCESS_TTL_S, refresh_token: refresh, scope: scopes.join(' ') };
  }

  async exchangeAuthorizationCode(
    client: OAuthClientInformationFull,
    authorizationCode: string,
    _codeVerifier?: string,
    redirectUri?: string,
    resource?: URL,
  ): Promise<OAuthTokens> {
    const code = await this.codes.findOneAndDelete({ code: authorizationCode, clientId: client.client_id }).lean().exec();
    if (!code || code.expiresAt.getTime() < Date.now()) throw new InvalidGrantError('Invalid or expired authorization code');
    if (redirectUri && redirectUri !== code.redirectUri) throw new InvalidGrantError('redirect_uri mismatch');
    return this.issueTokens(client.client_id, code.userId, code.scopes, resource?.href ?? code.resource);
  }

  async exchangeRefreshToken(client: OAuthClientInformationFull, refreshToken: string, scopes?: string[], resource?: URL): Promise<OAuthTokens> {
    const stored = await this.tokens.findOneAndDelete({ hash: sha256(refreshToken), kind: 'refresh', clientId: client.client_id }).lean().exec();
    if (!stored || stored.expiresAt.getTime() < Date.now()) throw new InvalidGrantError('Invalid or expired refresh token');
    const granted = scopes && scopes.length > 0 ? scopes.filter((s) => stored.scopes.includes(s)) : stored.scopes;
    if (granted.length === 0) throw new InvalidGrantError('Requested scopes exceed the granted scopes');
    return this.issueTokens(client.client_id, stored.userId, granted, resource?.href ?? stored.resource);
  }

  async verifyAccessToken(token: string): Promise<AuthInfo> {
    const stored = await this.tokens.findOne({ hash: sha256(token), kind: 'access' }).lean().exec();
    if (!stored) throw new InvalidTokenError('Unknown access token');
    if (stored.expiresAt.getTime() < Date.now()) throw new InvalidTokenError('Access token expired');
    const info: AuthInfo = {
      token,
      clientId: stored.clientId,
      scopes: stored.scopes,
      expiresAt: Math.floor(stored.expiresAt.getTime() / 1000),
      extra: { userId: stored.userId },
    };
    if (stored.resource) info.resource = new URL(stored.resource);
    return info;
  }

  async revokeToken(client: OAuthClientInformationFull, request: OAuthTokenRevocationRequest): Promise<void> {
    await this.tokens.deleteOne({ hash: sha256(request.token), clientId: client.client_id }).exec();
  }

  /** Non-throwing variant used by the MCP endpoint. */
  async verifyAccessTokenSafe(token: string): Promise<AuthInfo | null> {
    try {
      return await this.verifyAccessToken(token);
    } catch {
      return null;
    }
  }
}
