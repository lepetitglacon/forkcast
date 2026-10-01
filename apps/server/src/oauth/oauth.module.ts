import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { OAuthController } from './oauth.controller';
import { OAuthProviderService } from './oauth-provider.service';
import { OAuthClient, OAuthClientSchema, OAuthCode, OAuthCodeSchema, OAuthPendingRequest, OAuthPendingRequestSchema, OAuthToken, OAuthTokenSchema } from './schemas';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: OAuthClient.name, schema: OAuthClientSchema },
      { name: OAuthPendingRequest.name, schema: OAuthPendingRequestSchema },
      { name: OAuthCode.name, schema: OAuthCodeSchema },
      { name: OAuthToken.name, schema: OAuthTokenSchema },
    ]),
  ],
  controllers: [OAuthController],
  providers: [OAuthProviderService],
  exports: [OAuthProviderService],
})
export class OAuthModule {}
