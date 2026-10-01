import { defineConfig } from 'tsup';

export default defineConfig((options) => ({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  sourcemap: true,
  // Wiping dist in watch mode would break the server and Vite while they start.
  clean: !options.watch,
  treeshake: true,
}));
