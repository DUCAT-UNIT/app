/**
 * useTransactionSigning Hook
 * Handles PSBT signing logic
 */

import { useCallback } from 'react';
import { signIntent as signIntentService } from '../../services/transaction';
import type { TransactionIntent as SigningTransactionIntent } from '../../services/transactionSigningService';
import { parseErrorMessage } from '../../utils/errorParser';
import { ERRORS } from '../../utils/messages';
import { logger } from '../../utils/logger';
import type { SendIntent } from '../../contexts/TransactionBuildContext';
import type { SnackbarParams } from '../../stores/notificationStore';
import type { IntentStep } from '../../stores/sendFlowStore';

export interface UseTransactionSigningOptions {
  currentAccount: number;
  sendIntent: SendIntent | null;
  setSendIntent: (intent: SendIntent | null) => void;
  setIntentStep: (step: IntentStep) => void;
  showSnackbar: (params: SnackbarParams) => void;
  getSnackbarAction: () => string;
}

export interface SignResult {
  signedIntent: SendIntent;
  txid: string;
}

export interface UseTransactionSigningResult {
  /** Sign the current intent and return the signed intent with txid */
  signTransaction: () => Promise<SignResult | null>;
}

export function useTransactionSigning({
  currentAccount,
  sendIntent,
  setSendIntent,
  setIntentStep,
  showSnackbar,
  getSnackbarAction,
}: UseTransactionSigningOptions): UseTransactionSigningResult {
  const signTransaction = useCallback(async (): Promise<SignResult | null> => {
    try {
      setIntentStep('signing');

      if (!sendIntent) {
        showSnackbar({
          type: 'error',
          action: getSnackbarAction(),
          message: ERRORS.TRANSACTION_CANCELLED,
        });
        setIntentStep('idle');
        return null;
      }

      const { signedTxHex, txid } = await signIntentService(
        sendIntent as SigningTransactionIntent,
        currentAccount
      );

      // Update intent with signed transaction
      const signedIntent: SendIntent = {
        ...sendIntent,
        signedTxHex,
        txid,
      };

      setSendIntent(signedIntent);
      setIntentStep('broadcasting');

      return { signedIntent, txid };
    } catch (error) {
      logger.error('Error signing transaction:', {
        error: error instanceof Error ? error.message : String(error),
      });
      showSnackbar({
        type: 'error',
        action: getSnackbarAction(),
        message: parseErrorMessage(error),
      });
      setIntentStep('reviewing');
      return null;
    }
  }, [sendIntent, currentAccount, setIntentStep, setSendIntent, showSnackbar, getSnackbarAction]);

  return { signTransaction };
}
