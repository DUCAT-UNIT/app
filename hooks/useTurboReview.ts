/**
 * useTurboReview Hook
 * Handles Turbo transaction review logic (ecash balance checking, minting)
 */

import { useState, useCallback, Dispatch, SetStateAction } from 'react';
import { Alert } from 'react-native';
import { logger } from '../utils/logger';
import { requestMint, getBalance } from '../services/cashu/cashuWalletService';
import { savePendingTurboSend } from '../services/cashu/cashuTurboRecovery';
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
  senderTaprootAddress?: string | null;
}

interface UseTurboReviewReturn {
  isRequestingMint: boolean;
  showInsufficientTurboSheet: boolean;
  setShowInsufficientTurboSheet: Dispatch<SetStateAction<boolean>>;
  setInsufficientTurboAmount: Dispatch<SetStateAction<number>>;
  setInsufficientTurboBalance: Dispatch<SetStateAction<number>>;
  insufficientTurboAmount: number;
  insufficientTurboBalance: number;
  handleReview: () => Promise<void>;
  handleUseTurbo: () => Promise<void>;
  handleSendNormally: () => void;
}

const TURBO_REVIEW_OPERATION_TIMEOUT_MS = 15_000;

const rejectAfter = <T,>(promise: Promise<T>, ms: number, label: string): Promise<T> => {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<never>((_resolve, reject) => {
    timeout = setTimeout(() => {
      reject(new Error(`${label} timed out after ${Math.round(ms / 1000)}s`));
    }, ms);
    (timeout as { unref?: () => void }).unref?.();
  });

  return Promise.race([promise, timeoutPromise]).finally(() => {
    if (timeout) clearTimeout(timeout);
  });
};

export function useTurboReview({
  sendAmount,
  sendAssetType,
  sendRecipient,
  turboEnabled,
  setTurboEnabled,
  setSendRecipient,
  setSendAmount,
  ecashThreshold: _ecashThreshold,
  navigation,
  isCashuMint,
  cashuQuoteId,
  senderTaprootAddress,
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

    // Turbo mode for UNIT transfers
    if (turboEnabled && sendAssetType === 'unit') {
      try {
        setIsRequestingMint(true);

        const displayAmount = parseFloat(sendAmount);
        const amountInSmallestUnits = Math.round(displayAmount * 100);

        // getBalance() already returns smallest units (integer)
        const ecashBalanceSmallestUnits = await rejectAfter(
          getBalance(),
          TURBO_REVIEW_OPERATION_TIMEOUT_MS,
          'Checking Turbo balance'
        );

        logger.debug('[useTurboReview] Checking ecash balance:', {
          requested: displayAmount,
          requestedSmallestUnits: amountInSmallestUnits,
          ecashBalanceSmallestUnits,
          hasEnough: ecashBalanceSmallestUnits >= amountInSmallestUnits,
        });

        if (ecashBalanceSmallestUnits >= amountInSmallestUnits) {
          if (!senderTaprootAddress) {
            throw new Error('Wallet Taproot address unavailable for Turbo recovery');
          }
          logger.debug('[useTurboReview] Sufficient ecash - requesting Turbo send confirmation');
          setIsRequestingMint(false);
          Alert.alert(
            'Review Turbo send',
            `Send ${displayAmount} UNIT to this Taproot address?`,
            [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Create token',
                onPress: () => navigation.navigate('TurboProcessing', { senderTaprootAddress }),
              },
            ]
          );
          return;
        }

        // Not enough ecash - show bottom sheet
        logger.debug('[useTurboReview] Insufficient ecash - showing sheet');
        setIsRequestingMint(false);
        setInsufficientTurboAmount(displayAmount);
        // Convert smallest units back to display units for UI
        // The top-up path intentionally mints the full requested token amount.
        // Existing spendable Turbo change is left alone so stale/recovered
        // leftovers cannot be mixed into a new recipient token.
        setInsufficientTurboBalance(0);
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
  }, [
    sendAmount,
    sendAssetType,
    turboEnabled,
    navigation,
    isCashuMint,
    cashuQuoteId,
    isRequestingMint,
    senderTaprootAddress,
  ]);

  const handleUseTurbo = useCallback(async () => {
    setShowInsufficientTurboSheet(false);
    logger.debug('[useTurboReview] User chose Turbo with minting');

    try {
      setIsRequestingMint(true);

      // Mint the full send amount when topping up. Partial top-ups can race with
      // proof spends/recovery and leave the P2PK token creation short of funds.
      const fullTurboAmountSmallestUnits = Math.round(insufficientTurboAmount * 100);
      logger.debug('[useTurboReview] Calculating mint amount:', {
        totalRequired: insufficientTurboAmount,
        currentBalance: insufficientTurboBalance,
        mintAmount: fullTurboAmountSmallestUnits,
      });

      if (!senderTaprootAddress) {
        throw new Error('Wallet Taproot address unavailable for Turbo recovery');
      }

      const mintQuote = await rejectAfter(
        requestMint(fullTurboAmountSmallestUnits),
        TURBO_REVIEW_OPERATION_TIMEOUT_MS,
        'Preparing Turbo mint quote'
      );
      const requestedMintAmount = fullTurboAmountSmallestUnits;
      const originalRecipient = sendRecipient;
      await savePendingTurboSend(
        mintQuote.quoteId,
        originalRecipient,
        fullTurboAmountSmallestUnits,
        senderTaprootAddress,
        undefined,
        requestedMintAmount
      );

      logger.debug('[useTurboReview] Mint quote received:', {
        quoteId: mintQuote.quoteId,
        depositAddress: mintQuote.depositAddress,
        quoteAmount: mintQuote.amount,
        requestedMintAmount,
      });

      // sendAmount for the funding transaction is the exact Turbo token amount.
      const quoteDisplayAmount = (requestedMintAmount / 100).toString();
      logger.debug('[useTurboReview] Mint flow setup:', {
        originalSendAmount: sendAmount,
        mintAmount: requestedMintAmount,
        btcSendAmount: quoteDisplayAmount,
        finalTurboAmount: insufficientTurboAmount,
      });

      // Set send amount to the full mint amount. The existing Turbo balance stays untouched.
      setSendAmount(quoteDisplayAmount);
      setSendRecipient(mintQuote.depositAddress);
      setIsRequestingMint(false);

      navigation.navigate('Processing', {
        fromScreen: 'SendInput',
        action: 'create_intent',
        isTurbo: true,
        mintQuoteId: mintQuote.quoteId,
        mintAmount: fullTurboAmountSmallestUnits, // Full amount to send after minting
        mintClaimAmount: requestedMintAmount,
        turboRecipient: originalRecipient,
        senderTaprootAddress,
        assetType: 'unit',
        amount: quoteDisplayAmount,
        recipient: mintQuote.depositAddress,
      });
    } catch (error: unknown) {
      setIsRequestingMint(false);
      logger.error('[useTurboReview] Failed to request mint quote:', { error: error instanceof Error ? error.message : String(error) });
      Alert.alert('Error', 'Failed to initiate Turbo transaction. Please try again.');
    }
  }, [
    insufficientTurboAmount,
    insufficientTurboBalance,
    senderTaprootAddress,
    sendAmount,
    sendRecipient,
    setSendAmount,
    setSendRecipient,
    navigation,
  ]);

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
    setInsufficientTurboAmount,
    setInsufficientTurboBalance,
    insufficientTurboAmount,
    insufficientTurboBalance,
    handleReview,
    handleUseTurbo,
    handleSendNormally,
  };
}
