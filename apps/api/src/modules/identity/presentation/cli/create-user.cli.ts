import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { randomBytes } from 'node:crypto';
import { AppModule } from '../../../../app.module';
import { ConfigError, loadConfig } from '../../../../config/load-config';
import { loadEnvFileIfPresent } from '../../../../config/load-env-file';
import { CreateUserUseCase } from '../../application/use-cases/create-user.use-case';

/**
 * Creates a dashboard user until invitations exist:
 *   pnpm --filter @po/api user:create <organization id> <email> [owner|member]
 * Prints a generated password once.
 */
async function main(): Promise<void> {
  const [organizationId, email, role = 'owner'] = process.argv.slice(2);
  if (!organizationId || !email || (role !== 'owner' && role !== 'member')) {
    process.stderr.write('Usage: user:create <organization id> <email> [owner|member]\n');
    process.exit(1);
  }

  loadEnvFileIfPresent();
  const app = await NestFactory.createApplicationContext(
    AppModule.register(loadConfig(process.env)),
    { logger: ['error'] },
  );
  try {
    const password = randomBytes(12).toString('base64url');
    const user = await app
      .get(CreateUserUseCase)
      .execute({ organizationId, email, password, role });
    process.stdout.write(
      [
        `User:     ${user.email} (${user.role})`,
        `Password: ${password}`,
        'Store the password now: it is not shown again.',
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
