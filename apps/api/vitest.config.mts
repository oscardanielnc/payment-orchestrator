import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

// SWC compiles Nest decorators and emits the metadata the DI container reads.
// `swcrc: false` keeps the build-only `.swcrc` (which excludes specs) out of tests.
export default defineConfig({
  plugins: [
    swc.vite({
      swcrc: false,
      module: { type: 'es6' },
      jsc: {
        parser: { syntax: 'typescript', decorators: true },
        transform: { legacyDecorator: true, decoratorMetadata: true },
        target: 'es2024',
        keepClassNames: true,
      },
    }),
  ],
  test: {
    projects: [
      {
        extends: true,
        test: { name: 'unit', include: ['src/**/*.spec.ts'] },
      },
      {
        // Needs Docker: a real Postgres per run (Testcontainers).
        extends: true,
        test: {
          name: 'e2e',
          include: ['test/**/*.e2e-spec.ts'],
          globalSetup: ['test/setup/postgres.global-setup.ts'],
          hookTimeout: 120_000,
          testTimeout: 30_000,
        },
      },
    ],
  },
});
