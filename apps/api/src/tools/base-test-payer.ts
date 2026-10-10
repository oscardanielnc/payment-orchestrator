import {
  createPublicClient,
  createWalletClient,
  erc20Abi,
  formatEther,
  getAddress,
  http,
  type Hex,
} from 'viem';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import { baseSepolia } from 'viem/chains';
import { ConfigError, loadConfig } from '../config/load-config';
import { loadEnvFileIfPresent } from '../config/load-env-file';
import { saveToWalletsFile, setEnvIfEmpty, WALLETS_FILE } from './private-files';

/**
 * Developer tool (not part of the app's layers). Plays the CUSTOMER on Base Sepolia:
 *   pnpm --filter @po/api base:payer new                  → create a payer wallet
 *   pnpm --filter @po/api base:payer balance               → ETH (gas) and USDC of the payer
 *   pnpm --filter @po/api base:payer pay <address> <units> → send test USDC (minor units)
 * The private key goes to .env and the private wallets file, never to the screen.
 */
const basescanTx = (hash: string) => `https://sepolia.basescan.org/tx/${hash}`;

async function main(): Promise<void> {
  const [command, ...args] = process.argv.slice(2);

  if (command === 'new') {
    const privateKey = generatePrivateKey();
    const { address } = privateKeyToAccount(privateKey);
    if (!setEnvIfEmpty('BASE_TEST_PAYER_PRIVATE_KEY', privateKey)) {
      throw new Error('BASE_TEST_PAYER_PRIVATE_KEY is already set in .env; nothing changed');
    }
    saveToWalletsFile('base payer wallet', [
      `address: ${address}`,
      `BASE_TEST_PAYER_PRIVATE_KEY=${privateKey}`,
    ]);
    process.stdout.write(
      [
        `New TESTNET payer wallet: ${address}`,
        `Key written to .env and ${WALLETS_FILE} (not shown here).`,
        '',
        'Fund it with this address:',
        '  USDC: https://faucet.circle.com  (network: Base Sepolia)',
        '  ETH for gas: https://portal.cdp.coinbase.com/products/faucet  (Base Sepolia)',
        '',
      ].join('\n'),
    );
    return;
  }

  loadEnvFileIfPresent();
  const base = loadConfig(process.env).base;
  if (!base) {
    throw new Error(
      'Base is not configured (BASE_SEPOLIA_RPC_URL, BASE_SEPOLIA_CHAIN_ID, BASE_USDC_CONTRACT, BASE_DEPOSIT_XPUB)',
    );
  }
  const privateKey = process.env.BASE_TEST_PAYER_PRIVATE_KEY as Hex | undefined;
  if (!privateKey) throw new Error('Set BASE_TEST_PAYER_PRIVATE_KEY (run "base:payer new" first)');

  // The chain object pins chain id 84532: viem refuses to sign for any other chain.
  const account = privateKeyToAccount(privateKey);
  const transport = http(base.rpcUrl, { timeout: 10_000 });
  const reader = createPublicClient({ chain: baseSepolia, transport });
  const usdc = getAddress(base.usdcContract);

  if (command === 'balance') {
    const [eth, units] = await Promise.all([
      reader.getBalance({ address: account.address }),
      reader.readContract({
        address: usdc,
        abi: erc20Abi,
        functionName: 'balanceOf',
        args: [account.address],
      }),
    ]);
    process.stdout.write(
      `${account.address}\n  ETH:  ${formatEther(eth)}\n  USDC: ${units} minor units\n`,
    );
    return;
  }

  if (command === 'pay') {
    const [to, units] = args;
    if (!to || !units || !/^[1-9][0-9]*$/.test(units)) {
      throw new Error('Usage: base:payer pay <deposit address> <amount in minor units>');
    }
    const wallet = createWalletClient({ account, chain: baseSepolia, transport });
    const hash = await wallet.writeContract({
      address: usdc,
      abi: erc20Abi,
      functionName: 'transfer',
      args: [getAddress(to), BigInt(units)],
    });
    process.stdout.write(
      [
        `Sent ${units} USDC minor units from ${account.address} to ${to}`,
        `  tx: ${basescanTx(hash)}`,
        `The worker marks the charge paid after ${base.confirmations} confirmations (about ${base.confirmations * 2 + 10} s).`,
        '',
      ].join('\n'),
    );
    return;
  }

  throw new Error('Usage: base:payer new | balance | pay <address> <units>');
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof ConfigError ? error.message : String(error)}\n`);
  process.exit(1);
});
