import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import bcrypt from 'bcryptjs';
import type { AuthResponse, LoginInput, RegisterInput, UserDto } from '@forkcast/shared';
import { colorFor } from '../common/crypto';
import type { AuthUser } from '../common/types';
import { UsersService } from '../users/users.service';

interface JwtPayload {
  sub: string;
  email: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly users: UsersService,
    private readonly jwt: JwtService,
  ) {}

  async register(input: RegisterInput): Promise<AuthResponse> {
    const existing = await this.users.findByEmail(input.email);
    if (existing) throw new ConflictException({ statusCode: 409, message: 'Un compte existe déjà avec cet e-mail.', code: 'EMAIL_TAKEN' });
    const passwordHash = await bcrypt.hash(input.password, 10);
    const user = await this.users.create({ email: input.email, passwordHash, name: input.name, color: colorFor(input.email.toLowerCase()) });
    const dto = this.users.toDto(user);
    return { token: this.sign(dto), user: dto };
  }

  async login(input: LoginInput): Promise<AuthResponse> {
    const user = await this.users.findByEmail(input.email);
    if (!user || !(await bcrypt.compare(input.password, user.passwordHash))) {
      throw new UnauthorizedException({ statusCode: 401, message: 'E-mail ou mot de passe incorrect.', code: 'BAD_CREDENTIALS' });
    }
    const dto = this.users.toDto(user);
    return { token: this.sign(dto), user: dto };
  }

  async me(userId: string): Promise<UserDto> {
    const user = await this.users.findById(userId);
    if (!user) throw new UnauthorizedException();
    return this.users.toDto(user);
  }

  sign(user: UserDto): string {
    const payload: JwtPayload = { sub: user.id, email: user.email };
    return this.jwt.sign(payload);
  }

  /** Verify a web JWT (used by the collaboration endpoint). Returns null when invalid. */
  verify(token: string): AuthUser | null {
    try {
      const payload = this.jwt.verify<JwtPayload>(token);
      if (typeof payload.sub !== 'string') return null;
      return { userId: payload.sub, email: payload.email };
    } catch {
      return null;
    }
  }
}
