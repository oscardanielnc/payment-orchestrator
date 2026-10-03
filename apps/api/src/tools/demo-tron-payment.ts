import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ConfigError, loadConfig } from '../config/load-config';
import { loadEnvFileIfPresent } from '../config/load-env-file';
import { GetChargeUseCase } from '../modules/charges/application/use-cases/get-charge.use-case';
import { CreateChargeUseCase } from '../modules/charges/application/use-cases/create-charge.use-case';
import { CreateOrganizationUseCase } from '../modules/identity/application/use-cases/create-organization.use-case';
import { StartPaymentAttemptUseCase } from '../modules/payments/application/use-cases/start-payment-attempt.use-case';
import { WorkerModule } from '../worker/worker.module';
import { createTronPayer, tronscanTx } from './tron-payer-client';

/**
 * Developer tool: the whole USDT flow on Nile in one command, using the real use cases.
 * Boots the worker in-process (chain watcher, inbound queue, outbox relay), so nothing else
 * needs to be running apart from Postgres and Redis.
 *   pnpm --filter @po/api demo:tron [amount in minor units, default 1000000 = 1 USDT]
 */
const POLL_MS = 10_000;
const TIMEOUT_MS = 5 * 60_000;
const log = (line: string) => process.stdout.write(`${line}\n`);
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function main(): Promise<void> {
  const amount = process.argv[2] ?? '1000000';
  loadEnvFileIfPresent();
  const config = loadConfig(process.env);
  if (!config.tron)
    throw new Error('TRON is not configured (see docs/runbooks/test-a-payment-on-nile.md)');

  const payer = await createTronPayer(config.tron);
  const { trx, usdtUnits } = await payer.balances();
  log(`Payer ${payer.address}: ${trx} TRX, ${usdtUnits} USDT units`);
  if (usdtUnits < BigInt(amount) || trx < 30) {
    throw new Error(
      'Fund the payer with test USDT and at least 30 TRX at https://nileex.io/join/getJoinPage',
    );
  }

  const app = await NestFactory.createApplicationContext(WorkerModule.register(config), {
    logger: ['error', 'warn'],
  });
  try {
    const org = await app
      .get(CreateOrganizationUseCase)
      .execute({ name: `Demo ${new Date().toISOString()}` });
    log(`1. Organization ${org.organization.name}`);

    const charge = await app.get(CreateChargeUseCase).execute({
      organizationId: org.organization.id,
      amount,
      currency: 'USDT',
      reference: 'demo',
    });
    log(`2. Charge ${charge.id}: ${amount} USDT units, status ${charge.status}`);

    const attempt = await app
      .get(StartPaymentAttemptUseCase)
      .execute({ organizationId: org.organization.id, chargeId: charge.id, method: 'usdt_tron' });
    if (attempt.instructions.type !== 'crypto_transfer') throw new Error('Unexpected instructions');
    const address = attempt.instructions.address;
    log(`3. Attempt routed to ${attempt.provider}; deposit address ${address}`);

    const txid = await payer.pay(address, amount);
    log(`4. Customer paid: ${tronscanTx(txid)}`);
    log('5. Waiting for the block to be solidified (about a minute)...');

    const deadline = Date.now() + TIMEOUT_MS;
    while (Date.now() < deadline) {
      await sleep(POLL_MS);
      const current = await app
        .get(GetChargeUseCase)
        .execute({ organizationId: org.organization.id, chargeId: charge.id });
      log(`   status ${current.status}`);
      if (current.status === 'succeeded') {
        log('6. Paid: charge succeeded and charge.succeeded is in the outbox.');
        return;
      }
    }
    throw new Error('Not confirmed within 5 minutes; check the transaction on Tronscan');
  } finally {
    await app.close();
  }
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof ConfigError ? error.message : String(error)}\n`);
  process.exit(1);
});
