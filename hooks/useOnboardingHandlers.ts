/**
 * useOnboardingHandlers Hook
 * Centralizes callback handlers for onboarding flows
 */

import { logger } from '../utils/logger';
import { isE2E } from '../utils/e2e';
import type { WalletAddresses } from '../contexts/WalletContext';

interface LoadWalletResult {
  exists: boolean;
  addresses?: WalletAddresses;
}

interface UseOnboardingHandlersParams {
  setIsImportedWallet: (value: boolean) => void;
  setImportedMnemonic: (value: string | null) => void;
  setImportingWallet: (value: boolean) => void;
  setImportSeedPhrase: (value: string[]) => void;
  persistImportedWallet: () => Promise<void>;
  loadWallet: () => Promise<LoadWalletResult | undefined>;
  handlePinSetupCompleteWrapper: (...args: unknown[]) => Promise<void>;
  handlePinChangeCompleteWrapper: (...args: unknown[]) => Promise<void> | void;
  resetWalletAndState: () => Promise<void>;
  fetchBalance?: (...args: unknown[]) => Promise<unknown>;
  fetchTransactionHistory?: () => Promise<void>;
  showPasskeyMigrationPromptGlobal: (pin: string) => void;
  isImportedWallet: boolean;
  importedMnemonic: string | null;
}

interface UseOnboardingHandlersReturn {
  handlePinSetupComplete: (pin?: string) => Promise<void>;
  handlePinChangeComplete: () => void;
  handleCancelOnboarding: () => Promise<void>;
}

export function useOnboardingHandlers({
  setIsImportedWallet,
  setImportedMnemonic,
  setImportingWallet,
  setImportSeedPhrase,
  persistImportedWallet,
  loadWallet,
  handlePinSetupCompleteWrapper,
  handlePinChangeCompleteWrapper,
  resetWalletAndState,
  fetchBalance,
  fetchTransactionHistory,
  showPasskeyMigrationPromptGlobal,
  isImportedWallet,
  importedMnemonic,
}: UseOnboardingHandlersParams): UseOnboardingHandlersReturn {
  // PIN setup completion - saves wallet and resets state
  const handlePinSetupComplete = async (pin?: string): Promise<void> => {
    logger.debug('[OnboardingHandlers] handlePinSetupComplete called', {
      isImportedWallet,
      hasPin: !!pin,
      hasImportedMnemonic: !!importedMnemonic,
    });

    // For imported wallets, load wallet into context before completing setup
    if (importedMnemonic && pin) {
      logger.debug('[OnboardingHandlers] Loading imported wallet into context');
      const capturedPin = pin;

      await persistImportedWallet();

      // Clear import state
      setIsImportedWallet(false);

      // Load wallet into context
      const loadResult = await loadWallet();
      logger.debug('[OnboardingHandlers] Wallet loaded:', {
        exists: loadResult?.exists,
        hasAddresses: !!loadResult?.addresses,
      });

      // Show passkey modal immediately after setup completes
      // Skip in __DEV__ mode — passkey requires native WebAuthn dialog
      // which blocks Maestro/simulator automation
      if (!isE2E) {
        logger.debug('[OnboardingHandlers] Showing passkey migration modal');
        showPasskeyMigrationPromptGlobal(capturedPin);
      } else {
        logger.debug('[OnboardingHandlers] Skipping passkey migration modal in E2E mode');
      }

      // Complete setup
      await handlePinSetupCompleteWrapper();

      // Fetch balance with loaded addresses
      if (loadResult?.exists && loadResult?.addresses) {
        if (fetchBalance) {
          logger.debug('[OnboardingHandlers] Fetching balance');
          await fetchBalance(
            loadResult.addresses.segwitAddress,
            loadResult.addresses.taprootAddress
          );
        }

        if (fetchTransactionHistory) {
          logger.debug('[OnboardingHandlers] Fetching transaction history');
          await fetchTransactionHistory();
        }
      }

      // Clear imported mnemonic for security
      setImportedMnemonic(null);
    } else {
      // Normal wallet creation flow
      logger.debug('[OnboardingHandlers] Completing setup (normal flow)');
      await handlePinSetupCompleteWrapper();
    }
  };

  // PIN change completion
  const handlePinChangeComplete = (): void => {
    handlePinChangeCompleteWrapper();
    setIsImportedWallet(false);
  };

  // Reset all onboarding UI state and wallet data
  const handleCancelOnboarding = async (): Promise<void> => {
    setImportingWallet(false);
    setImportSeedPhrase(Array(12).fill(''));
    setIsImportedWallet(false);

    await resetWalletAndState();
  };

  return {
    handlePinSetupComplete,
    handlePinChangeComplete,
    handleCancelOnboarding,
  };
}
