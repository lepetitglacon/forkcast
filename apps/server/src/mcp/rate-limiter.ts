import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../config/env';

/** In-memory sliding-window limiter (per credential, per minute). */
@Injectable()
export class McpRateLimiter {
  private readonly windows = new Map<string, number[]>();
  readonly limit: number;
  readonly windowMs = 60_000;

  constructor(config: ConfigService<Env, true>) {
    this.limit = config.get('MCP_RATE_LIMIT', { infer: true });
  }

  allow(key: string, now = Date.now()): boolean {
    const since = now - this.windowMs;
    const hits = (this.windows.get(key) ?? []).filter((t) => t > since);
    if (hits.length >= this.limit) {
      this.windows.set(key, hits);
      return false;
    }
    hits.push(now);
    this.windows.set(key, hits);
    if (this.windows.size > 10_000) this.windows.clear();
    return true;
  }
}
