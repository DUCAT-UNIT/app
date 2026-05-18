import { useState, useEffect, useRef } from 'react';
import type { NavigationProp } from '@react-navigation/native';
import { logger } from '../utils/logger';
import { useCashuBalanceState, useCashuOperations } from '../contexts/CashuContext';
import { DEFAULT_CASHU_UNIT, type CashuUnit } from '../services/cashu/cashuUnits';

interface UseCashuMintCompletionParams {
  cashuMint: boolean | undefined;
  quoteId: string | undefined;
  mintAmount: number | undefined;
  cashuUnit?: CashuUnit;
  senderTaprootAddress?: string;
  fetchTransactionHistory?: () => Promise<void>;
  refreshCashuBalance: () => Promise<void>;
  navigation?: NavigationProp<Record<string, object | undefined>>;
}

interface UseCashuMintCompletionReturn {
  isCompletingMint: boolean;
}

/**
 * Hook to handle Cashu mint completion for threshold conversion.
 *
 * Instead of polling directly (which dies when the screen unmounts or the
 * wallet locks), this hook registers the pending mint with the app-level
 * CashuContext. The existing useCashuMint polling (every 5s, mounted in
 * CashuProvider) will auto-complete the mint even if ConfirmationScreen
 * is dismissed.
 */
export function useCashuMintCompletion({
  cashuMint,
  quoteId,
  mintAmount,
  cashuUnit = DEFAULT_CASHU_UNIT,
  senderTaprootAddress,
  navigation,
}: UseCashuMintCompletionParams): UseCashuMintCompletionReturn {
  const [isCompletingMint, setIsCompletingMint] = useState(false);
  const hasRegistered = useRef(false);

  // Access the app-level pending mints system
  const { pendingMints, pendingBtcMints } = useCashuBalanceState();
  const { addPendingMint, addPendingBtcMint } = useCashuOperations();

  // Register the pending mint with app-level CashuContext on mount
  useEffect(() => {
    if (!cashuMint || !quoteId || !mintAmount) {
      return;
    }

    if (hasRegistered.current) {
      return;
    }

    hasRegistered.current = true;
    setIsCompletingMint(true);

    logger.debug('[useCashuMintCompletion] Registering pending mint with app-level polling', {
      quoteId: quoteId.substring(0, 8),
      mintAmount,
      cashuUnit,
    });
    logger.info(`[E2E_TX] cashu_mint_registered amount=${mintAmount} cashuUnit=${cashuUnit}`);

    // Add to app-level pendingMints so useCashuMint's polling will auto-complete it
    if (cashuUnit === 'sat') {
      addPendingBtcMint(quoteId, mintAmount, senderTaprootAddress);
    } else {
      addPendingMint(quoteId, mintAmount, senderTaprootAddress);
    }
  }, [
    cashuMint,
    quoteId,
    mintAmount,
    cashuUnit,
    senderTaprootAddress,
    addPendingMint,
    addPendingBtcMint,
  ]);

  // Track when the mint completes via the app-level polling
  useEffect(() => {
    if (!isCompletingMint || !quoteId) return;

    // Check if our quote is still in pendingMints - if it was removed, mint completed
    const activePendingMints = cashuUnit === 'sat' ? pendingBtcMints : pendingMints;
    const stillPending = activePendingMints.some((m) => m.quoteId === quoteId);
    if (!stillPending && hasRegistered.current) {
      // The app-level polling completed our mint
      logger.debug('[useCashuMintCompletion] Mint completed by app-level polling', {
        quoteId: quoteId.substring(0, 8),
      });
      logger.info(`[E2E_TX] cashu_mint_completed amount=${mintAmount ?? 0} cashuUnit=${cashuUnit}`);
      setIsCompletingMint(false);

      // Dismiss the SendFlow modal so the user can interact with the wallet again
      if (navigation) {
        const parent = navigation.getParent?.();
        if (parent) {
          parent.goBack();
        }
      }
    }
  }, [pendingMints, pendingBtcMints, quoteId, isCompletingMint, navigation, cashuUnit]);

  return {
    isCompletingMint,
  };
}
