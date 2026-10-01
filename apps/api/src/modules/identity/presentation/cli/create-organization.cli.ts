import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../../../../app.module';
import { ConfigError, loadConfig } from '../../../../config/load-config';
import { loadEnvFileIfPresent } from '../../../../config/load-env-file';
import { CreateOrganizationUseCase } from '../../application/use-cases/create-organization.use-case';

/**
 * Bootstraps a merchant for local development until the dashboard exists:
 *   pnpm --filter @po/api org:create "Acme Coffee"
 * Prints the first API key once.
 */
async function main(): Promise<void> {
  const name = process.argv[2];
  if (!name) {
    process.stderr.write('Usage: org:create "<organization name>"\n');
    process.exit(1);
  }

  loadEnvFileIfPresent();
  const app = await NestFactory.createApplicationContext(
    AppModule.register(loadConfig(process.env)),
    {
      logger: ['error'],
    },
  );
  try {
    const result = await app.get(CreateOrganizationUseCase).execute({ name });
    process.stdout.write(
      [
        `Organization: ${result.organization.name} (${result.organization.id})`,
        `API key:      ${result.token}`,
        'Store the key now: it is not shown again.',
        '',
      ].join('\n'),
    );
  } finally {
    await app.close();
  }
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof ConfigError ? error.message : String(error)}\n`);
  process.exit(1);
});
