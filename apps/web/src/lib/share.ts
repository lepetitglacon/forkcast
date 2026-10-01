import { compressToEncodedURIComponent, decompressFromEncodedURIComponent } from 'lz-string';
import type { Tree } from '@forkcast/shared';
import { treeToJson } from '@forkcast/doc';

export const SHARE_HASH_PREFIX = '#share=';

/** Full URL that re-creates the tree on another device (`origin/#share=<compressed json>`). */
export function encodeShareUrl(tree: Tree, origin: string = window.location.origin): string {
  const payload = compressToEncodedURIComponent(JSON.stringify(treeToJson(tree)));
  return `${origin}/${SHARE_HASH_PREFIX}${payload}`;
}

/** Parsed (but not yet validated) tree JSON carried by a `#share=` hash, or null. */
export function decodeShareHash(hash: string): unknown | null {
  if (!hash.startsWith(SHARE_HASH_PREFIX)) return null;
  const payload = hash.slice(SHARE_HASH_PREFIX.length);
  if (!payload) return null;
  let raw: string | null;
  try {
    raw = decompressFromEncodedURIComponent(payload);
  } catch {
    return null;
  }
  if (!raw) return null;
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
}
