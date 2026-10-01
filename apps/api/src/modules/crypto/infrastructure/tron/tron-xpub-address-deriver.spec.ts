import { HDKey } from '@scure/bip32';
import { mnemonicToSeedSync } from '@scure/bip39';
import { TronWeb } from 'tronweb';
import { describe, expect, it } from 'vitest';
import { tronAddressToHex20 } from './tron-address';
import { TronXpubAddressDeriver } from './tron-xpub-address-deriver';

// Public BIP-39 test vector. Never holds funds; used only to compare derivations.
const TEST_MNEMONIC = // gitleaks:allow (public BIP-39 test vector)
  'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';

const accountXpub = HDKey.fromMasterSeed(mnemonicToSeedSync(TEST_MNEMONIC)).derive(
  "m/44'/195'/0'",
).publicExtendedKey;

describe('TronXpubAddressDeriver', () => {
  it.each([0, 1, 7, 42])(
    'derives address #%i exactly like TronWeb does from the mnemonic',
    (index) => {
      const ours = new TronXpubAddressDeriver(accountXpub).derive(index);
      const reference = TronWeb.fromMnemonic(TEST_MNEMONIC, `m/44'/195'/0'/0/${index}`);

      expect(ours.address).toBe(reference.address);
      expect(ours.matchKey).toBe(tronAddressToHex20(reference.address));
    },
  );

  it('refuses an extended private key', () => {
    const xprv = HDKey.fromMasterSeed(mnemonicToSeedSync(TEST_MNEMONIC)).derive(
      "m/44'/195'/0'",
    ).privateExtendedKey;

    expect(() => new TronXpubAddressDeriver(xprv)).toThrow(/xpub/);
  });
});
