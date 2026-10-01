import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CollabModule } from '../collab/collab.module';
import { OAuthModule } from '../oauth/oauth.module';
import { TokensModule } from '../tokens/tokens.module';
import { TreesModule } from '../trees/trees.module';
import { McpAuthService } from './mcp-auth.service';
import { McpOperation, McpOperationSchema } from './mcp-log.schema';
import { McpController } from './mcp.controller';
import { McpRateLimiter } from './rate-limiter';
import { TreeOpsService } from './tree-ops.service';

@Module({
  imports: [MongooseModule.forFeature([{ name: McpOperation.name, schema: McpOperationSchema }]), TokensModule, OAuthModule, CollabModule, TreesModule],
  controllers: [McpController],
  providers: [McpAuthService, McpRateLimiter, TreeOpsService],
  exports: [TreeOpsService],
})
export class McpModule {}
