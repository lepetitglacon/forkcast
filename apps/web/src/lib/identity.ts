import { useMemo } from 'react';
import { newId, type Actor } from '@forkcast/doc';
import { useAuth } from './auth';
import { presenceColorFor } from './utils';

export const LOCAL_IDENTITY_KEY = 'forkcast:local-identity';

export interface LocalIdentity {
  id: string;
  label: string;
  color: string;
}

let cached: LocalIdentity | null = null;

function isIdentity(value: unknown): value is LocalIdentity {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as LocalIdentity).id === 'string' &&
    (value as LocalIdentity).id.length > 0 &&
    typeof (value as LocalIdentity).label === 'string' &&
    typeof (value as LocalIdentity).color === 'string'
  );
}

/** Stable identity of this device, used as author when nobody is signed in. */
export function getLocalIdentity(): LocalIdentity {
  if (cached) return cached;
  try {
    const raw = localStorage.getItem(LOCAL_IDENTITY_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : null;
    if (isIdentity(parsed)) {
      cached = parsed;
      return parsed;
    }
  } catch {
    // unreadable storage: a new identity is generated below
  }
  const id = `local-${newId()}`;
  const identity: LocalIdentity = { id, label: 'Moi', color: presenceColorFor(id) };
  try {
    localStorage.setItem(LOCAL_IDENTITY_KEY, JSON.stringify(identity));
  } catch {
    // private mode: the identity only lives for this session
  }
  cached = identity;
  return identity;
}

/** Forget the cached identity (tests). */
export function resetLocalIdentityCache(): void {
  cached = null;
}

/** Author of the changes made from this client: the signed-in user, or the device identity. */
export function useActor(): Actor {
  const { user } = useAuth();
  return useMemo<Actor>(() => {
    if (user) return { actor: 'user', actorId: user.id, actorLabel: user.name, color: user.color };
    const local = getLocalIdentity();
    return { actor: 'user', actorId: local.id, actorLabel: local.label, color: local.color };
  }, [user]);
}
