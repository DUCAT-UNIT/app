/**
 * useFuseEcash Hook
 * Handles converting e-cash to on-chain UNIT (Fuse operation)
 */

import { useCallback } from 'react';
import { Alert } from 'react-native';
import { analytics } from '../services/analyticsService';
import { CASHU_EVENTS } from '../constants/analyticsEvents';
import { logger } from '../utils/logger';
import { notify } from '../utils/notify';
import {
  requestMaxMelt,
  completeMeltWithoutCleanup,
  cleanupMeltProofs,
  removeSpentProofs,
} from '../services/cashu/cashuWalletService';
import {
  cashuUnitDisplayName,
  cashuUnitTokenSymbol,
  DEFAULT_CASHU_UNIT,
  type CashuUnit,
} from '../services/cashu/cashuUnits';
import { formatBalance } from '../utils/formatters';

interface TransactionOutput {
  scriptpubkey_address?: string;
}

interface TransactionStatus {
  block_time?: number;
}

interface Transaction {
  txid: string;
  vout?: TransactionOutput[];
  status?: TransactionStatus;
}

interface UseFuseEcashParams {
  cashuBalance: number;
  taprootAddress: string;
  transactionHistory: Transaction[] | unknown[];
  fetchTransactionHistory: () => Promise<void> | void;
  cashuUnit?: CashuUnit;
}

interface UseFuseEcashReturn {
  handleFusePress: () => Promise<void>;
}

const CASHU_UNIT_DISPLAY_SCALE = 100;

const formatTurboAmount = (amount: number, unit: CashuUnit): string =>
  unit === 'sat'
    ? formatBalance(amount / 100_000_000)
    : (amount / CASHU_UNIT_DISPLAY_SCALE).toFixed(2);

interface MeltErrorMetadata {
  meltSubmissionStatus?: 'not_submitted' | 'unknown' | 'accepted' | 'rejected';
  spentProofsRemoved?: number;
}

const getMeltErrorMetadata = (error: unknown): MeltErrorMetadata => {
  if (!error || typeof error !== 'object') {
    return {};
  }
  const maybeMetadata = error as MeltErrorMetadata;
  return {
    meltSubmissionStatus: maybeMetadata.meltSubmissionStatus,
    spentProofsRemoved: maybeMetadata.spentProofsRemoved,
  };
};

const VALID_TOKEN_FAILURE_PATTERN = /(?:tokens?|proofs?) remain valid/i;

const getRedeemFailureDescription = (tokenLabel: string, message: string): string => {
  if (VALID_TOKEN_FAILURE_PATTERN.test(message)) {
    return `Your ${tokenLabel} tokens remain valid. Try again in a moment.`;
  }
  return `Your ${tokenLabel} tokens remain valid. ${message}`;
};

export function useFuseEcash({
  cashuBalance,
  taprootAddress,
  transactionHistory,
  fetchTransactionHistory,
  cashuUnit = DEFAULT_CASHU_UNIT,
}: UseFuseEcashParams): UseFuseEcashReturn {
  const handleFusePress = useCallback(async () => {
    const tokenLabel =
      cashuUnit === DEFAULT_CASHU_UNIT ? 'TurboUNIT' : cashuUnitDisplayName(cashuUnit);
    const assetSymbol = cashuUnitTokenSymbol(cashuUnit);
    const availableAmountLabel =
      cashuUnit === DEFAULT_CASHU_UNIT
        ? `${formatTurboAmount(cashuBalance, cashuUnit)} ${tokenLabel}`
        : `${formatTurboAmount(cashuBalance, cashuUnit)} ${assetSymbol}`;
    if (cashuBalance <= 0) {
      notify.snackbar({
        type: 'info',
        title: `No ${tokenLabel}`,
        description: `You don't have any ${tokenLabel} to redeem.`,
      });
      return;
    }

    Alert.alert(
      `Redeem ${tokenLabel}?`,
      `Convert up to ${availableAmountLabel} to on-chain ${assetSymbol}? Network fees are deducted from the redeemed amount.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Redeem',
          onPress: async () => {
            let meltSubmitted = false;
            let cleanupFailed = false;
            try {
              // Request the largest quote the current balance can cover after fees.
              const quote =
                cashuUnit === DEFAULT_CASHU_UNIT
                  ? await requestMaxMelt(taprootAddress, cashuBalance)
                  : await requestMaxMelt(taprootAddress, cashuBalance, cashuUnit);
              analytics.track(CASHU_EVENTS.CASHU_MELT_STARTED, {
                amount: quote.amount,
                availableAmount: cashuBalance,
                fee: quote.fee,
              });

              // Complete melt but keep proofs until we see the tx
              const meltResult =
                cashuUnit === DEFAULT_CASHU_UNIT
                  ? await completeMeltWithoutCleanup(quote.quoteId, quote.total)
                  : await completeMeltWithoutCleanup(quote.quoteId, quote.total, cashuUnit);
              meltSubmitted = true;

              // Clean up proofs immediately after successful melt
              logger.debug('[Fuse] Melt successful, cleaning up proofs');
              try {
                if (cashuUnit === DEFAULT_CASHU_UNIT) {
                  await cleanupMeltProofs(
                    meltResult.proofsToRemove,
                    meltResult.changeProofs,
                    DEFAULT_CASHU_UNIT,
                    meltResult.taprootAddress ?? null
                  );
                } else {
                  await cleanupMeltProofs(
                    meltResult.proofsToRemove,
                    meltResult.changeProofs,
                    cashuUnit,
                    meltResult.taprootAddress ?? null
                  );
                }
              } catch (cleanupError) {
                cleanupFailed = true;
                logger.error('[Fuse] Melt accepted but local cleanup failed', {
                  error:
                    cleanupError instanceof Error ? cleanupError.message : String(cleanupError),
                });
                if (
                  cleanupError instanceof Error &&
                  cleanupError.message.includes('Cashu account changed')
                ) {
                  throw cleanupError;
                }
                try {
                  const cleanup =
                    cashuUnit === DEFAULT_CASHU_UNIT
                      ? await removeSpentProofs()
                      : await removeSpentProofs(cashuUnit);
                  logger.info('[Fuse] Reconciled spent proofs after cleanup failure', {
                    removed: cleanup.removed,
                    kept: cleanup.kept,
                  });
                } catch (reconcileError) {
                  logger.error('[Fuse] Failed to reconcile spent proofs after cleanup failure', {
                    error:
                      reconcileError instanceof Error
                        ? reconcileError.message
                        : String(reconcileError),
                  });
                }
              }

              notify.snackbar({
                type: cleanupFailed ? 'warning' : 'submitted',
                title: cleanupFailed ? 'Redeem submitted' : 'Redeem submitted',
                description: cleanupFailed
                  ? `Redeeming ${formatTurboAmount(quote.amount, cashuUnit)} ${assetSymbol}. Local ${tokenLabel} cleanup did not finish; refresh before sending ${tokenLabel} again.`
                  : `Redeeming ${formatTurboAmount(quote.amount, cashuUnit)} ${assetSymbol}. Waiting for transaction to appear on-chain...`,
              });

              // Poll for transaction
              let txFound = false;
              let attempts = 0;
              const maxAttempts = 30;

              while (!txFound && attempts < maxAttempts) {
                attempts++;
                logger.debug(`[Fuse] Polling attempt ${attempts}/${maxAttempts}`);
                await new Promise((resolve) => setTimeout(resolve, 2000));

                await fetchTransactionHistory();

                txFound = transactionHistory.some((rawTx) => {
                  const tx = rawTx as Transaction;
                  const hasOurAddress = tx.vout?.some(
                    (output: TransactionOutput) => output.scriptpubkey_address === taprootAddress
                  );
                  if (!hasOurAddress) return false;

                  const txTime = tx.status?.block_time;
                  if (!txTime) {
                    logger.debug(`[Fuse] Found unconfirmed transaction: ${tx.txid}`);
                    return true;
                  }

                  const now = Math.floor(Date.now() / 1000);
                  return now - txTime < 120;
                });

                if (txFound) break;
              }

              await fetchTransactionHistory();

              if (txFound) {
                notify.snackbar({
                  type: 'success',
                  title: 'Redeem complete',
                  description: `${tokenLabel} was redeemed to on-chain ${assetSymbol}.`,
                });
              } else {
                notify.snackbar({
                  type: 'pending',
                  title: 'Redeem pending',
                  description: 'Transaction will appear on-chain shortly.',
                });
              }
            } catch (error: unknown) {
              const message = error instanceof Error ? error.message : String(error);
              const meltMetadata = getMeltErrorMetadata(error);
              const submissionAccepted =
                meltSubmitted ||
                meltMetadata.meltSubmissionStatus === 'accepted' ||
                (meltMetadata.spentProofsRemoved ?? 0) > 0;
              const submissionUnknown =
                !submissionAccepted && meltMetadata.meltSubmissionStatus === 'unknown';
              notify.snackbar({
                type: submissionAccepted || submissionUnknown ? 'warning' : 'error',
                title: submissionAccepted
                  ? 'Redeem submitted'
                  : submissionUnknown
                    ? 'Redeem status unknown'
                    : 'Redeem failed',
                description: submissionAccepted
                  ? `The mint accepted the redeem, but local cleanup did not finish. Refresh before sending ${tokenLabel} again.`
                  : submissionUnknown
                    ? `The app could not confirm whether the mint received the request. Refresh before sending ${tokenLabel} again.`
                    : getRedeemFailureDescription(tokenLabel, message),
              });
            }
          },
        },
      ]
    );
  }, [cashuBalance, taprootAddress, fetchTransactionHistory, transactionHistory, cashuUnit]);

  return { handleFusePress };
}
