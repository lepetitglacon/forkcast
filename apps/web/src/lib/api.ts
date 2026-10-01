import { getToken } from './token';

export const API_BASE_URL: string = import.meta.env.VITE_API_URL ?? '';

/** Public URL of the server (used for the MCP configuration snippets). */
export function publicServerUrl(): string {
  return (API_BASE_URL || window.location.origin).replace(/\/+$/, '');
}

export class ApiRequestError extends Error {
  override readonly name = 'ApiRequestError';
  constructor(
    readonly status: number,
    message: string,
    readonly code?: string,
    readonly payload?: unknown,
  ) {
    super(message);
  }
}

function extractMessage(data: unknown, status: number): string {
  if (typeof data === 'object' && data !== null) {
    const msg = (data as { message?: unknown }).message;
    if (Array.isArray(msg)) return msg.map(String).join(' ; ');
    if (typeof msg === 'string' && msg.length > 0) return msg;
    const err = (data as { error?: unknown }).error;
    if (typeof err === 'string' && err.length > 0) return err;
  }
  if (typeof data === 'string' && data.length > 0) return data;
  switch (status) {
    case 400:
      return 'Requête invalide';
    case 401:
      return 'Authentification requise';
    case 403:
      return 'Accès refusé';
    case 404:
      return 'Ressource introuvable';
    case 409:
      return 'Conflit';
    case 502:
    case 503:
    case 504:
      return 'Serveur indisponible pour le moment';
    default:
      return `Erreur ${status}`;
  }
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json' };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch (error) {
    throw new ApiRequestError(0, 'Impossible de joindre le serveur', 'NETWORK', error);
  }
  const text = await res.text();
  let data: unknown = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }
  if (!res.ok) {
    const code =
      typeof data === 'object' && data !== null && typeof (data as { code?: unknown }).code === 'string'
        ? (data as { code: string }).code
        : undefined;
    throw new ApiRequestError(res.status, extractMessage(data, res.status), code, data);
  }
  return data as T;
}

export const api = {
  get: <T>(path: string) => request<T>('GET', path),
  post: <T>(path: string, body?: unknown) => request<T>('POST', path, body ?? {}),
  patch: <T>(path: string, body?: unknown) => request<T>('PATCH', path, body ?? {}),
  put: <T>(path: string, body?: unknown) => request<T>('PUT', path, body ?? {}),
  delete: <T = void>(path: string) => request<T>('DELETE', path),
};
