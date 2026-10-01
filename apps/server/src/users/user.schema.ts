import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import type { HydratedDocument } from 'mongoose';

@Schema({ timestamps: true, collection: 'users' })
export class User {
  @Prop({ required: true, unique: true, lowercase: true, trim: true })
  email!: string;

  @Prop({ required: true })
  passwordHash!: string;

  @Prop({ required: true, trim: true })
  name!: string;

  @Prop({ required: true })
  color!: string;
}

export type UserDocument = HydratedDocument<User>;
export const UserSchema = SchemaFactory.createForClass(User);
