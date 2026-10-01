import { ConfigService } from '@nestjs/config';
import { McpRateLimiter } from './rate-limiter';

describe('McpRateLimiter', () => {
  it('allows up to the limit per minute, per key', () => {
    const config = { get: () => 3 } as unknown as ConfigService;
    const limiter = new McpRateLimiter(config as never);
    const t0 = 1_000_000;
    expect(limiter.allow('a', t0)).toBe(true);
    expect(limiter.allow('a', t0 + 1)).toBe(true);
    expect(limiter.allow('a', t0 + 2)).toBe(true);
    expect(limiter.allow('a', t0 + 3)).toBe(false);
    expect(limiter.allow('b', t0 + 3)).toBe(true);
    expect(limiter.allow('a', t0 + 60_001)).toBe(true);
  });
});
