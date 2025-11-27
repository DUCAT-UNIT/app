/**
 * useEcashThresholdManager - Hook for managing ecash threshold and conversions
 * Extracts ecash threshold management logic from WalletPage
 */

import { useState, useCallback, Dispatch, SetStateAction } from 'react';
import { useNavigation } from '@react-navigation/native';
import { logger } from '../utils/logger';
import { getRunesAmount } from '../utils/runesHelper';
import { requestMint } from '../services/cashu/cashuWalletService';
import { notify } from '../utils/notify';
import type { RuneBalance } from '../services/balanceService';
import type { ExtendedNavigation } from '../navigation/types';

interface SettingsHandlers {
  ecashThreshold: number;
  handleEcashThresholdChange: (threshold: number) => void;
}

interface UseEcashThresholdManagerParams {
  cashuBalance: number | null;
  runesBalance: RuneBalance[] | null;
  settingsHandlers: SettingsHandlers;
  showSettings: boolean;
  closeSettings: () => void;
  lowBalanceAmountNeeded: number;
  closeLowBalanceModal: () => void;
}

interface UseEcashThresholdManagerReturn {
  showThresholdSheet: boolean;
  showConversionModal: boolean;
  conversionAmount: number;
  savedUnitBalance: number;
  pendingThreshold: number | null;
  setShowThresholdSheet: Dispatch<SetStateAction<boolean>>;
  setShowConversionModal: Dispatch<SetStateAction<boolean>>;
  handleEcashThresholdPress: () => void;
  handleThresholdSelect: (newThreshold: number) => Promise<void>;
  handleConfirmConversion: () => Promise<void>;
  handleLowBalanceTopUp: () => Promise<void>;
}

export function useEcashThresholdManager({
  cashuBalance,
  runesBalance,
  settingsHandlers,
  showSettings,
  closeSettings,
  lowBalanceAmountNeeded,
  closeLowBalanceModal,
}: UseEcashThresholdManagerParams): UseEcashThresholdManagerReturn {
  const navigation = useNavigation() as ExtendedNavigation;

  // Ecash threshold management state
  const [showThresholdSheet, setShowThresholdSheet] = useState(false);
  const [showConversionModal, setShowConversionModal] = useState(false);
  const [pendingThreshold, setPendingThreshold] = useState<number | null>(null);
  const [conversionAmount, setConversionAmount] = useState(0);
  const [savedUnitBalance, setSavedUnitBalance] = useState(0);

  const handleEcashThresholdPress = useCallback(() => {
    setShowThresholdSheet(true);
  }, []);

  const handleThresholdSelect = useCallback(async (newThreshold: number) => {
    setShowThresholdSheet(false);

    // If selecting same threshold or 100, just update
    if (newThreshold === settingsHandlers.ecashThreshold || newThreshold === 100) {
      settingsHandlers.handleEcashThresholdChange(newThreshold);
      return;
    }

    // Check if we need to convert more ecash
    const currentEcashBalance = cashuBalance || 0;
    // runesBalance can be array of arrays or array of objects
    const currentUnitBalance = getRunesAmount(runesBalance);
    const requiredAmount = newThreshold === Infinity ? 0 : newThreshold;

    if (requiredAmount > currentEcashBalance && requiredAmount > 0) {
      // Need to convert more
      const amountNeeded = requiredAmount - currentEcashBalance;

      // Check if we have enough UNIT balance
      const actualConversionAmount = Math.min(amountNeeded, currentUnitBalance);

      logger.debug('[useEcashThresholdManager] Setting conversion modal state:', {
        currentUnitBalance,
        amountNeeded,
        actualConversionAmount,
        runesBalance,
      });

      setPendingThreshold(newThreshold);
      setConversionAmount(actualConversionAmount);
      setSavedUnitBalance(currentUnitBalance);
      setShowConversionModal(true);
    } else {
      // No conversion needed, just update threshold
      settingsHandlers.handleEcashThresholdChange(newThreshold);
    }
  }, [cashuBalance, runesBalance, settingsHandlers]);

  const handleConfirmConversion = useCallback(async () => {
    logger.debug('[useEcashThresholdManager] handleConfirmConversion called', {
      conversionAmount,
      pendingThreshold,
    });

    setShowConversionModal(false);

    // Update threshold first
    if (pendingThreshold !== null) {
      settingsHandlers.handleEcashThresholdChange(pendingThreshold);
    }

    // Navigate to mint flow (similar to Turbo mint flow)
    try {
      logger.debug('[useEcashThresholdManager] Requesting mint quote for amount:', conversionAmount);
      // Request mint quote for the needed amount
      const mintQuote = await requestMint(conversionAmount);
      logger.debug('[useEcashThresholdManager] Received mint quote:', mintQuote);

      logger.debug('[useEcashThresholdManager] Navigating to Processing screen');
      logger.debug('[useEcashThresholdManager] Navigation object available:', !!navigation);
      logger.debug('[useEcashThresholdManager] showSettings:', showSettings);

      // Close modals first
      setShowConversionModal(false);
      setShowThresholdSheet(false);

      // Close settings panel - ensure it's fully hidden
      if (showSettings) {
        logger.debug('[useEcashThresholdManager] Closing settings before navigation');
        closeSettings();
      }

      // Navigate using root navigator to ensure modal appears above everything
      // Get parent navigators until we reach root
      const getRootNavigator = (nav: ExtendedNavigation): ExtendedNavigation => {
        let currentNav = nav;
        let parent = currentNav.getParent?.();
        while (parent) {
          currentNav = parent;
          parent = currentNav.getParent?.();
        }
        return currentNav;
      };

      // Use setTimeout to ensure settings close completes
      setTimeout(() => {
        logger.debug('[useEcashThresholdManager] Attempting navigation now...');
        logger.debug('[useEcashThresholdManager] conversionAmount:', conversionAmount, 'type:', typeof conversionAmount);
        const amountStr = conversionAmount?.toString() || '0';
        logger.debug('[useEcashThresholdManager] amountStr:', amountStr);

        try {
          // Navigate from root navigator to ensure modal opens correctly
          const rootNav = getRootNavigator(navigation);
          logger.debug('[useEcashThresholdManager] Using root navigator:', !!rootNav);

          rootNav.navigate('SendFlow', {
            screen: 'Processing',
            params: {
              fromScreen: 'Settings',
              action: 'create_intent',
              cashuMint: true,
              quoteId: mintQuote.quoteId,
              assetType: 'unit',
              amount: amountStr,
              recipient: mintQuote.depositAddress,
            },
          });
          logger.debug('[useEcashThresholdManager] Navigation call completed');
        } catch (navError) {
          logger.error('[useEcashThresholdManager] Navigation error:', { error: navError instanceof Error ? navError.message : String(navError) });
          notify.cashu.navigationFailed(navError instanceof Error ? navError.message : String(navError));
        }
      }, 400);
    } catch (error: unknown) {
      logger.error('[useEcashThresholdManager] Failed to initiate mint:', { error: error instanceof Error ? error.message : String(error) });
      notify.cashu.conversionStartFailed(error instanceof Error ? error.message : String(error));
    }
  }, [conversionAmount, pendingThreshold, settingsHandlers, showSettings, closeSettings, navigation]);

  const handleLowBalanceTopUp = useCallback(async () => {
    logger.debug('[useEcashThresholdManager] handleLowBalanceTopUp called', {
      amountNeeded: lowBalanceAmountNeeded,
    });

    closeLowBalanceModal();

    // Navigate to mint flow
    try {
      // Request mint quote for the needed amount
      const mintQuote = await requestMint(lowBalanceAmountNeeded);
      logger.debug('[useEcashThresholdManager] Received mint quote for top-up:', mintQuote);

      const amountStr = lowBalanceAmountNeeded?.toString() || '0';

      // Navigate to processing screen
      navigation.navigate('SendFlow', {
        screen: 'Processing',
        params: {
          fromScreen: 'Wallet',
          action: 'create_intent',
          cashuMint: true,
          quoteId: mintQuote.quoteId,
          assetType: 'unit',
          amount: amountStr,
          recipient: mintQuote.depositAddress,
        },
      });

      // Show snackbar for conversion
      notify.transaction.pending('conversion_turbo');
    } catch (error: unknown) {
      logger.error('[useEcashThresholdManager] Failed to initiate top-up:', { error: error instanceof Error ? error.message : String(error) });
      notify.cashu.topupStartFailed(error instanceof Error ? error.message : String(error));
    }
  }, [lowBalanceAmountNeeded, closeLowBalanceModal, navigation]);

  return {
    // State
    showThresholdSheet,
    showConversionModal,
    conversionAmount,
    savedUnitBalance,
    pendingThreshold,

    // Setters (for external control)
    setShowThresholdSheet,
    setShowConversionModal,

    // Handlers
    handleEcashThresholdPress,
    handleThresholdSelect,
    handleConfirmConversion,
    handleLowBalanceTopUp,
  };
}
