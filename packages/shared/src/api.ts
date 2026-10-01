import { z } from 'zod';

export const ROLES = ['owner', 'editor', 'viewer'] as const;
export const RoleSchema = z.enum(ROLES);
export type Role = z.infer<typeof RoleSchema>;

export const MCP_SCOPES = ['read', 'write'] as const;
export const McpScopeSchema = z.enum(MCP_SCOPES);
export type McpScope = z.infer<typeof McpScopeSchema>;

// ---- auth -----------------------------------------------------------------

export const RegisterInputSchema = z.object({
  email: z.email().max(200),
  password: z.string().min(8).max(200),
  name: z.string().min(1).max(100),
});
export type RegisterInput = z.infer<typeof RegisterInputSchema>;

export const LoginInputSchema = z.object({
  email: z.email().max(200),
  password: z.string().min(1).max(200),
});
export type LoginInput = z.infer<typeof LoginInputSchema>;

export interface UserDto {
  id: string;
  email: string;
  name: string;
  /** Presence color (hex), stable per user. */
  color: string;
}

export interface AuthResponse {
  token: string;
  user: UserDto;
}

// ---- trees ----------------------------------------------------------------

export interface TreeMetaDto {
  id: string;
  title: string;
  ownerId: string;
  role: Role;
  createdAt: string;
  updatedAt: string;
}

export const CreateTreeInputSchema = z.object({
  title: z.string().min(1).max(200),
  /** Optional initial Yjs state (base64 of `Y.encodeStateAsUpdate`). */
  initialState: z.string().max(20_000_000).optional(),
});
export type CreateTreeInput = z.infer<typeof CreateTreeInputSchema>;

export const UpdateTreeInputSchema = z.object({
  title: z.string().min(1).max(200),
});
export type UpdateTreeInput = z.infer<typeof UpdateTreeInputSchema>;

export interface MemberDto {
  userId: string;
  email: string;
  name: string;
  role: Role;
}

export const UpdateMemberInputSchema = z.object({
  role: z.enum(['editor', 'viewer']),
});
export type UpdateMemberInput = z.infer<typeof UpdateMemberInputSchema>;

export const CreateInvitationInputSchema = z.object({
  role: z.enum(['editor', 'viewer']),
  expiresInHours: z.number().int().positive().max(24 * 30).optional(),
});
export type CreateInvitationInput = z.infer<typeof CreateInvitationInputSchema>;

export interface InvitationDto {
  token: string;
  treeId: string;
  role: Role;
  expiresAt: string;
}

export interface InvitationPreviewDto {
  treeId: string;
  title: string;
  role: Role;
  invitedBy: string;
}

// ---- MCP personal access tokens -------------------------------------------

export const CreateTokenInputSchema = z.object({
  name: z.string().min(1).max(100),
  scopes: z.array(McpScopeSchema).min(1),
  expiresInDays: z.number().int().positive().max(365).optional(),
});
export type CreateTokenInput = z.infer<typeof CreateTokenInputSchema>;

export interface TokenDto {
  id: string;
  name: string;
  scopes: McpScope[];
  createdAt: string;
  lastUsedAt?: string;
  expiresAt?: string;
}

export interface TokenCreatedDto extends TokenDto {
  /** Plain token, shown once. */
  token: string;
}

// ---- OAuth consent (web UI → server) ---------------------------------------

export const OAuthDecisionInputSchema = z.object({
  requestId: z.string().min(1),
  approve: z.boolean(),
});
export type OAuthDecisionInput = z.infer<typeof OAuthDecisionInputSchema>;

export interface OAuthConsentDto {
  requestId: string;
  clientName: string;
  clientId: string;
  scopes: string[];
  redirectUri: string;
}

// ---- generic error payload --------------------------------------------------

export interface ApiError {
  statusCode: number;
  message: string;
  code?: string;
}
