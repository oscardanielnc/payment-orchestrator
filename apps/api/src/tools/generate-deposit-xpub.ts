import { HDKey } from '@scure/bip32';
import { generateMnemonic, mnemonicToSeedSync } from '@scure/bip39';
import { wordlist } from '@scure/bip39/wordlists/english.js';
import type { AddressDeriver } from '../modules/crypto/application/ports/address-deriver';
import { EvmXpubAddressDeriver } from '../modules/crypto/infrastructure/evm/evm-xpub-address-deriver';
import { TronXpubAddressDeriver } from '../modules/crypto/infrastructure/tron/tron-xpub-address-deriver';
import { saveToWalletsFile, setEnvIfEmpty, WALLETS_FILE } from './private-files';

/**
 * Developer tool (not part of the app's layers). Local development only:
 *   pnpm --filter @po/api crypto:xpub [tron|base]
 * Creates a fresh TESTNET deposit wallet. The mnemonic (which can spend whatever reaches the
 * deposit addresses) goes to the private wallets file, never to the screen; the server only
 * needs the xpub, which is written to .env when the variable is empty.
 */
const NETWORKS = {
  tron: {
    path: "m/44'/195'/0'",
    envKey: 'TRON_DEPOSIT_XPUB',
    deriver: (xpub: string): AddressDeriver => new TronXpubAddressDeriver(xpub),
  },
  base: {
    path: "m/44'/60'/0'",
    envKey: 'BASE_DEPOSIT_XPUB',
    deriver: (xpub: string): AddressDeriver => new EvmXpubAddressDeriver('base-sepolia', xpub),
  },
} as const;

const name = (process.argv[2] ?? 'tron') as keyof typeof NETWORKS;
const network = NETWORKS[name] as (typeof NETWORKS)[keyof typeof NETWORKS] | undefined;
if (!network) {
  process.stderr.write('Usage: crypto:xpub [tron|base]\n');
  process.exit(1);
}

const mnemonic = generateMnemonic(wordlist, 128);
const xpub = HDKey.fromMasterSeed(mnemonicToSeedSync(mnemonic)).derive(
  network.path,
).publicExtendedKey;
const deriver = network.deriver(xpub);

saveToWalletsFile(`${name} deposit wallet`, [`mnemonic: ${mnemonic}`, `${network.envKey}=${xpub}`]);
const written = setEnvIfEmpty(network.envKey, xpub);

process.stdout.write(
  [
    'TESTNET ONLY. Never send real funds to these addresses.',
    `Mnemonic saved to ${WALLETS_FILE} (not shown here).`,
    written
      ? `${network.envKey} written to .env.`
      : `${network.envKey} already set in .env: left unchanged. Replace it by hand to rotate.`,
    '',
    `First deposit addresses (${network.path}/0/i):`,
    ...[0, 1, 2].map((i) => `  #${i} ${deriver.derive(i).address}`),
    '',
  ].join('\n'),
);
