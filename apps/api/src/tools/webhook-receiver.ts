import { existsSync } from 'node:fs';
import { createServer } from 'node:http';
import { dirname, join } from 'node:path';

/**
 * Developer tool (not part of the app's layers). Plays the MERCHANT receiving webhooks:
 *   pnpm --filter @po/api webhook:receiver <whsec_...> [--port 4000] [--fail 2]
 * Register http://localhost:4000/webhooks in the dashboard, then pay a charge.
 * `--fail N` answers 500 to the first N requests, to watch the retries in the dashboard.
 * It verifies signatures with docs/examples/verify-webhook-signature.mjs, the snippet merchants copy.
 */
type Verify = (body: string, header: string, secret: string) => boolean;

function repoRoot(dir = process.cwd()): string {
  while (!existsSync(join(dir, 'pnpm-workspace.yaml'))) {
    const parent = dirname(dir);
    if (parent === dir) throw new Error('Run this inside the repository');
    dir = parent;
  }
  return dir;
}

function option(name: string, fallback: number): number {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? fallback : Number(process.argv[index + 1]);
}

async function main(): Promise<void> {
  const secret = process.argv[2] ?? process.env.WEBHOOK_RECEIVER_SECRET;
  if (!secret?.startsWith('whsec_')) {
    throw new Error('Usage: webhook:receiver <whsec_...> [--port 4000] [--fail N]');
  }
  const port = option('port', 4000);
  let failuresLeft = option('fail', 0);

  const snippet = join(repoRoot(), 'docs/examples/verify-webhook-signature.mjs');
  // A plain path: this tool compiles to CommonJS, where import() becomes require(), and
  // Node 24 can require an ES module file but not a file:// URL.
  const { verifyWebhookSignature } = (await import(snippet)) as {
    verifyWebhookSignature: Verify;
  };

  createServer((req, res) => {
    let body = '';
    req.on('data', (chunk: Buffer) => (body += chunk.toString('utf8')));
    req.on('end', () => {
      const valid = verifyWebhookSignature(body, String(req.headers['po-signature']), secret);
      const event = (valid ? JSON.parse(body) : {}) as { id?: string; type?: string };
      const fail = valid && failuresLeft > 0;
      if (fail) failuresLeft -= 1;
      res.statusCode = !valid ? 400 : fail ? 500 : 200;
      res.end();
      process.stdout.write(
        `${new Date().toLocaleTimeString()}  ${valid ? '✔ signature ok' : '✘ bad signature'}  ` +
          `${event.type ?? '-'}  ${event.id ?? ''}  → ${res.statusCode}${fail ? ' (simulated failure)' : ''}\n`,
      );
    });
  }).listen(port, () => {
    process.stdout.write(`Listening on http://localhost:${port}/webhooks (Ctrl+C to stop)\n`);
  });
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});
