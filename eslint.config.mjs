import js from '@eslint/js';
import boundaries from 'eslint-plugin-boundaries';
import { defineConfig } from 'eslint/config';
import tseslint from 'typescript-eslint';

const layer = (type) => ({
  type,
  pattern: [`**/src/modules/*/${type}`, `**/src/shared/${type}`],
});

export default defineConfig(
  {
    ignores: [
      '**/dist/**',
      '**/coverage/**',
      '**/.turbo/**',
      '**/node_modules/**',
      '**/src/generated/**',
    ],
  },
  js.configs.recommended,
  tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
  },
  {
    files: ['**/*.mjs', '**/*.config.ts', '**/*.config.mts'],
    extends: [tseslint.configs.disableTypeChecked],
  },
  {
    rules: {
      'no-console': 'error',
      '@typescript-eslint/no-explicit-any': 'error',
    },
  },
  {
    // Hexagonal dependency rule (ADR 0002): every dependency points inward.
    //   presentation → application → domain ← infrastructure
    files: ['apps/api/src/**/*.ts'],
    ignores: ['**/*.spec.ts'],
    plugins: { boundaries },
    settings: {
      'import/resolver': { node: { extensions: ['.ts', '.js'] } },
      'boundaries/elements': [
        layer('domain'),
        layer('application'),
        layer('infrastructure'),
        layer('presentation'),
        { type: 'generated', pattern: '**/src/generated' },
      ],
    },
    rules: {
      'boundaries/dependencies': [
        'error',
        {
          default: 'allow',
          policies: [
            {
              from: { element: { type: 'domain' } },
              disallow: {
                to: {
                  element: {
                    types: {
                      anyOf: ['application', 'infrastructure', 'presentation', 'generated'],
                    },
                  },
                },
              },
            },
            {
              from: { element: { type: 'application' } },
              disallow: {
                to: {
                  element: { types: { anyOf: ['infrastructure', 'presentation', 'generated'] } },
                },
              },
            },
            {
              from: { element: { type: 'presentation' } },
              disallow: { to: { element: { types: { anyOf: ['infrastructure', 'generated'] } } } },
            },
          ],
        },
      ],
    },
  },
  {
    // The domain is plain TypeScript: no framework, ORM or library imports.
    files: ['apps/api/src/modules/*/domain/**/*.ts', 'apps/api/src/shared/domain/**/*.ts'],
    ignores: ['**/*.spec.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        { patterns: [{ regex: '^[^.]', message: 'The domain only imports other domain code.' }] },
      ],
    },
  },
);
