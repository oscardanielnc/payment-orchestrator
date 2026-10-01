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
    include: ['src/**/*.spec.ts', 'test/**/*.e2e-spec.ts'],
  },
});
