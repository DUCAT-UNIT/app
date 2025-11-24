/**
 * useEcashThresholdManager - Hook for managing ecash threshold and conversions
 * Extracts ecash threshold management logic from WalletPage
 */

import { useState, useCallback } from 'react';
import { useNavigation } from '@react-navigation/native';
import { logger } from '../utils/logger';

/**
 * Hook for managing ecash threshold and conversion flows
 * @param {Object} params
 * @param {number} params.cashuBalance - Current ecash balance
 * @param {Array} params.runesBalance - Current UNIT balance
 * @param {Object} params.settingsHandlers - Settings handlers
 * @param {Function} params.showToast - Function to show toast
 * @param {Function} params.showSnackbar - Function to show snackbar
 * @param {boolean} params.showSettings - Whether settings is open
 * @param {Function} params.closeSettings - Function to close settings
 * @param {number} params.lowBalanceAmountNeeded - Amount needed for low balance top-up
 * @param {Function} params.closeLowBalanceModal - Function to close low balance modal
 * @returns {Object} Threshold manager state and handlers
 */
export function useEcashThresholdManager({
  cashuBalance,
  runesBalance,
  settingsHandlers,
  showToast,
  showSnackbar,
  showSettings,
  closeSettings,
  lowBalanceAmountNeeded,
  closeLowBalanceModal,
}) {
  const navigation = useNavigation();

  // Ecash threshold management state
  const [showThresholdSheet, setShowThresholdSheet] = useState(false);
  const [showConversionModal, setShowConversionModal] = useState(false);
  const [pendingThreshold, setPendingThreshold] = useState(null);
  const [conversionAmount, setConversionAmount] = useState(0);
  const [savedUnitBalance, setSavedUnitBalance] = useState(0);

  const handleEcashThresholdPress = useCallback(() => {
    setShowThresholdSheet(true);
  }, []);

  const handleThresholdSelect = useCallback(async (newThreshold) => {
    setShowThresholdSheet(false);

    // If selecting same threshold or 100, just update
    if (newThreshold === settingsHandlers.ecashThreshold || newThreshold === 100) {
      await settingsHandlers.handleEcashThresholdChange(newThreshold);
      return;
    }

    // Check if we need to convert more ecash
    const currentEcashBalance = cashuBalance || 0;
    // runesBalance is an array: [[runeId, amount], ...]
    const currentUnitBalance = runesBalance && runesBalance.length > 0 ? parseFloat(runesBalance[0][1]) : 0;
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
      await settingsHandlers.handleEcashThresholdChange(newThreshold);
    }
  }, [cashuBalance, runesBalance, settingsHandlers]);

  const handleConfirmConversion = useCallback(async () => {
    logger.debug('[useEcashThresholdManager] handleConfirmConversion called', {
      conversionAmount,
      pendingThreshold,
    });

    setShowConversionModal(false);

    // Update threshold first
    await settingsHandlers.handleEcashThresholdChange(pendingThreshold);

    // Navigate to mint flow (similar to Turbo mint flow)
    try {
      logger.debug('[useEcashThresholdManager] Importing requestMint...');
      const { requestMint } = await import('../services/cashu/cashuWalletService');

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
      const getRootNavigator = (nav) => {
        let currentNav = nav;
        while (currentNav.getParent()) {
          currentNav = currentNav.getParent();
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
          logger.error('[useEcashThresholdManager] Navigation error:', navError);
          showToast('Navigation failed: ' + navError.message, 'error');
        }
      }, 400);
    } catch (error) {
      logger.error('[useEcashThresholdManager] Failed to initiate mint:', error);
      showToast('Failed to start conversion: ' + error.message, 'error');
    }
  }, [conversionAmount, pendingThreshold, settingsHandlers, showSettings, closeSettings, navigation, showToast]);

  const handleLowBalanceTopUp = useCallback(async () => {
    logger.debug('[useEcashThresholdManager] handleLowBalanceTopUp called', {
      amountNeeded: lowBalanceAmountNeeded,
    });

    closeLowBalanceModal();

    // Navigate to mint flow
    try {
      const { requestMint } = await import('../services/cashu/cashuWalletService');

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
      showSnackbar({
        type: 'pending',
        action: 'conversion_turbo',
      });
    } catch (error) {
      logger.error('[useEcashThresholdManager] Failed to initiate top-up:', error);
      showToast('Failed to start top-up: ' + error.message, 'error');
    }
  }, [lowBalanceAmountNeeded, closeLowBalanceModal, navigation, showSnackbar, showToast]);

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
