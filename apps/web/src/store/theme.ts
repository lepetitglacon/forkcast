import { useSyncExternalStore } from 'react';
import { useUiStore } from './ui';

function mediaQuery(): MediaQueryList | null {
  return typeof window !== 'undefined' && 'matchMedia' in window
    ? window.matchMedia('(prefers-color-scheme: dark)')
    : null;
}

function subscribeSystemTheme(listener: () => void): () => void {
  const mql = mediaQuery();
  if (!mql) return () => {};
  mql.addEventListener('change', listener);
  return () => mql.removeEventListener('change', listener);
}

function systemPrefersDark(): boolean {
  return mediaQuery()?.matches ?? false;
}

export type ResolvedTheme = 'light' | 'dark';

/** Effective theme: the explicit choice, or the OS preference when set to "system". */
export function useResolvedTheme(): ResolvedTheme {
  const theme = useUiStore((s) => s.theme);
  const systemDark = useSyncExternalStore(subscribeSystemTheme, systemPrefersDark, () => false);
  if (theme === 'system') return systemDark ? 'dark' : 'light';
  return theme;
}
