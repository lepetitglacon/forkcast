import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Schema as MongooseSchema, HydratedDocument } from 'mongoose';

/** Dynamically registered OAuth client (full RFC 7591 metadata kept as-is). */
@Schema({ timestamps: true, collection: 'oauth_clients' })
export class OAuthClient {
  @Prop({ required: true, unique: true })
  clientId!: string;

  @Prop({ type: MongooseSchema.Types.Mixed, required: true })
  info!: Record<string, unknown>;
}
export type OAuthClientDocument = HydratedDocument<OAuthClient>;
export const OAuthClientSchema = SchemaFactory.createForClass(OAuthClient);

/** Authorization request waiting for the user's consent on the web app. */
@Schema({ collection: 'oauth_requests' })
export class OAuthPendingRequest {
  @Prop({ required: true, unique: true })
  requestId!: string;

  @Prop({ required: true })
  clientId!: string;

  @Prop({ type: MongooseSchema.Types.Mixed, required: true })
  params!: {
    state?: string;
    scopes?: string[];
    codeChallenge: string;
    redirectUri: string;
    resource?: string;
  };

  @Prop({ required: true })
  expiresAt!: Date;
}
export type OAuthPendingRequestDocument = HydratedDocument<OAuthPendingRequest>;
export const OAuthPendingRequestSchema = SchemaFactory.createForClass(OAuthPendingRequest);
OAuthPendingRequestSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

@Schema({ collection: 'oauth_codes' })
export class OAuthCode {
  @Prop({ required: true, unique: true })
  code!: string;

  @Prop({ required: true })
  clientId!: string;

  @Prop({ required: true })
  userId!: string;

  @Prop({ type: [String], required: true })
  scopes!: string[];

  @Prop({ required: true })
  codeChallenge!: string;

  @Prop({ required: true })
  redirectUri!: string;

  @Prop()
  resource?: string;

  @Prop({ required: true })
  expiresAt!: Date;
}
export type OAuthCodeDocument = HydratedDocument<OAuthCode>;
export const OAuthCodeSchema = SchemaFactory.createForClass(OAuthCode);
OAuthCodeSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

/** Access and refresh tokens (hashed). */
@Schema({ collection: 'oauth_tokens' })
export class OAuthToken {
  @Prop({ required: true, unique: true })
  hash!: string;

  @Prop({ type: String, required: true, enum: ['access', 'refresh'] })
  kind!: 'access' | 'refresh';

  @Prop({ required: true })
  clientId!: string;

  @Prop({ required: true })
  userId!: string;

  @Prop({ type: [String], required: true })
  scopes!: string[];

  @Prop()
  resource?: string;

  @Prop({ required: true })
  expiresAt!: Date;
}
export type OAuthTokenDocument = HydratedDocument<OAuthToken>;
export const OAuthTokenSchema = SchemaFactory.createForClass(OAuthToken);
OAuthTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
