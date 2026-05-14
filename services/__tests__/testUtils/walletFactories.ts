import type { WalletAccountAddresses } from '../../../services/walletService';
import type { DerivedAddresses } from '../../../utils/bitcoin';

export function makeDerivedAddresses(
  accountIndex = 0,
  overrides: Partial<DerivedAddresses> = {}
): DerivedAddresses {
  return {
    legacyAddress: `2Naccount${accountIndex}`,
    segwitAddress: `tb1qaccount${accountIndex}`,
    taprootAddress: `tb1paccount${accountIndex}`,
    segwitPubkey: `segwit-pubkey-${accountIndex}`,
    taprootPubkey: `taproot-pubkey-${accountIndex}`,
    ...overrides,
  };
}

export function makeWalletAccountAddresses(
  accountIndex = 0,
  overrides: Partial<DerivedAddresses> = {}
): WalletAccountAddresses {
  return {
    accountIndex,
    addresses: makeDerivedAddresses(accountIndex, overrides),
  };
}
