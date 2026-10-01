import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import type { CreateTokenInput, McpScope, TokenCreatedDto, TokenDto } from '@forkcast/shared';
import { randomToken, sha256 } from '../common/crypto';
import { McpToken, McpTokenDocument } from './token.schema';

export const PAT_PREFIX = 'fkp_';

export interface VerifiedToken {
  id: string;
  userId: string;
  name: string;
  scopes: McpScope[];
}

@Injectable()
export class TokensService {
  constructor(@InjectModel(McpToken.name) private readonly model: Model<McpToken>) {}

  private toDto(t: McpTokenDocument): TokenDto {
    const dto: TokenDto = { id: t._id.toString(), name: t.name, scopes: t.scopes, createdAt: t.createdAt.toISOString() };
    if (t.lastUsedAt) dto.lastUsedAt = t.lastUsedAt.toISOString();
    if (t.expiresAt) dto.expiresAt = t.expiresAt.toISOString();
    return dto;
  }

  async list(userId: string): Promise<TokenDto[]> {
    const tokens = await this.model.find({ userId, revokedAt: { $exists: false } }).sort({ createdAt: -1 }).exec();
    return tokens.map((t) => this.toDto(t));
  }

  async create(userId: string, input: CreateTokenInput): Promise<TokenCreatedDto> {
    const plain = PAT_PREFIX + randomToken(40);
    const token = await this.model.create({
      userId,
      name: input.name,
      hash: sha256(plain),
      prefix: plain.slice(0, 10),
      scopes: [...new Set(input.scopes)],
      expiresAt: input.expiresInDays ? new Date(Date.now() + input.expiresInDays * 86_400_000) : undefined,
    });
    return { ...this.toDto(token), token: plain };
  }

  async revoke(userId: string, tokenId: string): Promise<void> {
    const res = await this.model.updateOne({ _id: tokenId, userId, revokedAt: { $exists: false } }, { $set: { revokedAt: new Date() } }).exec();
    if (res.matchedCount === 0) throw new NotFoundException({ statusCode: 404, message: 'Token introuvable.', code: 'TOKEN_NOT_FOUND' });
  }

  /** Resolve a plain token; null when unknown, revoked or expired. */
  async verify(plain: string): Promise<VerifiedToken | null> {
    if (!plain.startsWith(PAT_PREFIX)) return null;
    const token = await this.model.findOne({ hash: sha256(plain) }).exec();
    if (!token || token.revokedAt) return null;
    if (token.expiresAt && token.expiresAt.getTime() < Date.now()) return null;
    if (!token.lastUsedAt || Date.now() - token.lastUsedAt.getTime() > 60_000) {
      await this.model.updateOne({ _id: token._id }, { $set: { lastUsedAt: new Date() } }).exec();
    }
    return { id: token._id.toString(), userId: token.userId, name: token.name, scopes: token.scopes };
  }
}
