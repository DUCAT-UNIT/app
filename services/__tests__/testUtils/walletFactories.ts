import type { WalletAccountAddresses } from '../../../services/walletService';
import type { DerivedAddresses } from '../../../utils/bitcoin';
import {
  DEFAULT_WALLET_DERIVATION_MODE,
  getWalletProfileForDerivationMode,
} from '../../../constants/bitcoin';

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
    derivationMode: DEFAULT_WALLET_DERIVATION_MODE,
    walletProfile: getWalletProfileForDerivationMode(DEFAULT_WALLET_DERIVATION_MODE),
    addresses: makeDerivedAddresses(accountIndex, overrides),
  };
}
