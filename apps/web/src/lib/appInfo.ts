/** Version of the web app (from apps/web/package.json, injected by Vite). */
export const APP_VERSION: string = typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : '0.0.0';

export const KOFI_URL: string = import.meta.env.VITE_KOFI_URL || 'https://ko-fi.com/';

/** Source repository (link hidden when not configured). */
export const REPO_URL: string | null = import.meta.env.VITE_REPO_URL || null;
