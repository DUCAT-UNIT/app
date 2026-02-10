/**
 * useOnboardingHandlers Hook
 * Centralizes callback handlers for onboarding flows
 */

import { logger } from '../utils/logger';
import type { WalletAddresses } from '../contexts/WalletContext';
import { notify } from '../utils/notify';

interface LoadWalletResult {
  exists: boolean;
  addresses?: WalletAddresses;
}

interface UseOnboardingHandlersParams {
  setIsImportedWallet: (value: boolean) => void;
  setImportedMnemonic: (value: string | null) => void;
  setImportingWallet: (value: boolean) => void;
  setImportSeedPhrase: (value: string[]) => void;
  saveWalletAfterPinSetup: () => Promise<boolean>;
  loadWallet: () => Promise<LoadWalletResult | undefined>;
  handlePinSetupCompleteWrapper: (...args: unknown[]) => Promise<void>;
  handlePinChangeCompleteWrapper: (...args: unknown[]) => Promise<void> | void;
  resetWalletAndState: () => Promise<void>;
  fetchBalance?: (...args: unknown[]) => Promise<unknown>;
  fetchTransactionHistory?: () => Promise<void>;
  showPasskeyMigrationPromptGlobal: (mnemonic: string, pin: string) => void;
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
  saveWalletAfterPinSetup,
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

    // Save wallet to storage for new wallets (not imported)
    if (!isImportedWallet) {
      const saved = await saveWalletAfterPinSetup();
      if (!saved) {
        notify.wallet.saveFailed();
        return;
      }
    }

    // For imported wallets, load wallet into context before completing setup
    if (importedMnemonic && pin) {
      logger.debug('[OnboardingHandlers] Loading imported wallet into context');
      const capturedMnemonic = importedMnemonic;
      const capturedPin = pin;

      // Clear import state
      setIsImportedWallet(false);

      // Load wallet into context
      const loadResult = await loadWallet();
      logger.debug('[OnboardingHandlers] Wallet loaded:', {
        exists: loadResult?.exists,
        hasAddresses: !!loadResult?.addresses,
      });

      // Show passkey modal immediately after setup completes
      logger.debug('[OnboardingHandlers] Showing passkey migration modal');
      showPasskeyMigrationPromptGlobal(capturedMnemonic, capturedPin);

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
