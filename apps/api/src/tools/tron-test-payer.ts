import { TronWeb } from 'tronweb';
import { ConfigError, loadConfig } from '../config/load-config';
import { loadEnvFileIfPresent } from '../config/load-env-file';

/**
 * Developer tool (not part of the app's layers). Local development only: plays the CUSTOMER paying on the Nile testnet.
 *   pnpm --filter @po/api tron:payer new                  → create a payer wallet
 *   pnpm --filter @po/api tron:payer balance               → TRX and USDT of the payer
 *   pnpm --filter @po/api tron:payer pay <address> <units> → send test USDT (minor units)
 *
 * Network and token come from the validated config, so this cannot point at mainnet.
 * The payer key (TRON_TEST_PAYER_PRIVATE_KEY) belongs to a throwaway testnet wallet.
 */
/** The two TRC-20 calls this tool needs; TronWeb's own contract type is `any`. */
interface Trc20Contract {
  balanceOf(owner: string): { call(): Promise<unknown> };
  transfer(to: string, amount: string): { send(options: { feeLimit: number }): Promise<string> };
}

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
        `Fund it with test TRX and USDT at https://nileex.io/join/getJoinPage using the address above.`,
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
  const privateKey = process.env.TRON_TEST_PAYER_PRIVATE_KEY;
  if (!privateKey) throw new Error('Set TRON_TEST_PAYER_PRIVATE_KEY (run "tron:payer new" first)');

  const tronWeb = new TronWeb({
    fullHost: tron.fullHost,
    privateKey,
    ...(tron.apiKey && { headers: { 'TRON-PRO-API-KEY': tron.apiKey } }),
  });
  const payer = tronWeb.defaultAddress.base58;
  if (!payer) throw new Error('Invalid TRON_TEST_PAYER_PRIVATE_KEY');
  const usdt = (await tronWeb.contract().at(tron.usdtContract)) as unknown as Trc20Contract;

  if (command === 'balance') {
    const trx = await tronWeb.trx.getBalance(payer);
    const units = String(await usdt.balanceOf(payer).call());
    process.stdout.write(`${payer}\n  TRX:  ${trx / 1e6}\n  USDT: ${units} minor units\n`);
    return;
  }

  if (command === 'pay') {
    const [to, units] = args;
    if (!to || !units || !/^[1-9][0-9]*$/.test(units)) {
      throw new Error('Usage: tron:payer pay <deposit address> <amount in minor units>');
    }
    const txid = await usdt.transfer(to, units).send({ feeLimit: 100_000_000 });
    process.stdout.write(
      [
        `Sent ${units} USDT minor units from ${payer} to ${to}`,
        `  tx: https://nile.tronscan.org/#/transaction/${txid}`,
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
