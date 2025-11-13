/**
 * TransactionBuildContext - Handles transaction PSBT creation
 * Builds unsigned PSBTs from user inputs
 * Depends on SendFlowContext for form data
 */

import React, { createContext, useContext, useState, useMemo, useCallback } from 'react';
import * as TransactionService from '../services/transactionService';
import { parseErrorMessage } from '../utils/errorParser';
import { ERRORS } from '../utils/messages';
import { useSendFlow } from './SendFlowContext';
import { usePendingTransactions } from './PendingTransactionsContext';

const TransactionBuildContext = createContext();

export const useTransactionBuild = () => {
  const context = useContext(TransactionBuildContext);
  if (!context) {
    throw new Error('useTransactionBuild must be used within a TransactionBuildProvider');
  }
  return context;
};

export const TransactionBuildProvider = ({ children, wallet, currentAccount, showToast }) => {
  const { sendRecipient, sendAmount, sendAssetType, setIntentStep, setSendRecipient } =
    useSendFlow();
  const { getUnconfirmedUTXOs } = usePendingTransactions();

  // The created PSBT intent
  const [sendIntent, setSendIntent] = useState(null);

  // Create BTC transaction using TransactionService
  const createBtcIntent = useCallback(async () => {
    try {
      // Get unconfirmed UTXOs for segwit (BTC), excluding any already used in current intent
      const unconfirmedUtxos = getUnconfirmedUTXOs('segwit', sendIntent);
      console.log('🔍 Available unconfirmed segwit UTXOs for BTC tx:', unconfirmedUtxos.length);
      unconfirmedUtxos.forEach(utxo => {
        console.log(`  - ${utxo.txid}:${utxo.vout} = ${utxo.value} sats`);
      });

      const intent = await TransactionService.createBtcIntent(
        sendRecipient,
        sendAmount,
        wallet.segwitAddress,
        currentAccount,
        unconfirmedUtxos
      );

      setSendIntent(intent);
      setIntentStep('reviewing');
    } catch (error) {
      // Log the full error for debugging
      console.error('Error creating BTC intent:', error);
      // Show error toast first, then transition after a brief delay
      showToast(parseErrorMessage(error), 'error');
      // Small delay to ensure toast is visible before screen transition
      setTimeout(() => {
        setIntentStep('entering_amount');
      }, 100);
    }
  }, [sendRecipient, sendAmount, wallet, currentAccount, setIntentStep, showToast, getUnconfirmedUTXOs, sendIntent]);

  // Create UNIT (Rune) transaction using TransactionService
  const createUnitIntent = useCallback(async () => {
    try {
      if (!wallet || !wallet.taprootAddress || !wallet.segwitAddress) {
        throw new Error('Wallet not initialized');
      }

      // Get unconfirmed UTXOs for taproot (UNIT) and segwit (fees), excluding any already used in current intent
      const unconfirmedTaprootUtxos = getUnconfirmedUTXOs('taproot', sendIntent);
      const unconfirmedSegwitUtxos = getUnconfirmedUTXOs('segwit', sendIntent);

      console.log('🔍 Available unconfirmed taproot UTXOs for UNIT tx:', unconfirmedTaprootUtxos.length);
      unconfirmedTaprootUtxos.forEach(utxo => {
        console.log(`  - ${utxo.txid}:${utxo.vout} = ${utxo.value} sats, runes: ${utxo.runeAmount}`);
      });
      console.log('🔍 Available unconfirmed segwit UTXOs for UNIT tx:', unconfirmedSegwitUtxos.length);
      unconfirmedSegwitUtxos.forEach(utxo => {
        console.log(`  - ${utxo.txid}:${utxo.vout} = ${utxo.value} sats`);
      });

      const intent = await TransactionService.createUnitIntent(
        sendRecipient,
        sendAmount,
        wallet.taprootAddress,
        wallet.segwitAddress,
        currentAccount,
        unconfirmedTaprootUtxos,
        unconfirmedSegwitUtxos
      );

      setSendIntent(intent);
      setIntentStep('reviewing');
    } catch (error) {
      // Log the full error for debugging
      console.error('Error creating UNIT intent:', error);
      // Show error toast first, then transition after a brief delay
      showToast(parseErrorMessage(error), 'error');
      // Small delay to ensure toast is visible before screen transition
      setTimeout(() => {
        setIntentStep('entering_amount');
      }, 100);
    }
  }, [sendRecipient, sendAmount, wallet, currentAccount, setIntentStep, showToast, getUnconfirmedUTXOs, sendIntent]);

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

  // Memoize the value object to prevent unnecessary re-renders
  const value = useMemo(
    () => ({
      // State
      sendIntent,

      // Setters
      setSendIntent,

      // Handlers
      createSendIntent,
    }),
    [sendIntent, createSendIntent]
  );

  return (
    <TransactionBuildContext.Provider value={value}>{children}</TransactionBuildContext.Provider>
  );
};
