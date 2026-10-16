// PWA en Preact + TypeScript (ADR-009). En desarrollo, /api se envía a la API local (npm run api:dev).
import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';
import { fileURLToPath } from 'node:url';

const aqui = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
  root: aqui,
  plugins: [preact()],
  build: { outDir: fileURLToPath(new URL('../../dist/web', import.meta.url)), emptyOutDir: true },
  server: { port: 5173, proxy: { '/api': 'http://127.0.0.1:3000' } },
});
