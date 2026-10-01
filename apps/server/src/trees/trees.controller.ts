import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, UseGuards } from '@nestjs/common';
import {
  CreateInvitationInputSchema,
  CreateTreeInputSchema,
  UpdateMemberInputSchema,
  UpdateTreeInputSchema,
  type CreateInvitationInput,
  type CreateTreeInput,
  type InvitationDto,
  type MemberDto,
  type TreeMetaDto,
  type UpdateMemberInput,
  type UpdateTreeInput,
} from '@forkcast/shared';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../common/current-user.decorator';
import type { AuthUser } from '../common/types';
import { ZodPipe } from '../common/zod.pipe';
import { TreeTitleSyncService } from './tree-title-sync.service';
import { TreesService } from './trees.service';

@Controller('api/trees')
@UseGuards(JwtAuthGuard)
export class TreesController {
  constructor(
    private readonly trees: TreesService,
    private readonly titleSync: TreeTitleSyncService,
  ) {}

  @Get()
  list(@CurrentUser() user: AuthUser): Promise<TreeMetaDto[]> {
    return this.trees.list(user.userId);
  }

  @Post()
  create(@CurrentUser() user: AuthUser, @Body(new ZodPipe(CreateTreeInputSchema)) body: CreateTreeInput): Promise<TreeMetaDto> {
    return this.trees.create(user.userId, body);
  }

  @Get(':id')
  get(@CurrentUser() user: AuthUser, @Param('id') id: string): Promise<TreeMetaDto> {
    return this.trees.get(user.userId, id);
  }

  @Patch(':id')
  async rename(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body(new ZodPipe(UpdateTreeInputSchema)) body: UpdateTreeInput): Promise<TreeMetaDto> {
    const dto = await this.trees.rename(user.userId, id, body.title);
    await this.titleSync.setDocumentTitle(id, body.title, user.userId);
    return dto;
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(@CurrentUser() user: AuthUser, @Param('id') id: string): Promise<void> {
    await this.trees.remove(user.userId, id);
    this.titleSync.closeConnections(id);
  }

  @Get(':id/members')
  members(@CurrentUser() user: AuthUser, @Param('id') id: string): Promise<MemberDto[]> {
    return this.trees.members(user.userId, id);
  }

  @Patch(':id/members/:userId')
  updateMember(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Param('userId') targetUserId: string,
    @Body(new ZodPipe(UpdateMemberInputSchema)) body: UpdateMemberInput,
  ): Promise<MemberDto> {
    return this.trees.updateMember(user.userId, id, targetUserId, body.role);
  }

  @Delete(':id/members/:userId')
  @HttpCode(204)
  removeMember(@CurrentUser() user: AuthUser, @Param('id') id: string, @Param('userId') targetUserId: string): Promise<void> {
    return this.trees.removeMember(user.userId, id, targetUserId);
  }

  @Post(':id/invitations')
  createInvitation(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body(new ZodPipe(CreateInvitationInputSchema)) body: CreateInvitationInput,
  ): Promise<InvitationDto> {
    return this.trees.createInvitation(user.userId, id, body);
  }
}
