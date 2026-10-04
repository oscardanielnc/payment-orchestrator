import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const fromRoot = (path: string) => fileURLToPath(new URL(path, import.meta.url));

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    // Workspace packages are consumed as TypeScript source: one definition, no build step in between.
    alias: {
      '@po/contracts': fromRoot('../../packages/contracts/src/index.ts'),
      '@po/ui': fromRoot('../../packages/ui/src'),
    },
  },
  server: {
    port: 5173,
    // Same origin in development: the refresh cookie (Path=/v1/auth) works without CORS tricks.
    proxy: { '/v1': 'http://localhost:3000' },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test-setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
  },
});
