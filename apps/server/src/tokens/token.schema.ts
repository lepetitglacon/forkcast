import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import type { HydratedDocument } from 'mongoose';
import { MCP_SCOPES, McpScope } from '@forkcast/shared';

/** Personal access token for the MCP server (only a SHA-256 hash is stored). */
@Schema({ timestamps: true, collection: 'mcp_tokens' })
export class McpToken {
  @Prop({ required: true, index: true })
  userId!: string;

  @Prop({ required: true, trim: true })
  name!: string;

  @Prop({ required: true, unique: true })
  hash!: string;

  @Prop({ required: true })
  prefix!: string;

  @Prop({ type: [String], enum: MCP_SCOPES, required: true })
  scopes!: McpScope[];

  @Prop()
  expiresAt?: Date;

  @Prop()
  lastUsedAt?: Date;

  @Prop()
  revokedAt?: Date;

  createdAt!: Date;
}
export type McpTokenDocument = HydratedDocument<McpToken>;
export const McpTokenSchema = SchemaFactory.createForClass(McpToken);
