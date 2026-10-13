import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../../../../app.module';
import { ConfigError, loadConfig } from '../../../../config/load-config';
import { loadEnvFileIfPresent } from '../../../../config/load-env-file';
import { ReconciliationSources } from '../../application/ports/reconciliation-ports';
import { RunReconciliationUseCase } from '../../application/use-cases/run-reconciliation.use-case';
import { utcDay } from '../../domain/window';

/**
 * Operator entry point:  pnpm --filter @po/api recon:run [YYYY-MM-DD] [source]
 * Reconciles one UTC day (default: today) for one or every enabled source and prints a
 * summary. Safe to repeat: the same day gives the same findings.
 */
async function main(): Promise<void> {
  const [day, only] = process.argv.slice(2);
  const date = day ? new Date(`${day}T00:00:00Z`) : new Date();
  if (Number.isNaN(date.getTime())) throw new Error('Usage: recon:run [YYYY-MM-DD] [source]');
  const window = utcDay(date);

  loadEnvFileIfPresent();
  const app = await NestFactory.createApplicationContext(
    AppModule.register(loadConfig(process.env)),
    { logger: ['error', 'warn'] },
  );
  try {
    const sources = app
      .get(ReconciliationSources)
      .all()
      .map((s) => s.id);
    const run = app.get(RunReconciliationUseCase);
    process.stdout.write(`Window ${window.from.toISOString()} → ${window.to.toISOString()}\n`);
    for (const source of only ? [only] : sources) {
      const summary = await run.execute({ source, window });
      process.stdout.write(
        `  ${source.padEnd(13)} ${summary.matched} matched · ${summary.discrepancies} finding(s) · ${summary.opened} new\n`,
      );
    }
  } finally {
    await app.close();
  }
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof ConfigError ? error.message : String(error)}\n`);
  process.exit(1);
});
