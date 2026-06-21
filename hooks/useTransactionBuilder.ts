/**
 * useTransactionBuilder Hook
 * Handles BTC and UNIT transaction creation with UTXO locking/unlocking
 */

import React, { useCallback } from 'react';
import {
  createBtcIntent as createBtcIntentService,
  createUnitIntent as createUnitIntentService,
} from '../services/transaction';
import { parseErrorMessage } from '../utils/errorParser';
import { ERRORS } from '../utils/messages';
import { logger } from '../utils/logger';
import { releaseOrphanedUtxos } from '../utils/pendingTransactionsUtils';
import { notify } from '../utils/notify';
import { isE2E } from '../utils/e2e';

import type { AssetType, IntentStep } from '../stores/sendFlowStore';
import type { WalletAddresses } from '../contexts/WalletContext';
import type {
  TransactionIntent,
  AddressType,
  UnconfirmedUTXO as PendingUnconfirmedUTXO,
  PendingTransaction as UtilsPendingTransaction,
} from '../utils/pendingTransactionsUtils';
import type { UTXO } from '../services/transaction/utxoSelection';
import type { UtxoRef } from '../types/assets';
import type { BtcTransactionIntent, UnitTransactionIntent } from '../services/transaction';
import type { WalletImportProfile } from '../constants/bitcoin';

/**
 * Convert PendingUnconfirmedUTXO to UTXO format for BTC transaction services
 */
function toUtxo(pending: PendingUnconfirmedUTXO): UTXO {
  return {
    txid: pending.txid,
    vout: pending.vout,
    value: pending.value ?? 0,
    status: pending.status,
  };
}

/**
 * Convert PendingUnconfirmedUTXO to UnconfirmedUtxo format for UNIT transaction services
 */
function toUnconfirmedUtxo(pending: PendingUnconfirmedUTXO): {
  txid: string;
  vout: number;
  value: number;
  runeAmount?: number;
} {
  return {
    txid: pending.txid,
    vout: pending.vout,
    value: pending.value ?? 0,
    runeAmount: pending.runeAmount,
  };
}

export interface RuneBalanceItem {
  rune?: string;
  runeId?: string;
  amount: string | number;
  divisibility?: number;
  symbol?: string;
}

/** Union type for transaction intents - either BTC or UNIT, with optional broadcast txid */
export type SendIntent = (BtcTransactionIntent | UnitTransactionIntent) & {
  txid?: string;
  signedTxHex?: string;
};

export interface UseTransactionBuilderParams {
  wallet: WalletAddresses | null;
  walletProfile?: WalletImportProfile;
  currentAccount: number;
  sendRecipient: string;
  sendAmount: string;
  sendAssetType: AssetType;
  selectedFeeRate: number;
  requireConfirmedUtxos: boolean;
  runesBalance: RuneBalanceItem[] | null;
  sendIntent: SendIntent | null;
  setSendIntent: React.Dispatch<React.SetStateAction<SendIntent | null>>;
  setIntentStep: (step: IntentStep) => void;
  getUnconfirmedUTXOs: (
    addressType?: AddressType,
    excludeFromIntent?: TransactionIntent | null
  ) => PendingUnconfirmedUTXO[];
  getPendingTransactions?: () => Record<string, UtilsPendingTransaction>;
  getSpentUtxos: () => Set<string>;
  markUtxosAsSpent: (utxos: UtxoRef[]) => Promise<void>;
  unmarkUtxosAsSpent: (utxos: UtxoRef[]) => Promise<void>;
  setSendRecipient: (recipient: string) => void;
}

interface UseTransactionBuilderReturn {
  createSendIntent: () => Promise<void>;
  cancelIntent: () => Promise<void>;
}

type BtcSourceType = 'segwit' | 'taproot';

const SEND_INTENT_BUILD_TIMEOUT_MS = 45_000;
const SEND_UTXO_OPERATION_TIMEOUT_MS = 12_000;

const getBtcSourceCandidates = (walletProfile: WalletImportProfile): BtcSourceType[] =>
  walletProfile === 'unisat' ? ['taproot', 'segwit'] : ['segwit', 'taproot'];

const isBtcFundingError = (error: unknown): boolean => {
  const message = error instanceof Error ? error.message : String(error);
  return [ERRORS.NO_CONFIRMED_FUNDS, ERRORS.INSUFFICIENT_FUNDS, 'All UTXOs are currently locked']
    .filter((candidate): candidate is string => typeof candidate === 'string' && candidate.length > 0)
    .some((candidate) => message.includes(candidate));
};

async function withSendOperationTimeout<T>(
  operation: () => Promise<T>,
  message: string,
  timeoutMs: number
): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      logger.warn('[SendProcessing] Send operation timed out', { timeoutMs, message });
      reject(new Error(message));
    }, timeoutMs);
    (timeoutId as { unref?: () => void }).unref?.();
  });

  const operationPromise = Promise.resolve().then(operation);

  return Promise.race([operationPromise, timeoutPromise]).finally(() => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  });
}

async function bestEffortSendCleanup(
  operation: () => Promise<void>,
  message: string
): Promise<void> {
  try {
    await withSendOperationTimeout(operation, message, SEND_UTXO_OPERATION_TIMEOUT_MS);
  } catch (cleanupError) {
    logger.warn('[SendProcessing] Cleanup timed out or failed', {
      error: cleanupError instanceof Error ? cleanupError.message : String(cleanupError),
    });
  }
}

/**
 * Hook for building Bitcoin and UNIT (Runes) transaction intents
 * Handles UTXO selection, locking, and PSBT creation with proper cleanup on failure
 *
 * @param params - Configuration parameters for transaction building
 * @param params.wallet - Wallet addresses (segwit and taproot)
 * @param params.currentAccount - Current BIP32 account index
 * @param params.sendRecipient - Destination address
 * @param params.sendAmount - Amount to send (in BTC or UNIT)
 * @param params.sendAssetType - Type of asset ('BTC' or 'UNIT')
 * @param params.requireConfirmedUtxos - Whether to only use confirmed UTXOs
 * @param params.runesBalance - Current Runes balance for UNIT transactions
 * @param params.sendIntent - Current transaction intent (if any)
 * @param params.setSendIntent - Function to update send intent state
 * @param params.setIntentStep - Function to update send flow step
 * @param params.getUnconfirmedUTXOs - Get unconfirmed UTXOs for address type
 * @param params.getSpentUtxos - Get set of spent UTXO keys
 * @param params.markUtxosAsSpent - Lock UTXOs to prevent double-spending
 * @param params.unmarkUtxosAsSpent - Release locked UTXOs on cancel/failure
 * @param params.setSendRecipient - Update recipient address
 * @returns Object containing createSendIntent and cancelIntent functions
 */
export function useTransactionBuilder({
  wallet,
  walletProfile = 'xverse',
  currentAccount,
  sendRecipient,
  sendAmount,
  sendAssetType,
  selectedFeeRate,
  requireConfirmedUtxos,
  runesBalance,
  sendIntent,
  setSendIntent,
  setIntentStep,
  getUnconfirmedUTXOs,
  getPendingTransactions,
  getSpentUtxos,
  markUtxosAsSpent,
  unmarkUtxosAsSpent,
  setSendRecipient,
}: UseTransactionBuilderParams): UseTransactionBuilderReturn {
  // Create BTC transaction
  const createBtcIntent = useCallback(async () => {
    let lockedUtxos: UtxoRef[] = [];

    try {
      if (!wallet?.segwitAddress && !wallet?.taprootAddress) {
        throw new Error('Wallet not initialized');
      }

      logger.debug('[createBtcIntent] Starting BTC intent creation');
      logger.debug('[createBtcIntent] Current sendIntent:', sendIntent ? 'exists' : 'null');

      // Release any orphaned UTXOs from previous failed attempts BEFORE building intent
      await withSendOperationTimeout(
        () => releaseOrphanedUtxos(getSpentUtxos, unmarkUtxosAsSpent, getPendingTransactions),
        'Timed out preparing wallet UTXOs. Please try again.',
        SEND_UTXO_OPERATION_TIMEOUT_MS
      );

      // If there's an existing intent, release its UTXOs since we're rebuilding, not chaining
      if (sendIntent && !sendIntent.txid && sendIntent.assetType === 'BTC') {
        const oldUtxosToRelease: UtxoRef[] =
          sendIntent.inputs?.map((i: UTXO) => ({ txid: i.txid, vout: i.vout })) || [];
        if (oldUtxosToRelease.length > 0) {
          logger.debug('[createBtcIntent] Releasing old intent UTXOs before rebuild:', {
            count: oldUtxosToRelease.length,
          });
          await withSendOperationTimeout(
            () => unmarkUtxosAsSpent(oldUtxosToRelease),
            'Timed out releasing the previous send request. Please try again.',
            SEND_UTXO_OPERATION_TIMEOUT_MS
          );
        }
      }

      const spentUtxos = getSpentUtxos();
      logger.debug('[createBtcIntent] Spent UTXOs:', {
        count: spentUtxos.size,
        keys: Array.from(spentUtxos).slice(0, 5),
      });

      let intent: BtcTransactionIntent | null = null;
      let firstFundingError: unknown = null;
      const sourceCandidates = getBtcSourceCandidates(walletProfile);

      for (const sourceType of sourceCandidates) {
        const sourceAddress =
          sourceType === 'taproot' ? wallet.taprootAddress : wallet.segwitAddress;
        if (!sourceAddress) {
          continue;
        }

        // Pass null to avoid excluding old intent's UTXOs - we're starting fresh.
        const unconfirmedUtxos = getUnconfirmedUTXOs(sourceType, null);

        logger.debug('[createBtcIntent] Trying BTC source:', {
          sourceType,
          unconfirmedCount: unconfirmedUtxos.length,
          utxos: unconfirmedUtxos.map((u) => ({
            txid: u.txid.slice(0, 16) + '...',
            vout: u.vout,
            value: u.value,
          })),
        });

        try {
          intent = await withSendOperationTimeout(
            () =>
              createBtcIntentService(
                sendRecipient,
                sendAmount,
                sourceAddress,
                currentAccount,
                unconfirmedUtxos.map(toUtxo),
                spentUtxos,
                selectedFeeRate,
                sourceType
              ),
            'Timed out preparing the BTC send. Please try again.',
            SEND_INTENT_BUILD_TIMEOUT_MS
          );
          break;
        } catch (error: unknown) {
          if (!isBtcFundingError(error)) {
            throw error;
          }

          firstFundingError = firstFundingError ?? error;
          logger.info('[createBtcIntent] BTC source cannot fund send; trying fallback', {
            sourceType,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }

      if (!intent) {
        throw firstFundingError instanceof Error
          ? firstFundingError
          : new Error(ERRORS.NO_CONFIRMED_FUNDS);
      }

      // Lock UTXOs immediately
      if (intent.inputs?.length > 0) {
        logger.debug('🔒 Locking UTXOs for BTC', { count: intent.inputs.length });
        lockedUtxos = intent.inputs.map((i) => ({ txid: i.txid, vout: i.vout }));
        await withSendOperationTimeout(
          () => markUtxosAsSpent(lockedUtxos),
          'Timed out saving the send request. Please try again.',
          SEND_UTXO_OPERATION_TIMEOUT_MS
        );
      }

      setSendIntent(intent);
      setIntentStep('reviewing');
    } catch (error: unknown) {
      logger.error('Error creating BTC intent:', {
        error: error instanceof Error ? error.message : String(error),
      });

      if (lockedUtxos.length > 0) {
        await bestEffortSendCleanup(
          () => unmarkUtxosAsSpent(lockedUtxos),
          'Timed out releasing failed BTC send UTXOs. Please refresh the wallet.'
        );
      }
      await bestEffortSendCleanup(
        () => releaseOrphanedUtxos(getSpentUtxos, unmarkUtxosAsSpent, getPendingTransactions),
        'Timed out releasing stale wallet UTXOs. Please refresh the wallet.'
      );

      notify.build.error(parseErrorMessage(error));
      setTimeout(() => setIntentStep('entering_amount'), 100);
    }
  }, [
    sendRecipient,
    sendAmount,
    wallet,
    walletProfile,
    currentAccount,
    sendIntent,
    selectedFeeRate,
    setSendIntent,
    setIntentStep,
    getUnconfirmedUTXOs,
    getPendingTransactions,
    getSpentUtxos,
    markUtxosAsSpent,
    unmarkUtxosAsSpent,
  ]);

  // Create UNIT transaction
  const createUnitIntent = useCallback(async () => {
    let lockedUtxos: UtxoRef[] = [];

    try {
      if (!wallet?.taprootAddress || !wallet?.segwitAddress) {
        throw new Error('Wallet not initialized');
      }

      // Legacy fixture path: skip UTXO lookup and PSBT building.
      if (isE2E()) {
        const parsedAmount = parseFloat(sendAmount) || 0;
        const fakeIntent: UnitTransactionIntent = {
          id: `e2e-unit-${Date.now()}`,
          type: 'send',
          assetType: 'UNIT',
          amount: Math.round(parsedAmount * 100),
          amountDisplay: `${sendAmount} UNIT`,
          recipient: sendRecipient,
          fee: 445,
          addressType: 'taproot',
          sourceAddress: wallet.taprootAddress,
          feeAddress: wallet.segwitAddress,
          runeUtxos: [
            {
              transaction: 'e2e-mock-rune-txid',
              vout: 0,
              value: 600,
              runeAmount: Math.round(parsedAmount * 100),
              status: { confirmed: true },
            },
          ],
          runeUtxo: {
            transaction: 'e2e-mock-rune-txid',
            vout: 0,
            value: 600,
            runeAmount: Math.round(parsedAmount * 100),
            status: { confirmed: true },
          },
          satUtxo: {
            txid: 'e2e-mock-sat-txid',
            vout: 0,
            value: 30000,
            status: { confirmed: true },
          },
          totalInput: 30600,
          change: 30155,
          psbt: 'e2e-mock-psbt',
          timestamp: Date.now(),
        };
        logger.info('[createUnitIntent] E2E fixture intent created', { amount: sendAmount });
        setSendIntent(fakeIntent);
        setIntentStep('reviewing');
        return;
      }

      const unitAmount =
        runesBalance && runesBalance.length > 0
          ? Array.isArray(runesBalance[0])
            ? runesBalance[0][1]
            : runesBalance[0].amount
          : 0;
      if (unitAmount === 0) {
        throw new Error(ERRORS.NO_UNIT_BALANCE);
      }

      // Release any orphaned UTXOs from previous failed attempts BEFORE building intent
      await withSendOperationTimeout(
        () => releaseOrphanedUtxos(getSpentUtxos, unmarkUtxosAsSpent, getPendingTransactions),
        'Timed out preparing wallet UTXOs. Please try again.',
        SEND_UTXO_OPERATION_TIMEOUT_MS
      );

      // If there's an existing intent, release its UTXOs since we're rebuilding, not chaining
      if (sendIntent && !sendIntent.txid && sendIntent.assetType === 'UNIT') {
        const oldUtxosToRelease: UtxoRef[] = [];
        if (sendIntent.runeUtxo) {
          oldUtxosToRelease.push({
            txid: sendIntent.runeUtxo.transaction,
            vout: sendIntent.runeUtxo.vout,
          });
        }
        if (sendIntent.satUtxo) {
          oldUtxosToRelease.push({ txid: sendIntent.satUtxo.txid, vout: sendIntent.satUtxo.vout });
        }
        if (oldUtxosToRelease.length > 0) {
          logger.debug('[createUnitIntent] Releasing old intent UTXOs before rebuild:', {
            count: oldUtxosToRelease.length,
          });
          await withSendOperationTimeout(
            () => unmarkUtxosAsSpent(oldUtxosToRelease),
            'Timed out releasing the previous UNIT send request. Please try again.',
            SEND_UTXO_OPERATION_TIMEOUT_MS
          );
        }
      }

      // Pass null to avoid excluding old intent's UTXOs - we're starting fresh
      const unconfirmedTaprootUtxos = requireConfirmedUtxos
        ? []
        : getUnconfirmedUTXOs('taproot', null);
      const unconfirmedSegwitUtxos = requireConfirmedUtxos
        ? []
        : getUnconfirmedUTXOs('segwit', null);
      const spentUtxos = getSpentUtxos();

      const intent = await withSendOperationTimeout(
        () =>
          createUnitIntentService(
            sendRecipient,
            sendAmount,
            wallet.taprootAddress,
            wallet.segwitAddress,
            currentAccount,
            unconfirmedTaprootUtxos.map(toUnconfirmedUtxo),
            unconfirmedSegwitUtxos.map(toUnconfirmedUtxo),
            spentUtxos
          ),
        'Timed out preparing the UNIT send. Please try again.',
        SEND_INTENT_BUILD_TIMEOUT_MS
      );

      // Collect UTXOs to lock
      const utxosToLock: UtxoRef[] = [];

      if (intent.runeUtxos?.length) {
        intent.runeUtxos.forEach((u) => utxosToLock.push({ txid: u.transaction, vout: u.vout }));
      } else if (intent.runeUtxo) {
        utxosToLock.push({ txid: intent.runeUtxo.transaction, vout: intent.runeUtxo.vout });
      }

      if (intent.satUtxo) {
        utxosToLock.push({ txid: intent.satUtxo.txid, vout: intent.satUtxo.vout });
      }

      if (utxosToLock.length > 0) {
        logger.debug('🔒 Locking UTXOs for UNIT', { count: utxosToLock.length });
        lockedUtxos = utxosToLock;
        await withSendOperationTimeout(
          () => markUtxosAsSpent(utxosToLock),
          'Timed out saving the UNIT send request. Please try again.',
          SEND_UTXO_OPERATION_TIMEOUT_MS
        );
      }

      setSendIntent(intent);
      setIntentStep('reviewing');
    } catch (error: unknown) {
      logger.error('Error creating UNIT intent:', {
        error: error instanceof Error ? error.message : String(error),
      });

      if (lockedUtxos.length > 0) {
        await bestEffortSendCleanup(
          () => unmarkUtxosAsSpent(lockedUtxos),
          'Timed out releasing failed UNIT send UTXOs. Please refresh the wallet.'
        );
      }
      await bestEffortSendCleanup(
        () => releaseOrphanedUtxos(getSpentUtxos, unmarkUtxosAsSpent, getPendingTransactions),
        'Timed out releasing stale wallet UTXOs. Please refresh the wallet.'
      );

      notify.build.error(parseErrorMessage(error));
      setTimeout(() => setIntentStep('entering_amount'), 100);
    }
  }, [
    sendRecipient,
    sendAmount,
    wallet,
    currentAccount,
    requireConfirmedUtxos,
    runesBalance,
    sendIntent,
    setSendIntent,
    setIntentStep,
    getUnconfirmedUTXOs,
    getPendingTransactions,
    getSpentUtxos,
    markUtxosAsSpent,
    unmarkUtxosAsSpent,
  ]);

  // Main create intent function
  const createSendIntent = useCallback(async () => {
    const trimmedRecipient = sendRecipient.trim();
    setIntentStep('creating');

    if (!trimmedRecipient || !sendAmount) {
      notify.build.missingRecipientAmount();
      setTimeout(() => setIntentStep('entering_amount'), 100);
      return;
    }

    setSendRecipient(trimmedRecipient);

    if (sendAssetType === 'btc') {
      await createBtcIntent();
    } else if (sendAssetType === 'unit') {
      await createUnitIntent();
    } else {
      notify.build.assetRequired();
      setTimeout(() => setIntentStep('selecting_asset'), 100);
    }
  }, [
    sendRecipient,
    sendAmount,
    sendAssetType,
    setIntentStep,
    setSendRecipient,
    createBtcIntent,
    createUnitIntent,
  ]);

  // Cancel intent and release UTXOs
  const cancelIntent = useCallback(async () => {
    if (!sendIntent) return;

    logger.debug('Canceling transaction intent');

    // Only release UTXOs if not broadcast
    if (!sendIntent.txid) {
      const utxosToRelease: UtxoRef[] = [];

      // Handle based on asset type
      if (sendIntent.assetType === 'BTC') {
        // BTC transactions have inputs array
        sendIntent.inputs.forEach((i: UTXO) => utxosToRelease.push({ txid: i.txid, vout: i.vout }));
      } else if (sendIntent.assetType === 'UNIT') {
        // UNIT transactions have runeUtxo and satUtxo
        if (sendIntent.runeUtxo) {
          utxosToRelease.push({
            txid: sendIntent.runeUtxo.transaction,
            vout: sendIntent.runeUtxo.vout,
          });
        }
        if (sendIntent.satUtxo) {
          utxosToRelease.push({ txid: sendIntent.satUtxo.txid, vout: sendIntent.satUtxo.vout });
        }
      }

      if (utxosToRelease.length > 0) {
        logger.debug('Releasing UTXOs', { count: utxosToRelease.length });
        await unmarkUtxosAsSpent(utxosToRelease);
      }
    }

    setSendIntent(null);
    setIntentStep('idle');
  }, [sendIntent, setSendIntent, setIntentStep, unmarkUtxosAsSpent]);

  return {
    createSendIntent,
    cancelIntent,
  };
}
