import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CollabModule } from '../collab/collab.module';
import { UsersModule } from '../users/users.module';
import { AccessService } from './access.service';
import { InvitationsController } from './invitations.controller';
import { Invitation, InvitationSchema, Membership, MembershipSchema, TreeEntity, TreeEntitySchema, YDocState, YDocStateSchema } from './schemas';
import { TreeTitleSyncService } from './tree-title-sync.service';
import { TreesController } from './trees.controller';
import { TreesService } from './trees.service';
import { YDocStoreService } from './ydoc-store.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: TreeEntity.name, schema: TreeEntitySchema },
      { name: Membership.name, schema: MembershipSchema },
      { name: Invitation.name, schema: InvitationSchema },
      { name: YDocState.name, schema: YDocStateSchema },
    ]),
    UsersModule,
    forwardRef(() => CollabModule),
  ],
  controllers: [TreesController, InvitationsController],
  providers: [TreesService, AccessService, YDocStoreService, TreeTitleSyncService],
  exports: [TreesService, AccessService, YDocStoreService],
})
export class TreesModule {}
