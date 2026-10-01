import { TronWeb } from 'tronweb';
import { ConfigError, loadConfig } from '../config/load-config';
import { loadEnvFileIfPresent } from '../config/load-env-file';
import { createTronPayer, tronscanTx } from './tron-payer-client';

/**
 * Developer tool (not part of the app's layers). Plays the CUSTOMER on the Nile testnet:
 *   pnpm --filter @po/api tron:payer new                  → create a payer wallet
 *   pnpm --filter @po/api tron:payer balance               → TRX and USDT of the payer
 *   pnpm --filter @po/api tron:payer pay <address> <units> → send test USDT (minor units)
 */
async function main(): Promise<void> {
  const [command, ...args] = process.argv.slice(2);

  if (command === 'new') {
    const account = await TronWeb.createAccount();
    process.stdout.write(
      [
        'New TESTNET payer wallet:',
        `  address: ${account.address.base58}`,
        '',
        'Add to .env (testnet only):',
        `  TRON_TEST_PAYER_PRIVATE_KEY=${account.privateKey}`,
        '',
        'Fund it with test TRX and USDT at https://nileex.io/join/getJoinPage using the address above.',
        '',
      ].join('\n'),
    );
    return;
  }

  loadEnvFileIfPresent();
  const tron = loadConfig(process.env).tron;
  if (!tron)
    throw new Error(
      'TRON is not configured (TRON_FULL_HOST, TRON_USDT_CONTRACT, TRON_DEPOSIT_XPUB)',
    );
  const payer = await createTronPayer(tron);

  if (command === 'balance') {
    const { trx, usdtUnits } = await payer.balances();
    process.stdout.write(`${payer.address}\n  TRX:  ${trx}\n  USDT: ${usdtUnits} minor units\n`);
    return;
  }

  if (command === 'pay') {
    const [to, units] = args;
    if (!to || !units || !/^[1-9][0-9]*$/.test(units)) {
      throw new Error('Usage: tron:payer pay <deposit address> <amount in minor units>');
    }
    const txid = await payer.pay(to, units);
    process.stdout.write(
      [
        `Sent ${units} USDT minor units from ${payer.address} to ${to}`,
        `  tx: ${tronscanTx(txid)}`,
        'The worker marks the charge paid once the block is solidified (about a minute).',
        '',
      ].join('\n'),
    );
    return;
  }

  throw new Error('Usage: tron:payer new | balance | pay <address> <units>');
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof ConfigError ? error.message : String(error)}\n`);
  process.exit(1);
});
