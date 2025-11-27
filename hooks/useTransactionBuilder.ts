/**
 * useTransactionBuilder Hook
 * Handles BTC and UNIT transaction creation with UTXO locking/unlocking
 */

import React, { useCallback } from 'react';
import { createBtcIntent as createBtcIntentService, createUnitIntent as createUnitIntentService } from '../services/transaction';
import { parseErrorMessage } from '../utils/errorParser';
import { ERRORS } from '../utils/messages';
import { logger } from '../utils/logger';
import { releaseOrphanedUtxos } from '../utils/pendingTransactionsUtils';
import { notify } from '../utils/notify';

import type { AssetType, IntentStep } from '../contexts/SendFlowContext';
import type { WalletAddresses } from '../contexts/WalletContext';
import type { TransactionIntent, AddressType, UnconfirmedUTXO as PendingUnconfirmedUTXO } from '../utils/pendingTransactionsUtils';
import type { UTXO } from '../services/transaction/utxoSelection';
import type { UtxoRef } from '../types/assets';
import type { BtcTransactionIntent, UnitTransactionIntent } from '../services/transaction';

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
function toUnconfirmedUtxo(pending: PendingUnconfirmedUTXO): { txid: string; vout: number; value: number; runeAmount?: number } {
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
  [key: string]: unknown;
}

/** Union type for transaction intents - either BTC or UNIT, with optional broadcast txid */
export type SendIntent = (BtcTransactionIntent | UnitTransactionIntent) & {
  txid?: string;
  signedTxHex?: string;
};

export interface UseTransactionBuilderParams {
  wallet: WalletAddresses | null;
  currentAccount: number;
  sendRecipient: string;
  sendAmount: string;
  sendAssetType: AssetType;
  requireConfirmedUtxos: boolean;
  runesBalance: RuneBalanceItem[] | null;
  sendIntent: SendIntent | null;
  setSendIntent: React.Dispatch<React.SetStateAction<SendIntent | null>>;
  setIntentStep: (step: IntentStep) => void;
  getUnconfirmedUTXOs: (addressType?: AddressType, excludeFromIntent?: TransactionIntent | null) => PendingUnconfirmedUTXO[];
  getSpentUtxos: () => Set<string>;
  markUtxosAsSpent: (utxos: UtxoRef[]) => Promise<void>;
  unmarkUtxosAsSpent: (utxos: UtxoRef[]) => Promise<void>;
  setSendRecipient: (recipient: string) => void;
}

interface UseTransactionBuilderReturn {
  createSendIntent: () => Promise<void>;
  cancelIntent: () => Promise<void>;
}

export function useTransactionBuilder({
  wallet,
  currentAccount,
  sendRecipient,
  sendAmount,
  sendAssetType,
  requireConfirmedUtxos,
  runesBalance,
  sendIntent,
  setSendIntent,
  setIntentStep,
  getUnconfirmedUTXOs,
  getSpentUtxos,
  markUtxosAsSpent,
  unmarkUtxosAsSpent,
  setSendRecipient,
}: UseTransactionBuilderParams): UseTransactionBuilderReturn {
  // Create BTC transaction
  const createBtcIntent = useCallback(async () => {
    let lockedUtxos: UtxoRef[] = [];

    try {
      if (!wallet?.segwitAddress) {
        throw new Error('Wallet not initialized');
      }

      const unconfirmedUtxos = getUnconfirmedUTXOs('segwit', sendIntent);
      const spentUtxos = getSpentUtxos();

      const intent = await createBtcIntentService(
        sendRecipient,
        sendAmount,
        wallet.segwitAddress,
        currentAccount,
        unconfirmedUtxos.map(toUtxo),
        spentUtxos
      );

      // Lock UTXOs immediately
      if (intent.inputs?.length > 0) {
        logger.debug('🔒 Locking UTXOs for BTC', { count: intent.inputs.length });
        lockedUtxos = intent.inputs.map(i => ({ txid: i.txid, vout: i.vout }));
        await markUtxosAsSpent(lockedUtxos);
      }

      setSendIntent(intent);
      setIntentStep('reviewing');
    } catch (error: unknown) {
      logger.error('Error creating BTC intent:', { error: error instanceof Error ? error.message : String(error) });

      if (lockedUtxos.length > 0) {
        await unmarkUtxosAsSpent(lockedUtxos);
      }
      await releaseOrphanedUtxos(getSpentUtxos, unmarkUtxosAsSpent);

      notify.build.error(parseErrorMessage(error));
      setTimeout(() => setIntentStep('entering_amount'), 100);
    }
  }, [sendRecipient, sendAmount, wallet, currentAccount, sendIntent, setSendIntent, setIntentStep, getUnconfirmedUTXOs, getSpentUtxos, markUtxosAsSpent, unmarkUtxosAsSpent]);

  // Create UNIT transaction
  const createUnitIntent = useCallback(async () => {
    let lockedUtxos: UtxoRef[] = [];

    try {
      if (!wallet?.taprootAddress || !wallet?.segwitAddress) {
        throw new Error('Wallet not initialized');
      }

      const unitAmount = runesBalance && runesBalance.length > 0
        ? (Array.isArray(runesBalance[0]) ? runesBalance[0][1] : runesBalance[0].amount)
        : 0;
      if (unitAmount === 0) {
        throw new Error(ERRORS.NO_UNIT_BALANCE);
      }

      const unconfirmedTaprootUtxos = requireConfirmedUtxos ? [] : getUnconfirmedUTXOs('taproot', sendIntent);
      const unconfirmedSegwitUtxos = requireConfirmedUtxos ? [] : getUnconfirmedUTXOs('segwit', sendIntent);
      const spentUtxos = getSpentUtxos();

      const intent = await createUnitIntentService(
        sendRecipient,
        sendAmount,
        wallet.taprootAddress,
        wallet.segwitAddress,
        currentAccount,
        unconfirmedTaprootUtxos.map(toUnconfirmedUtxo),
        unconfirmedSegwitUtxos.map(toUnconfirmedUtxo),
        spentUtxos
      );

      // Collect UTXOs to lock
      const utxosToLock: UtxoRef[] = [];

      if (intent.runeUtxos?.length) {
        intent.runeUtxos.forEach(u => utxosToLock.push({ txid: u.transaction, vout: u.vout }));
      } else if (intent.runeUtxo) {
        utxosToLock.push({ txid: intent.runeUtxo.transaction, vout: intent.runeUtxo.vout });
      }

      if (intent.satUtxo) {
        utxosToLock.push({ txid: intent.satUtxo.txid, vout: intent.satUtxo.vout });
      }

      if (utxosToLock.length > 0) {
        logger.debug('🔒 Locking UTXOs for UNIT', { count: utxosToLock.length });
        lockedUtxos = utxosToLock;
        await markUtxosAsSpent(utxosToLock);
      }

      setSendIntent(intent);
      setIntentStep('reviewing');
    } catch (error: unknown) {
      logger.error('Error creating UNIT intent:', { error: error instanceof Error ? error.message : String(error) });

      if (lockedUtxos.length > 0) {
        await unmarkUtxosAsSpent(lockedUtxos);
      }
      await releaseOrphanedUtxos(getSpentUtxos, unmarkUtxosAsSpent);

      notify.build.error(parseErrorMessage(error));
      setTimeout(() => setIntentStep('entering_amount'), 100);
    }
  }, [sendRecipient, sendAmount, wallet, currentAccount, requireConfirmedUtxos, runesBalance, sendIntent, setSendIntent, setIntentStep, getUnconfirmedUTXOs, getSpentUtxos, markUtxosAsSpent, unmarkUtxosAsSpent]);

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
  }, [sendRecipient, sendAmount, sendAssetType, setIntentStep, setSendRecipient, createBtcIntent, createUnitIntent]);

  // Cancel intent and release UTXOs
  const cancelIntent = useCallback(async () => {
    if (!sendIntent) return;

    logger.debug('🚫 Canceling transaction intent');

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
          utxosToRelease.push({ txid: sendIntent.runeUtxo.transaction, vout: sendIntent.runeUtxo.vout });
        }
        if (sendIntent.satUtxo) {
          utxosToRelease.push({ txid: sendIntent.satUtxo.txid, vout: sendIntent.satUtxo.vout });
        }
      }

      if (utxosToRelease.length > 0) {
        logger.debug('✅ Releasing UTXOs', { count: utxosToRelease.length });
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
