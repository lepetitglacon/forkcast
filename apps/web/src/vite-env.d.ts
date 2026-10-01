/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
  readonly VITE_WS_URL?: string;
  readonly VITE_KOFI_URL?: string;
  readonly VITE_REPO_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

/** Version of apps/web/package.json, injected by Vite `define`. */
declare const __APP_VERSION__: string;
