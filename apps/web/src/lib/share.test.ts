import { describe, expect, it } from 'vitest';
import { buildSnapshot, createDocFromJson, docToJson, exampleTreeJson } from '@forkcast/doc';
import { decodeShareHash, encodeShareUrl, SHARE_HASH_PREFIX } from './share';

describe('share links', () => {
  it('round-trips a tree through the URL hash', () => {
    const doc = createDocFromJson(exampleTreeJson());
    const tree = buildSnapshot(doc);
    const url = encodeShareUrl(tree, 'https://forkcast.example');
    expect(url.startsWith(`https://forkcast.example/${SHARE_HASH_PREFIX}`)).toBe(true);
    const hash = url.slice(url.indexOf('#'));
    const decoded = decodeShareHash(hash);
    expect(decoded).toEqual(docToJson(doc));
    const copy = createDocFromJson(decoded);
    expect(buildSnapshot(copy).meta.title).toBe('Ajouter le paiement en ligne');
  });

  it('rejects foreign or broken hashes', () => {
    expect(decodeShareHash('')).toBeNull();
    expect(decodeShareHash('#other=1')).toBeNull();
    expect(decodeShareHash('#share=')).toBeNull();
    expect(decodeShareHash('#share=not-really-compressed')).toBeNull();
  });
});
