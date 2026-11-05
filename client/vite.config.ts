/**
 * Vite config — builds the client straight into `../app/static`, which is the
 * directory the Databricks App serves.
 *
 * `emptyOutDir: false` is deliberate: `app/static` also holds hand-managed
 * assets that Vite knows nothing about (`fonts/`, `arch/architecture-viewer.html`),
 * and wiping them on every build would silently delete the self-hosted fonts and
 * the vendored architecture renderer.
 */
import path from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: { alias: { '@': path.resolve(__dirname, 'src') } },
  build: {
    outDir: path.resolve(__dirname, '../app/static'),
    emptyOutDir: false,
    assetsDir: 'assets',
    sourcemap: false,
  },
  server: {
    port: 5273,
    // Local dev: proxy the API to a `node app/server.mjs` running on 8765 so the
    // dev page exercises the same /api/me path the deployed app does.
    proxy: { '/api': 'http://127.0.0.1:8765', '/arch': 'http://127.0.0.1:8765' },
  },
});
