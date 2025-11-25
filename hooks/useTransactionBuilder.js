/**
 * useTransactionBuilder Hook
 * Handles BTC and UNIT transaction creation with UTXO locking/unlocking
 */

import { useCallback } from 'react';
import { createBtcIntent as createBtcIntentService, createUnitIntent as createUnitIntentService } from '../services/transaction';
import { parseErrorMessage } from '../utils/errorParser';
import { ERRORS } from '../utils/messages';
import { logger } from '../utils/logger';
import { releaseOrphanedUtxos } from '../utils/pendingTransactionsUtils';

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
  showToast,
  getUnconfirmedUTXOs,
  getSpentUtxos,
  markUtxosAsSpent,
  unmarkUtxosAsSpent,
  setSendRecipient,
}) {
  // Create BTC transaction
  const createBtcIntent = useCallback(async () => {
    let lockedUtxos = [];

    try {
      const unconfirmedUtxos = getUnconfirmedUTXOs('segwit', sendIntent);
      const spentUtxos = getSpentUtxos();

      const intent = await createBtcIntentService(
        sendRecipient,
        sendAmount,
        wallet.segwitAddress,
        currentAccount,
        unconfirmedUtxos,
        spentUtxos
      );

      // Lock UTXOs immediately
      if (intent.inputs?.length > 0) {
        logger.debug('🔒 Locking', intent.inputs.length, 'UTXOs for BTC');
        lockedUtxos = intent.inputs.map(i => ({ txid: i.txid, vout: i.vout }));
        await markUtxosAsSpent(lockedUtxos);
      }

      setSendIntent(intent);
      setIntentStep('reviewing');
    } catch (error) {
      logger.error('Error creating BTC intent:', error);

      if (lockedUtxos.length > 0) {
        await unmarkUtxosAsSpent(lockedUtxos);
      }
      await releaseOrphanedUtxos(getSpentUtxos, unmarkUtxosAsSpent);

      showToast(parseErrorMessage(error), 'error');
      setTimeout(() => setIntentStep('entering_amount'), 100);
    }
  }, [sendRecipient, sendAmount, wallet, currentAccount, sendIntent, setSendIntent, setIntentStep, showToast, getUnconfirmedUTXOs, getSpentUtxos, markUtxosAsSpent, unmarkUtxosAsSpent]);

  // Create UNIT transaction
  const createUnitIntent = useCallback(async () => {
    let lockedUtxos = [];

    try {
      if (!wallet?.taprootAddress || !wallet?.segwitAddress) {
        throw new Error('Wallet not initialized');
      }

      const unitAmount = runesBalance?.length > 0 ? parseFloat(runesBalance[0][1]) : 0;
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
        unconfirmedTaprootUtxos,
        unconfirmedSegwitUtxos,
        spentUtxos
      );

      // Collect UTXOs to lock
      const utxosToLock = [];

      if (intent.runeUtxos?.length) {
        intent.runeUtxos.forEach(u => utxosToLock.push({ txid: u.transaction, vout: u.vout }));
      } else if (intent.runeUtxo) {
        utxosToLock.push({ txid: intent.runeUtxo.transaction, vout: intent.runeUtxo.vout });
      }

      if (intent.satUtxo) {
        utxosToLock.push({ txid: intent.satUtxo.txid, vout: intent.satUtxo.vout });
      }

      if (utxosToLock.length > 0) {
        logger.debug('🔒 Locking', utxosToLock.length, 'UTXOs for UNIT');
        lockedUtxos = utxosToLock;
        await markUtxosAsSpent(utxosToLock);
      }

      setSendIntent(intent);
      setIntentStep('reviewing');
    } catch (error) {
      logger.error('Error creating UNIT intent:', error);

      if (lockedUtxos.length > 0) {
        await unmarkUtxosAsSpent(lockedUtxos);
      }
      await releaseOrphanedUtxos(getSpentUtxos, unmarkUtxosAsSpent);

      showToast(parseErrorMessage(error), 'error');
      setTimeout(() => setIntentStep('entering_amount'), 100);
    }
  }, [sendRecipient, sendAmount, wallet, currentAccount, requireConfirmedUtxos, runesBalance, sendIntent, setSendIntent, setIntentStep, showToast, getUnconfirmedUTXOs, getSpentUtxos, markUtxosAsSpent, unmarkUtxosAsSpent]);

  // Main create intent function
  const createSendIntent = useCallback(async () => {
    const trimmedRecipient = sendRecipient.trim();
    setIntentStep('creating');

    if (!trimmedRecipient || !sendAmount) {
      showToast(ERRORS.MISSING_RECIPIENT_AMOUNT, 'error');
      setTimeout(() => setIntentStep('entering_amount'), 100);
      return;
    }

    setSendRecipient(trimmedRecipient);

    if (sendAssetType === 'btc') {
      await createBtcIntent();
    } else if (sendAssetType === 'unit') {
      await createUnitIntent();
    } else {
      showToast(ERRORS.ASSET_SELECTION_REQUIRED, 'error');
      setTimeout(() => setIntentStep('selecting_asset'), 100);
    }
  }, [sendRecipient, sendAmount, sendAssetType, setIntentStep, setSendRecipient, showToast, createBtcIntent, createUnitIntent]);

  // Cancel intent and release UTXOs
  const cancelIntent = useCallback(async () => {
    if (!sendIntent) return;

    logger.debug('🚫 Canceling transaction intent');

    // Only release UTXOs if not broadcast
    if (!sendIntent.txid) {
      const utxosToRelease = [];

      sendIntent.inputs?.forEach(i => utxosToRelease.push({ txid: i.txid, vout: i.vout }));

      if (sendIntent.runeUtxo) {
        utxosToRelease.push({ txid: sendIntent.runeUtxo.transaction, vout: sendIntent.runeUtxo.vout });
      }

      if (sendIntent.satUtxo) {
        utxosToRelease.push({ txid: sendIntent.satUtxo.txid, vout: sendIntent.satUtxo.vout });
      }

      if (utxosToRelease.length > 0) {
        logger.debug('✅ Releasing', utxosToRelease.length, 'UTXOs');
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
