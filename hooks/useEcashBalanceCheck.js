/**
 * useEcashBalanceCheck Hook
 * Checks ecash balance on app start and prompts user to top up if low
 */

import { useState, useEffect, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { logger } from '../utils/logger';

const LAST_CHECK_KEY = '@ecash_balance_last_check';
const CHECK_COOLDOWN = 24 * 60 * 60 * 1000; // 24 hours

export function useEcashBalanceCheck(cashuBalance, ecashThreshold, unitBalance) {
  const [showLowBalanceModal, setShowLowBalanceModal] = useState(false);
  const [amountNeeded, setAmountNeeded] = useState(0);
  const hasChecked = useRef(false);

  useEffect(() => {
    const checkBalance = async () => {
      // Only check once per session and if we have valid data
      if (hasChecked.current || cashuBalance === null || cashuBalance === undefined) {
        return;
      }

      // Check if we've shown the prompt recently
      try {
        const lastCheck = await AsyncStorage.getItem(LAST_CHECK_KEY);
        if (lastCheck) {
          const timeSinceLastCheck = Date.now() - parseInt(lastCheck, 10);
          if (timeSinceLastCheck < CHECK_COOLDOWN) {
            logger.debug('[useEcashBalanceCheck] Skipping check - cooldown period');
            hasChecked.current = true;
            return;
          }
        }
      } catch (error) {
        logger.error('[useEcashBalanceCheck] Error checking last check time:', error);
      }

      // Check if balance is 25% or less of default threshold
      const threshold = ecashThreshold || 100;
      const lowBalanceThreshold = threshold * 0.25;

      logger.debug('[useEcashBalanceCheck] Checking balance:', {
        cashuBalance,
        threshold,
        lowBalanceThreshold,
        isLow: cashuBalance <= lowBalanceThreshold,
      });

      if (cashuBalance <= lowBalanceThreshold) {
        const needed = threshold - cashuBalance;

        // Only show if we have enough UNIT balance to convert
        if (unitBalance >= needed) {
          setAmountNeeded(needed);
          setShowLowBalanceModal(true);

          // Record that we've shown the prompt
          try {
            await AsyncStorage.setItem(LAST_CHECK_KEY, Date.now().toString());
          } catch (error) {
            logger.error('[useEcashBalanceCheck] Error saving check time:', error);
          }
        } else {
          logger.debug('[useEcashBalanceCheck] Insufficient UNIT balance for conversion');
        }
      }

      hasChecked.current = true;
    };

    checkBalance();
  }, [cashuBalance, ecashThreshold, unitBalance]);

  const closeModal = () => {
    setShowLowBalanceModal(false);
  };

  return {
    showLowBalanceModal,
    closeModal,
    amountNeeded,
    currentBalance: cashuBalance || 0,
    defaultThreshold: ecashThreshold || 100,
  };
}
