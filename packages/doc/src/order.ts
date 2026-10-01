import { generateKeyBetween, generateNKeysBetween } from 'fractional-indexing';

export { generateKeyBetween, generateNKeysBetween };

/** Order key to insert at `index` within `sortedKeys` (clamped to [0, length]). */
export function keyForIndex(sortedKeys: readonly string[], index: number): string {
  const i = Math.max(0, Math.min(index, sortedKeys.length));
  const before = i > 0 ? (sortedKeys[i - 1] ?? null) : null;
  const after = i < sortedKeys.length ? (sortedKeys[i] ?? null) : null;
  return generateKeyBetween(before, after);
}
