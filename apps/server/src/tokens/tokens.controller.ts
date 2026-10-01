import { Body, Controller, Delete, Get, HttpCode, Param, Post, UseGuards } from '@nestjs/common';
import { CreateTokenInputSchema, CreateTokenInput, TokenCreatedDto, TokenDto } from '@forkcast/shared';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../common/current-user.decorator';
import type { AuthUser } from '../common/types';
import { ZodPipe } from '../common/zod.pipe';
import { TokensService } from './tokens.service';

@Controller('api/tokens')
@UseGuards(JwtAuthGuard)
export class TokensController {
  constructor(private readonly tokens: TokensService) {}

  @Get()
  list(@CurrentUser() user: AuthUser): Promise<TokenDto[]> {
    return this.tokens.list(user.userId);
  }

  @Post()
  create(@CurrentUser() user: AuthUser, @Body(new ZodPipe(CreateTokenInputSchema)) body: CreateTokenInput): Promise<TokenCreatedDto> {
    return this.tokens.create(user.userId, body);
  }

  @Delete(':id')
  @HttpCode(204)
  revoke(@CurrentUser() user: AuthUser, @Param('id') id: string): Promise<void> {
    return this.tokens.revoke(user.userId, id);
  }
}
