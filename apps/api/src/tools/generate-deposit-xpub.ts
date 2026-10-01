import { HDKey } from '@scure/bip32';
import { generateMnemonic, mnemonicToSeedSync } from '@scure/bip39';
import { wordlist } from '@scure/bip39/wordlists/english.js';
import { TronXpubAddressDeriver } from '../modules/crypto/infrastructure/tron/tron-xpub-address-deriver';

/**
 * Developer tool (not part of the app's layers). Local development only:   pnpm --filter @po/api crypto:xpub
 * Creates a fresh TESTNET wallet and prints the account xpub for TRON_DEPOSIT_XPUB.
 * The mnemonic can spend whatever reaches the deposit addresses: keep it out of the repo
 * and out of .env. The server only ever needs the xpub.
 */
const mnemonic = generateMnemonic(wordlist, 128);
const account = HDKey.fromMasterSeed(mnemonicToSeedSync(mnemonic)).derive("m/44'/195'/0'");
const deriver = new TronXpubAddressDeriver(account.publicExtendedKey);

process.stdout.write(
  [
    'TESTNET ONLY. Never send real funds to these addresses.',
    '',
    `Mnemonic (store privately, NOT in the repo or .env):`,
    `  ${mnemonic}`,
    '',
    'Add to .env:',
    `  TRON_DEPOSIT_XPUB=${account.publicExtendedKey}`,
    '',
    "First deposit addresses (m/44'/195'/0'/0/i):",
    ...[0, 1, 2].map((i) => `  #${i} ${deriver.derive(i).address}`),
    '',
  ].join('\n'),
);
