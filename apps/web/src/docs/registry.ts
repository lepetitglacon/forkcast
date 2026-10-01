import { useSyncExternalStore } from 'react';

export interface RegistryEntry {
  id: string;
  title: string;
  updatedAt: number;
}

export const REGISTRY_KEY = 'forkcast:registry';

const listeners = new Set<() => void>();
let cache: { raw: string | null; entries: RegistryEntry[] } | null = null;

function safeRead(): string | null {
  try {
    return localStorage.getItem(REGISTRY_KEY);
  } catch {
    return null;
  }
}

function parse(raw: string | null): RegistryEntry[] {
  if (!raw) return [];
  try {
    const data: unknown = JSON.parse(raw);
    if (!Array.isArray(data)) return [];
    const entries: RegistryEntry[] = [];
    for (const item of data) {
      if (typeof item !== 'object' || item === null) continue;
      const { id, title, updatedAt } = item as Record<string, unknown>;
      if (typeof id !== 'string' || id.length === 0) continue;
      entries.push({
        id,
        title: typeof title === 'string' ? title : '',
        updatedAt: typeof updatedAt === 'number' ? updatedAt : 0,
      });
    }
    return entries.sort((a, b) => b.updatedAt - a.updatedAt);
  } catch {
    return [];
  }
}

function notify(): void {
  for (const l of listeners) l();
}

/** Local trees known on this device, most recent first (stable reference while unchanged). */
export function readRegistry(): RegistryEntry[] {
  const raw = safeRead();
  if (cache && cache.raw === raw) return cache.entries;
  const entries = parse(raw);
  cache = { raw, entries };
  return entries;
}

export function writeRegistry(entries: RegistryEntry[]): void {
  const sorted = [...entries].sort((a, b) => b.updatedAt - a.updatedAt);
  const raw = JSON.stringify(sorted);
  try {
    localStorage.setItem(REGISTRY_KEY, raw);
  } catch {
    // storage full or unavailable: keep the in-memory view consistent anyway
  }
  cache = { raw, entries: sorted };
  notify();
}

export function upsertRegistryEntry(entry: RegistryEntry): void {
  const entries = readRegistry().filter((e) => e.id !== entry.id);
  writeRegistry([...entries, entry]);
}

/** Update title and/or timestamp of an existing entry (no-op when unknown). */
export function touchRegistryEntry(
  id: string,
  patch: Partial<Pick<RegistryEntry, 'title' | 'updatedAt'>>,
): void {
  const entries = readRegistry();
  const current = entries.find((e) => e.id === id);
  if (!current) return;
  const next: RegistryEntry = { ...current, ...patch };
  if (next.title === current.title && next.updatedAt === current.updatedAt) return;
  writeRegistry([...entries.filter((e) => e.id !== id), next]);
}

export function removeRegistryEntry(id: string): void {
  const entries = readRegistry();
  if (!entries.some((e) => e.id === id)) return;
  writeRegistry(entries.filter((e) => e.id !== id));
}

export function subscribeRegistry(listener: () => void): () => void {
  listeners.add(listener);
  const onStorage = (e: StorageEvent) => {
    if (e.key === null || e.key === REGISTRY_KEY) listener();
  };
  window.addEventListener('storage', onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener('storage', onStorage);
  };
}

export function useRegistry(): RegistryEntry[] {
  return useSyncExternalStore(subscribeRegistry, readRegistry, readRegistry);
}
