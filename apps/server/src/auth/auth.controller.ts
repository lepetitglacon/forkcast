import { Body, Controller, Get, HttpCode, Post, UseGuards } from '@nestjs/common';
import { LoginInputSchema, RegisterInputSchema, AuthResponse, LoginInput, RegisterInput, UserDto } from '@forkcast/shared';
import { CurrentUser } from '../common/current-user.decorator';
import type { AuthUser } from '../common/types';
import { ZodPipe } from '../common/zod.pipe';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';

@Controller('api/auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('register')
  register(@Body(new ZodPipe(RegisterInputSchema)) body: RegisterInput): Promise<AuthResponse> {
    return this.auth.register(body);
  }

  @Post('login')
  @HttpCode(200)
  login(@Body(new ZodPipe(LoginInputSchema)) body: LoginInput): Promise<AuthResponse> {
    return this.auth.login(body);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  me(@CurrentUser() user: AuthUser): Promise<UserDto> {
    return this.auth.me(user.userId);
  }
}
