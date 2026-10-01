import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { McpToken, McpTokenSchema } from './token.schema';
import { TokensController } from './tokens.controller';
import { TokensService } from './tokens.service';

@Module({
  imports: [MongooseModule.forFeature([{ name: McpToken.name, schema: McpTokenSchema }])],
  controllers: [TokensController],
  providers: [TokensService],
  exports: [TokensService],
})
export class TokensModule {}
