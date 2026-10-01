import { createHash, randomBytes } from 'node:crypto';

const ALPHABET = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';

/** URL-safe random string of the given length (base62). */
export function randomToken(length = 32): string {
  const bytes = randomBytes(length);
  let out = '';
  for (let i = 0; i < length; i++) out += ALPHABET[bytes[i]! % ALPHABET.length];
  return out;
}

export function sha256(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}

const PALETTE = ['#ef4444', '#f97316', '#f59e0b', '#84cc16', '#10b981', '#06b6d4', '#3b82f6', '#8b5cf6', '#d946ef', '#ec4899'];

/** Stable presence color for a user. */
export function colorFor(seed: string): string {
  const hash = sha256(seed);
  return PALETTE[Number.parseInt(hash.slice(0, 8), 16) % PALETTE.length]!;
}
