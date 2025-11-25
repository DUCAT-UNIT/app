/**
 * useOnboardingHandlers Hook
 * Centralizes callback handlers for onboarding flows
 */

import { logger } from '../utils/logger';

export function useOnboardingHandlers({
  // State setters
  setIsImportedWallet,
  setImportedMnemonic,
  setShowingIntro,
  setShowingSeeds,
  setImportingWallet,
  setImportSeedPhrase,
  setVerificationWords,
  // External handlers
  saveWalletAfterPinSetup,
  loadWallet,
  handlePinSetupCompleteWrapper,
  handlePinChangeCompleteWrapper,
  resetWalletAndState,
  fetchBalance,
  fetchTransactionHistory,
  showPasskeyMigrationPromptGlobal,
  showToast,
  // State values
  isImportedWallet,
  importedMnemonic,
}) {
  // PIN setup completion - saves wallet and resets state
  const handlePinSetupComplete = async (pin) => {
    logger.debug('[OnboardingHandlers] handlePinSetupComplete called', {
      isImportedWallet,
      hasPin: !!pin,
      hasImportedMnemonic: !!importedMnemonic,
    });

    // Save wallet to storage for new wallets (not imported)
    if (!isImportedWallet) {
      const saved = await saveWalletAfterPinSetup();
      if (!saved) {
        showToast('Failed to save wallet', 'error');
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

      // Schedule passkey modal BEFORE navigation
      logger.debug('[OnboardingHandlers] Scheduling passkey migration modal');
      setTimeout(() => {
        showPasskeyMigrationPromptGlobal(capturedMnemonic, capturedPin);
      }, 2000);

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
  const handlePinChangeComplete = () => {
    handlePinChangeCompleteWrapper();
    setIsImportedWallet(false);
  };

  // Reset all onboarding UI state and wallet data
  const handleCancelOnboarding = async () => {
    setShowingIntro(false);
    setShowingSeeds(false);
    setImportingWallet(false);
    setImportSeedPhrase(Array(12).fill(''));
    setVerificationWords({});
    setIsImportedWallet(false);

    await resetWalletAndState();
  };

  return {
    handlePinSetupComplete,
    handlePinChangeComplete,
    handleCancelOnboarding,
  };
}
