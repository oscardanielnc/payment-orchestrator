import { appendFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';

/**
 * Where dev tools put TESTNET secrets so they never appear on screen (a terminal, a log or a
 * screen share would leak them): a file in the user's home, outside the repository.
 */
export const WALLETS_FILE = join(homedir(), 'payment-orchestrator-testnet-wallets.txt');

export function saveToWalletsFile(title: string, lines: string[]): void {
  const block = [`# ${title} (${new Date().toISOString()}), TESTNET ONLY`, ...lines, ''];
  appendFileSync(WALLETS_FILE, `\n${block.join('\n')}`, { mode: 0o600 });
}

function repoEnvFile(startDir = process.cwd()): string {
  let dir = startDir;
  while (!existsSync(join(dir, 'pnpm-workspace.yaml'))) {
    const parent = dirname(dir);
    if (parent === dir) throw new Error('Run this inside the repository');
    dir = parent;
  }
  return join(dir, '.env');
}

/**
 * Sets `KEY=value` in the repo `.env` only if the key is missing or empty, so a tool never
 * silently replaces a configured wallet. Returns false when a value was already there.
 */
export function setEnvIfEmpty(key: string, value: string): boolean {
  const file = repoEnvFile();
  const content = existsSync(file) ? readFileSync(file, 'utf8') : '';
  const line = new RegExp(`^${key}=(.*)$`, 'm');
  const current = line.exec(content);
  if (current?.[1]?.trim()) return false;
  const next = current
    ? content.replace(line, `${key}=${value}`)
    : `${content.replace(/\n?$/, '\n')}${key}=${value}\n`;
  writeFileSync(file, next);
  return true;
}
