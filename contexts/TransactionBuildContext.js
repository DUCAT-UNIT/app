/**
 * TransactionBuildContext - Handles transaction PSBT creation
 * Builds unsigned PSBTs from user inputs
 * Depends on SendFlowContext for form data
 */

import React, { createContext, useContext, useState, useMemo, useCallback } from 'react';
import { createBtcIntent as createBtcIntentService, createUnitIntent as createUnitIntentService } from '../services/transaction';
import { parseErrorMessage } from '../utils/errorParser';
import { ERRORS } from '../utils/messages';
import { useSendFlow } from './SendFlowContext';
import { usePendingTransactions } from './PendingTransactionsContext';
import { useBalance } from './WalletDataContext';
import { logger } from '../utils/logger';

const TransactionBuildContext = createContext();

export const useTransactionBuild = () => {
  const context = useContext(TransactionBuildContext);
  if (!context) {
    throw new Error('useTransactionBuild must be used within a TransactionBuildProvider');
  }
  return context;
};

export const TransactionBuildProvider = ({ children, wallet, currentAccount, showToast }) => {
  const { sendRecipient, sendAmount, sendAssetType, requireConfirmedUtxos, setIntentStep, setSendRecipient } =
    useSendFlow();
  const { getUnconfirmedUTXOs, getSpentUtxos, unmarkUtxosAsSpent, markUtxosAsSpent } = usePendingTransactions();
  const { runesBalance } = useBalance();

  // The created PSBT intent
  const [sendIntent, setSendIntent] = useState(null);

  // Create BTC transaction using TransactionService
  const createBtcIntent = useCallback(async () => {
    // Track UTXOs we lock, so we can release them if creation fails
    let lockedUtxos = [];

    try {
      // Get unconfirmed UTXOs for segwit (BTC), excluding any already used in current intent
      const unconfirmedUtxos = getUnconfirmedUTXOs('segwit', sendIntent);
      logger.debug('🔍 Available unconfirmed segwit UTXOs for BTC tx:', unconfirmedUtxos.length);
      unconfirmedUtxos.forEach(utxo => {
        logger.debug(`  - ${utxo.txid}:${utxo.vout} = ${utxo.value} sats`);
      });

      // Get spent UTXOs to filter them out
      const spentUtxos = getSpentUtxos();

      const intent = await createBtcIntentService(
        sendRecipient,
        sendAmount,
        wallet.segwitAddress,
        currentAccount,
        unconfirmedUtxos,
        spentUtxos
      );

      // CRITICAL: Lock UTXOs IMMEDIATELY to prevent race conditions
      // Mark all inputs as spent before storing intent or showing review screen
      if (intent.inputs && intent.inputs.length > 0) {
        logger.debug('🔒 Locking', intent.inputs.length, 'UTXOs for BTC transaction');
        const utxosToLock = intent.inputs.map(i => ({ txid: i.txid, vout: i.vout }));
        lockedUtxos = utxosToLock; // Track for cleanup on error
        await markUtxosAsSpent(utxosToLock);
      }

      setSendIntent(intent);
      setIntentStep('reviewing');
    } catch (error) {
      // Log the full error for debugging
      logger.error('Error creating BTC intent:', error);

      // CRITICAL: Release any UTXOs we locked before the error occurred
      if (lockedUtxos.length > 0) {
        logger.debug('🔓 Releasing', lockedUtxos.length, 'UTXOs from failed BTC transaction');
        await unmarkUtxosAsSpent(lockedUtxos);
      }

      // ADDITIONAL FIX: For ANY transaction creation error, check if there are orphaned spent UTXOs
      // This handles edge cases where UTXOs were marked spent in a previous failed attempt
      // but the transaction never actually broadcast (so they're still unspent on-chain)
      const currentSpent = getSpentUtxos();
      if (currentSpent.size > 0) {
        logger.debug(`🧹 Found ${currentSpent.size} spent UTXOs after transaction creation error`);
        logger.debug('   Clearing all spent UTXOs to prevent UTXO lockup');
        // Clear all by creating empty set
        await unmarkUtxosAsSpent(Array.from(currentSpent).map(key => {
          const [txid, vout] = key.split(':');
          return { txid, vout: parseInt(vout) };
        }));
        logger.debug('✅ All spent UTXOs cleared - wallet should be able to create new transactions now');
      }

      // Show error toast first, then transition after a brief delay
      showToast(parseErrorMessage(error), 'error');
      // Small delay to ensure toast is visible before screen transition
      setTimeout(() => {
        setIntentStep('entering_amount');
      }, 100);
    }
  }, [sendRecipient, sendAmount, wallet, currentAccount, setIntentStep, showToast, getUnconfirmedUTXOs, getSpentUtxos, sendIntent, markUtxosAsSpent, unmarkUtxosAsSpent]);

  // Create UNIT (Rune) transaction using TransactionService
  const createUnitIntent = useCallback(async () => {
    // Track UTXOs we lock, so we can release them if creation fails
    let lockedUtxos = [];

    try {
      if (!wallet || !wallet.taprootAddress || !wallet.segwitAddress) {
        throw new Error('Wallet not initialized');
      }

      // Check if user has any UNIT balance
      logger.debug('[createUnitIntent] runesBalance:', JSON.stringify(runesBalance));
      const unitAmount = runesBalance && runesBalance.length > 0 ? parseFloat(runesBalance[0][1]) : 0;
      logger.debug('[createUnitIntent] unitAmount:', unitAmount);
      if (unitAmount === 0) {
        throw new Error(ERRORS.NO_UNIT_BALANCE);
      }

      // For Spectre/Fuse (requireConfirmedUtxos), use empty arrays to force selection of confirmed UTXOs only
      // Otherwise, get unconfirmed UTXOs for taproot (UNIT) and segwit (fees)
      const unconfirmedTaprootUtxos = requireConfirmedUtxos ? [] : getUnconfirmedUTXOs('taproot', sendIntent);
      const unconfirmedSegwitUtxos = requireConfirmedUtxos ? [] : getUnconfirmedUTXOs('segwit', sendIntent);

      if (requireConfirmedUtxos) {
        logger.debug('🔒 Spectre/Fuse mode: Using ONLY confirmed UTXOs');
      } else {
        logger.debug('🔍 Available unconfirmed taproot UTXOs for UNIT tx:', unconfirmedTaprootUtxos.length);
        unconfirmedTaprootUtxos.forEach(utxo => {
          logger.debug(`  - ${utxo.txid}:${utxo.vout} = ${utxo.value} sats, runes: ${utxo.runeAmount}`);
        });
        logger.debug('🔍 Available unconfirmed segwit UTXOs for UNIT tx:', unconfirmedSegwitUtxos.length);
        unconfirmedSegwitUtxos.forEach(utxo => {
          logger.debug(`  - ${utxo.txid}:${utxo.vout} = ${utxo.value} sats`);
        });
      }

      // Get spent UTXOs to filter them out
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

      // CRITICAL: Lock UTXOs IMMEDIATELY to prevent race conditions
      // Mark all inputs as spent before storing intent or showing review screen
      const utxosToLock = [];

      // Lock all rune UTXOs (may be multiple)
      if (intent.runeUtxos && Array.isArray(intent.runeUtxos)) {
        for (const runeUtxo of intent.runeUtxos) {
          utxosToLock.push({
            txid: runeUtxo.transaction,
            vout: runeUtxo.vout,
          });
        }
      } else if (intent.runeUtxo) {
        // Backward compatibility for single UTXO
        utxosToLock.push({
          txid: intent.runeUtxo.transaction,
          vout: intent.runeUtxo.vout,
        });
      }

      // Lock the sat UTXO (for fees)
      if (intent.satUtxo) {
        utxosToLock.push({
          txid: intent.satUtxo.txid,
          vout: intent.satUtxo.vout,
        });
      }

      if (utxosToLock.length > 0) {
        logger.debug('🔒 Locking', utxosToLock.length, 'UTXOs for UNIT transaction');
        lockedUtxos = utxosToLock; // Track for cleanup on error
        await markUtxosAsSpent(utxosToLock);
      }

      console.log('[TransactionBuild] Setting UNIT intent and step to reviewing');
      setSendIntent(intent);
      setIntentStep('reviewing');
      console.log('[TransactionBuild] UNIT Intent set, step should be reviewing');
    } catch (error) {
      // Log the full error for debugging
      logger.error('Error creating UNIT intent:', error);

      // CRITICAL: Release any UTXOs we locked before the error occurred
      if (lockedUtxos.length > 0) {
        logger.debug('🔓 Releasing', lockedUtxos.length, 'UTXOs from failed UNIT transaction');
        await unmarkUtxosAsSpent(lockedUtxos);
      }

      // ADDITIONAL FIX: For ANY transaction creation error, check if there are orphaned spent UTXOs
      // This handles edge cases where UTXOs were marked spent in a previous failed attempt
      // but the transaction never actually broadcast (so they're still unspent on-chain)
      // This is especially important for Cashu mint flows where users might navigate away mid-flow
      const currentSpent = getSpentUtxos();
      if (currentSpent.size > 0) {
        logger.debug(`🧹 Found ${currentSpent.size} spent UTXOs after transaction creation error`);
        logger.debug('   Clearing all spent UTXOs to prevent UTXO lockup');
        // Clear all by creating empty set
        await unmarkUtxosAsSpent(Array.from(currentSpent).map(key => {
          const [txid, vout] = key.split(':');
          return { txid, vout: parseInt(vout) };
        }));
        logger.debug('✅ All spent UTXOs cleared - wallet should be able to create new transactions now');
      }

      // Show error toast first, then transition after a brief delay
      showToast(parseErrorMessage(error), 'error');
      // Small delay to ensure toast is visible before screen transition
      setTimeout(() => {
        setIntentStep('entering_amount');
      }, 100);
    }
  }, [sendRecipient, sendAmount, wallet, currentAccount, requireConfirmedUtxos, setIntentStep, showToast, getUnconfirmedUTXOs, getSpentUtxos, sendIntent, markUtxosAsSpent, unmarkUtxosAsSpent, runesBalance]);

  // Main create intent function (routes to BTC or UNIT)
  const createSendIntent = useCallback(async () => {
    const trimmedRecipient = sendRecipient.trim();
    setIntentStep('creating');

    // Validate inputs
    if (!trimmedRecipient || !sendAmount) {
      showToast(ERRORS.MISSING_RECIPIENT_AMOUNT, 'error');
      setTimeout(() => {
        setIntentStep('entering_amount');
      }, 100);
      return;
    }

    // Update the state with trimmed recipient
    setSendRecipient(trimmedRecipient);

    // Branch based on asset type
    // Error handling is done within each specific create function
    if (sendAssetType === 'btc') {
      await createBtcIntent();
    } else if (sendAssetType === 'unit') {
      await createUnitIntent();
    } else {
      showToast(ERRORS.ASSET_SELECTION_REQUIRED, 'error');
      setTimeout(() => {
        setIntentStep('selecting_asset');
      }, 100);
    }
  }, [sendRecipient, sendAmount, sendAssetType, setIntentStep, setSendRecipient, showToast, createBtcIntent, createUnitIntent]);

  // Cancel intent and release locked UTXOs
  const cancelIntent = useCallback(async () => {
    if (!sendIntent) {
      // No intent to cancel
      return;
    }

    logger.debug('🚫 Canceling transaction intent:', sendIntent.id);

    // CRITICAL: Only release UTXOs if transaction was NOT broadcast
    // If txid exists, the transaction was broadcast and UTXOs are spent on-chain
    const wasBroadcast = !!sendIntent.txid;

    if (wasBroadcast) {
      logger.debug('⚠️ Transaction was already broadcast - NOT releasing UTXOs (they are spent on-chain)');
    } else {
      // Collect all UTXOs that need to be released
      const utxosToRelease = [];

      // BTC transaction inputs
      if (sendIntent.inputs && Array.isArray(sendIntent.inputs)) {
        sendIntent.inputs.forEach(input => {
          utxosToRelease.push({ txid: input.txid, vout: input.vout });
        });
      }

      // UNIT transaction - rune UTXO
      if (sendIntent.runeUtxo) {
        utxosToRelease.push({
          txid: sendIntent.runeUtxo.transaction,
          vout: sendIntent.runeUtxo.vout,
        });
      }

      // UNIT transaction - sat UTXO (for fees)
      if (sendIntent.satUtxo) {
        utxosToRelease.push({
          txid: sendIntent.satUtxo.txid,
          vout: sendIntent.satUtxo.vout,
        });
      }

      // Release all locked UTXOs
      if (utxosToRelease.length > 0) {
        logger.debug('✅ Releasing', utxosToRelease.length, 'UTXOs from canceled intent');
        await unmarkUtxosAsSpent(utxosToRelease);
      }
    }

    // Clear the intent
    setSendIntent(null);
    setIntentStep('idle');
  }, [sendIntent, setSendIntent, setIntentStep, unmarkUtxosAsSpent]);

  // Memoize the value object to prevent unnecessary re-renders
  const value = useMemo(
    () => ({
      // State
      sendIntent,

      // Setters
      setSendIntent,

      // Handlers
      createSendIntent,
      cancelIntent,
    }),
    [sendIntent, createSendIntent, cancelIntent]
  );

  return (
    <TransactionBuildContext.Provider value={value}>{children}</TransactionBuildContext.Provider>
  );
};
