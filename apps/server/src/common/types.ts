import type { McpScope } from '@forkcast/shared';

/** Authenticated web user (JWT), attached to `request.user` by the JWT strategy. */
export interface AuthUser {
  userId: string;
  email: string;
}

/** Identity resolved from an MCP credential (personal token or OAuth access token). */
export interface McpIdentity {
  userId: string;
  scopes: McpScope[];
  /** Personal token id or OAuth client id, for logs and rate limiting. */
  credentialId: string;
  kind: 'pat' | 'oauth';
  label: string;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    // eslint-disable-next-line @typescript-eslint/no-empty-object-type
    interface User extends AuthUser {}
    interface Request {
      mcpIdentity?: McpIdentity;
    }
  }
}
