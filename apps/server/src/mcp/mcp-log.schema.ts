import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Schema as MongooseSchema, HydratedDocument } from 'mongoose';

/** Journal of MCP operations, per tree. */
@Schema({ collection: 'mcp_operations' })
export class McpOperation {
  @Prop({ index: true })
  treeId?: string;

  @Prop({ required: true, index: true })
  userId!: string;

  @Prop({ required: true })
  credentialId!: string;

  @Prop({ required: true })
  tool!: string;

  @Prop({ type: MongooseSchema.Types.Mixed })
  args?: unknown;

  @Prop({ required: true })
  ok!: boolean;

  @Prop()
  error?: string;

  @Prop({ required: true })
  durationMs!: number;

  @Prop({ required: true, default: () => new Date(), index: true })
  at!: Date;
}
export type McpOperationDocument = HydratedDocument<McpOperation>;
export const McpOperationSchema = SchemaFactory.createForClass(McpOperation);
