import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthModule } from './auth/auth.module';
import { CollabModule } from './collab/collab.module';
import { validateEnv, Env } from './config/env';
import { HealthController } from './health.controller';
import { McpModule } from './mcp/mcp.module';
import { OAuthModule } from './oauth/oauth.module';
import { TokensModule } from './tokens/tokens.module';
import { TreesModule } from './trees/trees.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv, envFilePath: ['.env', '.env.local'] }),
    MongooseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) => ({ uri: config.get('MONGO_URI', { infer: true }) }),
    }),
    UsersModule,
    AuthModule,
    TreesModule,
    TokensModule,
    CollabModule,
    OAuthModule,
    McpModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
