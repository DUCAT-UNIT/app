/**
 * useTurboReview Hook
 * Handles Turbo transaction review logic (ecash balance checking, minting)
 */

import { useState, useCallback, Dispatch, SetStateAction } from 'react';
import { Alert } from 'react-native';
import { logger } from '../utils/logger';
import { requestMint } from '../services/cashu/cashuWalletService';
import type { SendFlowAssetType } from '../types/assets';
import type { MinimalNavigation } from '../navigation/types';

interface UseTurboReviewParams {
  sendAmount: string;
  sendAssetType: SendFlowAssetType;
  sendRecipient: string;
  turboEnabled: boolean;
  setTurboEnabled: (value: boolean) => void;
  setSendRecipient: (value: string) => void;
  setSendAmount: (value: string) => void;
  ecashThreshold: number;
  navigation: MinimalNavigation;
  isCashuMint: boolean;
  cashuQuoteId?: string | null;
}

interface UseTurboReviewReturn {
  isRequestingMint: boolean;
  showInsufficientTurboSheet: boolean;
  setShowInsufficientTurboSheet: Dispatch<SetStateAction<boolean>>;
  insufficientTurboAmount: number;
  insufficientTurboBalance: number;
  handleReview: () => Promise<void>;
  handleUseTurbo: () => Promise<void>;
  handleSendNormally: () => void;
}

export function useTurboReview({
  sendAmount,
  sendAssetType,
  sendRecipient,
  turboEnabled,
  setTurboEnabled,
  setSendRecipient,
  setSendAmount,
  ecashThreshold,
  navigation,
  isCashuMint,
  cashuQuoteId,
}: UseTurboReviewParams): UseTurboReviewReturn {
  const [isRequestingMint, setIsRequestingMint] = useState(false);
  const [showInsufficientTurboSheet, setShowInsufficientTurboSheet] = useState(false);
  const [insufficientTurboAmount, setInsufficientTurboAmount] = useState(0);
  const [insufficientTurboBalance, setInsufficientTurboBalance] = useState(0);

  const handleReview = useCallback(async () => {
    logger.debug('[useTurboReview] handleReview called', { sendAmount, sendAssetType, turboEnabled });

    if (!sendAmount || isRequestingMint) {
      return;
    }

    // Auto-enable Turbo for UNIT transactions less than threshold
    let shouldUseTurbo = turboEnabled;
    if (sendAssetType === 'unit') {
      const displayAmount = parseFloat(sendAmount);
      if (displayAmount < ecashThreshold && !turboEnabled) {
        logger.debug(`[useTurboReview] Auto-enabling Turbo for < ${ecashThreshold} UNIT`);
        setTurboEnabled(true);
        shouldUseTurbo = true;
      }
    }

    // Turbo mode for UNIT transfers
    if (shouldUseTurbo && sendAssetType === 'unit') {
      try {
        setIsRequestingMint(true);

        const displayAmount = parseFloat(sendAmount);
        const amountInSmallestUnits = Math.round(displayAmount * 100);

        const { getBalance } = await import('../services/cashu/cashuWalletService');
        const ecashBalance = await getBalance();
        const ecashBalanceSmallestUnits = Math.round(ecashBalance * 100);

        logger.debug('[useTurboReview] Checking ecash balance:', {
          requested: displayAmount,
          ecashBalance,
          hasEnough: ecashBalanceSmallestUnits >= amountInSmallestUnits,
        });

        if (ecashBalanceSmallestUnits >= amountInSmallestUnits) {
          logger.debug('[useTurboReview] Sufficient ecash - creating P2PK token directly');
          setIsRequestingMint(false);
          navigation.navigate('TurboProcessing');
          return;
        }

        // Not enough ecash - show bottom sheet
        logger.debug('[useTurboReview] Insufficient ecash - showing sheet');
        setIsRequestingMint(false);
        setInsufficientTurboAmount(displayAmount);
        setInsufficientTurboBalance(ecashBalance);
        setShowInsufficientTurboSheet(true);
        return;
      } catch (error) {
        logger.error('Failed to check ecash balance:', { error: error instanceof Error ? error.message : String(error) });
        Alert.alert('Error', 'Failed to initiate Turbo transaction. Please try again.');
      } finally {
        setIsRequestingMint(false);
      }
    } else {
      // Normal flow
      navigation.navigate('Processing', {
        fromScreen: 'AmountInput',
        action: 'create_intent',
        cashuMint: isCashuMint,
        quoteId: cashuQuoteId,
      });
    }
  }, [sendAmount, sendAssetType, turboEnabled, ecashThreshold, setTurboEnabled, navigation, isCashuMint, cashuQuoteId, isRequestingMint]);

  const handleUseTurbo = useCallback(async () => {
    setShowInsufficientTurboSheet(false);
    logger.debug('[useTurboReview] User chose Turbo with minting');

    try {
      setIsRequestingMint(true);

      const mintQuote = await requestMint(insufficientTurboAmount);
      const originalRecipient = sendRecipient;

      logger.debug('[useTurboReview] Mint quote received:', {
        quoteId: mintQuote.quoteId,
        depositAddress: mintQuote.depositAddress,
        quoteAmount: mintQuote.amount,
      });

      // CRITICAL: Update sendAmount to match the quote amount exactly
      // mintQuote.amount is in smallest units, convert to display units
      const quoteDisplayAmount = (mintQuote.amount / 100).toString();
      logger.debug('[useTurboReview] Updating sendAmount to match quote:', {
        originalSendAmount: sendAmount,
        quoteAmount: mintQuote.amount,
        newSendAmount: quoteDisplayAmount,
      });
      setSendAmount(quoteDisplayAmount);
      setSendRecipient(mintQuote.depositAddress);
      setIsRequestingMint(false);

      navigation.navigate('Processing', {
        fromScreen: 'AmountInput',
        action: 'create_intent',
        isTurbo: true,
        mintQuoteId: mintQuote.quoteId,
        mintAmount: mintQuote.amount,
        turboRecipient: originalRecipient,
      });
    } catch (error) {
      setIsRequestingMint(false);
      logger.error('[useTurboReview] Failed to request mint quote:', { error: error instanceof Error ? error.message : String(error) });
      Alert.alert('Error', 'Failed to initiate Turbo transaction. Please try again.');
    }
  }, [insufficientTurboAmount, sendAmount, sendRecipient, setSendAmount, setSendRecipient, navigation]);

  const handleSendNormally = useCallback(() => {
    setShowInsufficientTurboSheet(false);
    logger.debug('[useTurboReview] User chose regular send');

    setTurboEnabled(false);

    navigation.navigate('Processing', {
      fromScreen: 'AmountInput',
      action: 'create_intent',
    });
  }, [setTurboEnabled, navigation]);

  return {
    isRequestingMint,
    showInsufficientTurboSheet,
    setShowInsufficientTurboSheet,
    insufficientTurboAmount,
    insufficientTurboBalance,
    handleReview,
    handleUseTurbo,
    handleSendNormally,
  };
}
