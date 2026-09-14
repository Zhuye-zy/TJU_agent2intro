import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

const project = fileURLToPath(new URL('../../..', import.meta.url));
const frontend = fileURLToPath(new URL('../..', import.meta.url));
const shared = fileURLToPath(new URL('../../../shared', import.meta.url));

export default defineConfig({
  root: frontend,
  envDir: false,
  server: {
    host: '127.0.0.1',
    strictPort: true,
    fs: { allow: [frontend, shared], deny: ['**/.env*', '**/.runtime/**'] },
    proxy: { '/api': { target: `http://127.0.0.1:${process.env.AI4TJU_API_PORT ?? '8002'}` } },
  },
  cacheDir: `${project}/.runtime/vite-speech-probe`,
});
