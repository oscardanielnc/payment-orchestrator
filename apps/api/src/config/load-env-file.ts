import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';

/**
 * Loads the repo-root `.env` into `process.env` when present (local development).
 * Walks up from `startDir` until it finds the workspace root. Real environments
 * set variables directly and have no `.env` file.
 */
export function loadEnvFileIfPresent(startDir = process.cwd()): void {
  let dir = startDir;
  while (!existsSync(join(dir, 'pnpm-workspace.yaml'))) {
    const parent = dirname(dir);
    if (parent === dir) return;
    dir = parent;
  }
  const envFile = join(dir, '.env');
  if (existsSync(envFile)) process.loadEnvFile(envFile);
}
