import { beforeEach, describe, expect, it } from 'vitest';
import { REGISTRY_KEY, readRegistry, removeRegistryEntry, touchRegistryEntry, upsertRegistryEntry, writeRegistry } from './registry';

describe('local registry', () => {
  beforeEach(() => {
    localStorage.clear();
    writeRegistry([]);
  });

  it('starts empty and ignores corrupted storage', () => {
    localStorage.setItem(REGISTRY_KEY, '{not json');
    expect(readRegistry()).toEqual([]);
    localStorage.setItem(REGISTRY_KEY, JSON.stringify([{ id: 'a', title: 'A', updatedAt: 1 }, { nope: true }, 'x']));
    expect(readRegistry()).toEqual([{ id: 'a', title: 'A', updatedAt: 1 }]);
  });

  it('upserts, orders by recency and keeps a stable reference while unchanged', () => {
    upsertRegistryEntry({ id: 'a', title: 'A', updatedAt: 1 });
    upsertRegistryEntry({ id: 'b', title: 'B', updatedAt: 5 });
    const first = readRegistry();
    expect(first.map((e) => e.id)).toEqual(['b', 'a']);
    expect(readRegistry()).toBe(first);
    upsertRegistryEntry({ id: 'a', title: 'A2', updatedAt: 9 });
    expect(readRegistry().map((e) => e.title)).toEqual(['A2', 'B']);
  });

  it('touches and removes entries', () => {
    upsertRegistryEntry({ id: 'a', title: 'A', updatedAt: 1 });
    touchRegistryEntry('a', { title: 'Renamed' });
    expect(readRegistry()[0]).toEqual({ id: 'a', title: 'Renamed', updatedAt: 1 });
    touchRegistryEntry('missing', { title: 'x' });
    expect(readRegistry()).toHaveLength(1);
    removeRegistryEntry('a');
    expect(readRegistry()).toEqual([]);
    expect(JSON.parse(localStorage.getItem(REGISTRY_KEY) ?? '[]')).toEqual([]);
  });
});
