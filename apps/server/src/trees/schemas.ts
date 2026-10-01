import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import type { HydratedDocument } from 'mongoose';
import { ROLES, Role } from '@forkcast/shared';

@Schema({ timestamps: true, collection: 'trees' })
export class TreeEntity {
  @Prop({ required: true, trim: true })
  title!: string;

  @Prop({ required: true, index: true })
  ownerId!: string;

  createdAt!: Date;
  updatedAt!: Date;
}
export type TreeDocument = HydratedDocument<TreeEntity>;
export const TreeEntitySchema = SchemaFactory.createForClass(TreeEntity);

@Schema({ timestamps: true, collection: 'memberships' })
export class Membership {
  @Prop({ required: true, index: true })
  treeId!: string;

  @Prop({ required: true, index: true })
  userId!: string;

  @Prop({ type: String, required: true, enum: ROLES })
  role!: Role;
}
export type MembershipDocument = HydratedDocument<Membership>;
export const MembershipSchema = SchemaFactory.createForClass(Membership);
MembershipSchema.index({ treeId: 1, userId: 1 }, { unique: true });

@Schema({ timestamps: true, collection: 'invitations' })
export class Invitation {
  @Prop({ required: true, unique: true })
  token!: string;

  @Prop({ required: true, index: true })
  treeId!: string;

  @Prop({ type: String, required: true, enum: ROLES })
  role!: Role;

  @Prop({ required: true })
  createdBy!: string;

  @Prop({ required: true })
  expiresAt!: Date;
}
export type InvitationDocument = HydratedDocument<Invitation>;
export const InvitationSchema = SchemaFactory.createForClass(Invitation);
InvitationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

/** Binary Yjs state of a tree document (name = tree id). */
@Schema({ collection: 'ydocs' })
export class YDocState {
  @Prop({ required: true, unique: true })
  name!: string;

  @Prop({ type: Buffer, required: true })
  state!: Buffer;

  @Prop({ default: () => new Date() })
  updatedAt!: Date;
}
export type YDocStateDocument = HydratedDocument<YDocState>;
export const YDocStateSchema = SchemaFactory.createForClass(YDocState);
