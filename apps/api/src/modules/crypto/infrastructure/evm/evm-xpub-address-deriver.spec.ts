import { HDKey } from '@scure/bip32';
import { mnemonicToSeedSync } from '@scure/bip39';
import { mnemonicToAccount } from 'viem/accounts';
import { describe, expect, it } from 'vitest';
import { EvmXpubAddressDeriver } from './evm-xpub-address-deriver';

// Public BIP-39 test vector. Never holds funds; used only to compare derivations.
const TEST_MNEMONIC = // gitleaks:allow (public BIP-39 test vector)
  'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';

const account = HDKey.fromMasterSeed(mnemonicToSeedSync(TEST_MNEMONIC)).derive("m/44'/60'/0'");

describe('EvmXpubAddressDeriver', () => {
  it.each([0, 1, 7, 42])(
    'derives address #%i exactly like a wallet does from the mnemonic',
    (index) => {
      const ours = new EvmXpubAddressDeriver('base-sepolia', account.publicExtendedKey).derive(
        index,
      );
      const reference = mnemonicToAccount(TEST_MNEMONIC, { addressIndex: index });

      expect(ours.address).toBe(reference.address);
      expect(ours.matchKey).toBe(reference.address.slice(2).toLowerCase());
    },
  );

  it('matches the well-known first address of the test vector', () => {
    expect(new EvmXpubAddressDeriver('base-sepolia', account.publicExtendedKey).derive(0)).toEqual({
      address: '0x9858EfFD232B4033E47d90003D41EC34EcaEda94',
      matchKey: '9858effd232b4033e47d90003d41ec34ecaeda94', // gitleaks:allow (public address of the BIP-39 test vector)
    });
  });

  it('refuses an extended private key', () => {
    expect(() => new EvmXpubAddressDeriver('base-sepolia', account.privateExtendedKey)).toThrow(
      /xpub/,
    );
  });
});
