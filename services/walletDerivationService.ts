import * as SecureStore from 'expo-secure-store';
import {
  DEFAULT_WALLET_DERIVATION_MODE,
  type WalletDerivationMode,
} from '../constants/bitcoin';
import { logger } from '../utils/logger';
import { DEVICE_ONLY } from './storagePolicy';

export const WALLET_DERIVATION_MODE_KEY = 'wallet_derivation_mode_v1';

let cachedMode: WalletDerivationMode | null = null;

const LEGACY_WALLET_DERIVATION_MODE: WalletDerivationMode = 'legacy_address_index';

const isWalletDerivationMode = (value: string | null): value is WalletDerivationMode =>
  value === 'legacy_address_index' || value === 'bip44_account' || value === 'unisat_account';

export const getWalletDerivationMode = async (): Promise<WalletDerivationMode> => {
  if (cachedMode) {
    return cachedMode;
  }

  try {
    const storedMode = await SecureStore.getItemAsync(WALLET_DERIVATION_MODE_KEY);
    if (isWalletDerivationMode(storedMode)) {
      cachedMode = storedMode;
      return storedMode;
    }
  } catch (error: unknown) {
    logger.error('Failed to load wallet derivation mode', {
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }

  // Backward compatibility: wallets created before explicit derivation mode tracking
  // keep their historical account-index behavior unless migrated.
  cachedMode = LEGACY_WALLET_DERIVATION_MODE;
  return cachedMode;
};

export const setWalletDerivationMode = async (
  mode: WalletDerivationMode = DEFAULT_WALLET_DERIVATION_MODE
): Promise<void> => {
  await SecureStore.setItemAsync(WALLET_DERIVATION_MODE_KEY, mode, DEVICE_ONLY);
  cachedMode = mode;
};
