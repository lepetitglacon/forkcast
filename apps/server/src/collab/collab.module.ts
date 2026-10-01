import { Module, forwardRef } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { TokensModule } from '../tokens/tokens.module';
import { TreesModule } from '../trees/trees.module';
import { CollabService } from './collab.service';

@Module({
  imports: [AuthModule, TokensModule, forwardRef(() => TreesModule)],
  providers: [CollabService],
  exports: [CollabService],
})
export class CollabModule {}
