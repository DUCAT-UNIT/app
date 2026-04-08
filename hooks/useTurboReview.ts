/**
 * useTurboReview Hook
 * Handles Turbo transaction review logic (ecash balance checking, minting)
 */

import { useState, useCallback, Dispatch, SetStateAction } from 'react';
import { Alert } from 'react-native';
import { logger } from '../utils/logger';
import { requestMint, getBalance } from '../services/cashu/cashuWalletService';
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
    // ecashThreshold is in cents, sendAmount is in display units — convert for comparison
    let shouldUseTurbo = turboEnabled;
    if (sendAssetType === 'unit') {
      const displayAmount = parseFloat(sendAmount);
      const thresholdDisplay = ecashThreshold / 100;
      if (displayAmount < thresholdDisplay && !turboEnabled) {
        logger.debug(`[useTurboReview] Auto-enabling Turbo for < ${thresholdDisplay} UNIT`);
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

        // getBalance() already returns smallest units (integer)
        const ecashBalanceSmallestUnits = await getBalance();

        logger.debug('[useTurboReview] Checking ecash balance:', {
          requested: displayAmount,
          requestedSmallestUnits: amountInSmallestUnits,
          ecashBalanceSmallestUnits,
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
        // Convert smallest units back to display units for UI
        setInsufficientTurboBalance(ecashBalanceSmallestUnits / 100);
        setShowInsufficientTurboSheet(true);
        return;
      } catch (error: unknown) {
        logger.error('Failed to check ecash balance:', { error: error instanceof Error ? error.message : String(error) });
        Alert.alert('Error', 'Failed to initiate Turbo transaction. Please try again.');
      } finally {
        setIsRequestingMint(false);
      }
    } else {
      // Normal flow
      navigation.navigate('Processing', {
        fromScreen: 'SendInput',
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

      // Calculate the difference needed to mint (not the full amount)
      // insufficientTurboAmount is in display units, insufficientTurboBalance is also in display units
      // Convert to smallest units (integer) for the mint request
      const differenceDisplayUnits = insufficientTurboAmount - insufficientTurboBalance;
      const differenceSmallestUnits = Math.round(differenceDisplayUnits * 100);
      logger.debug('[useTurboReview] Calculating mint amount:', {
        totalRequired: insufficientTurboAmount,
        currentBalance: insufficientTurboBalance,
        differenceDisplayUnits,
        differenceSmallestUnits,
      });

      const mintQuote = await requestMint(differenceSmallestUnits);
      const originalRecipient = sendRecipient;

      logger.debug('[useTurboReview] Mint quote received:', {
        quoteId: mintQuote.quoteId,
        depositAddress: mintQuote.depositAddress,
        quoteAmount: mintQuote.amount,
      });

      // The mint quote is for the difference amount
      // After minting completes, we'll send the FULL original amount to the recipient
      if (mintQuote.amount === undefined) {
        throw new Error('Mint quote amount is undefined');
      }

      // sendAmount for the BTC transaction is the difference (to mint)
      const quoteDisplayAmount = (mintQuote.amount / 100).toString();
      logger.debug('[useTurboReview] Mint flow setup:', {
        originalSendAmount: sendAmount,
        mintDifferenceAmount: mintQuote.amount,
        btcSendAmount: quoteDisplayAmount,
        finalTurboAmount: insufficientTurboAmount,
      });

      // Set send amount to the mint difference (this is the BTC we send to the mint)
      setSendAmount(quoteDisplayAmount);
      setSendRecipient(mintQuote.depositAddress);
      setIsRequestingMint(false);

      // Pass the FULL turbo amount (in smallest units) that will be sent after minting
      const fullTurboAmountSmallestUnits = Math.round(insufficientTurboAmount * 100);

      navigation.navigate('Processing', {
        fromScreen: 'SendInput',
        action: 'create_intent',
        isTurbo: true,
        mintQuoteId: mintQuote.quoteId,
        mintAmount: fullTurboAmountSmallestUnits, // Full amount to send after minting
        turboRecipient: originalRecipient,
      });
    } catch (error: unknown) {
      setIsRequestingMint(false);
      logger.error('[useTurboReview] Failed to request mint quote:', { error: error instanceof Error ? error.message : String(error) });
      Alert.alert('Error', 'Failed to initiate Turbo transaction. Please try again.');
    }
  }, [insufficientTurboAmount, insufficientTurboBalance, sendAmount, sendRecipient, setSendAmount, setSendRecipient, navigation]);

  const handleSendNormally = useCallback(() => {
    setShowInsufficientTurboSheet(false);
    logger.debug('[useTurboReview] User chose regular send');

    setTurboEnabled(false);

    navigation.navigate('Processing', {
      fromScreen: 'SendInput',
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
