import { isDocError, type DocErrorCode } from '@forkcast/doc';
import { ApiRequestError } from './api';

const DOC_ERROR_MESSAGES: Record<DocErrorCode, string> = {
  NOT_INITIALIZED: 'Le document n’est pas encore initialisé.',
  NODE_NOT_FOUND: 'Nœud introuvable (il a peut-être été supprimé par un autre participant).',
  CRITERION_NOT_FOUND: 'Critère inconnu.',
  CRITERION_EXISTS: 'Ce critère existe déjà.',
  INVALID_MOVE: 'Déplacement impossible : un nœud ne peut pas être déplacé dans sa propre branche.',
  ROOT_IMMUTABLE: 'La racine ne peut pas être modifiée de cette façon.',
  HAS_CHILDREN: 'Ce nœud a encore des enfants : déplacez-les ou supprimez-les avant d’en faire une feuille.',
  VALIDATION: 'Données invalides.',
  LIMIT_EXCEEDED: 'Limite de taille dépassée.',
  ID_CONFLICT: 'Conflit d’identifiant.',
  UNSUPPORTED_VERSION: 'Version de document non prise en charge par cette application.',
};

export interface ErrorDescription {
  title: string;
  description?: string;
}

/** French title + technical description for any error thrown by the doc layer or the API. */
export function describeError(error: unknown, fallback = 'Une erreur est survenue'): ErrorDescription {
  if (isDocError(error)) {
    const code = error.code as DocErrorCode;
    return { title: DOC_ERROR_MESSAGES[code] ?? fallback, description: error.message };
  }
  if (error instanceof ApiRequestError) {
    if (error.status === 401) return { title: 'Connexion requise', description: error.message };
    if (error.status === 403) return { title: 'Accès refusé', description: error.message };
    if (error.status === 404) return { title: 'Introuvable', description: error.message };
    if (error.status === 0) return { title: 'Serveur injoignable', description: error.message };
    if (error.status >= 502 && error.status <= 504) return { title: 'Serveur indisponible', description: `Erreur ${error.status}` };
    return { title: error.message || fallback };
  }
  if (error instanceof Error) return { title: fallback, description: error.message };
  return { title: fallback };
}

export function errorMessage(error: unknown, fallback = 'Une erreur est survenue'): string {
  const d = describeError(error, fallback);
  return d.description && d.description !== d.title ? `${d.title} — ${d.description}` : d.title;
}
