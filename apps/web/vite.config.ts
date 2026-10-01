import { defaultClientConditions, defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { readFileSync } from 'node:fs';
import { fileURLToPath, URL } from 'node:url';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as { version: string };
/** API server proxied in dev (override with FORKCAST_DEV_API, e.g. http://localhost:3098). */
const api = process.env.FORKCAST_DEV_API ?? 'http://localhost:3000';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
    // Workspace packages are read from their TypeScript sources (no build needed, instant HMR).
    conditions: ['@forkcast/source', ...defaultClientConditions],
    dedupe: ['yjs'],
  },
  server: {
    port: 5173,
    proxy: {
      '/api': { target: api, changeOrigin: true },
      '/collab': { target: api.replace(/^http/, 'ws'), ws: true },
      '/mcp': { target: api, changeOrigin: true },
      '/oauth': { target: api, changeOrigin: true },
      '/.well-known': { target: api, changeOrigin: true },
    },
  },
  build: {
    sourcemap: true,
    chunkSizeWarningLimit: 1500,
  },
});
