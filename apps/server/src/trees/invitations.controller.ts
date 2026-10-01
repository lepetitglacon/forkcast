import { Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import type { InvitationPreviewDto, TreeMetaDto } from '@forkcast/shared';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../common/current-user.decorator';
import type { AuthUser } from '../common/types';
import { TreesService } from './trees.service';

@Controller('api/invitations')
@UseGuards(JwtAuthGuard)
export class InvitationsController {
  constructor(private readonly trees: TreesService) {}

  @Get(':token')
  preview(@Param('token') token: string): Promise<InvitationPreviewDto> {
    return this.trees.previewInvitation(token);
  }

  @Post(':token/accept')
  accept(@CurrentUser() user: AuthUser, @Param('token') token: string): Promise<TreeMetaDto> {
    return this.trees.acceptInvitation(user.userId, token);
  }
}
