import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { OAuthDecisionInputSchema, OAuthConsentDto, OAuthDecisionInput } from '@forkcast/shared';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../common/current-user.decorator';
import type { AuthUser } from '../common/types';
import { ZodPipe } from '../common/zod.pipe';
import { OAuthProviderService } from './oauth-provider.service';

/** Consent API used by the web app (`/oauth/consent?request=…`). */
@Controller('api/oauth')
@UseGuards(JwtAuthGuard)
export class OAuthController {
  constructor(private readonly provider: OAuthProviderService) {}

  @Get('consent/:requestId')
  consent(@Param('requestId') requestId: string): Promise<OAuthConsentDto> {
    return this.provider.consent(requestId);
  }

  @Post('decision')
  async decide(@CurrentUser() user: AuthUser, @Body(new ZodPipe(OAuthDecisionInputSchema)) body: OAuthDecisionInput): Promise<{ redirectTo: string }> {
    return { redirectTo: await this.provider.decide(user.userId, body.requestId, body.approve) };
  }
}
