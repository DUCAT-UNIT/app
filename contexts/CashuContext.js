/**
 * CashuContext - Cashu e-cash wallet state management
 * Manages Cashu balance, pending mints, and wallet operations
 */

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { Alert } from 'react-native';
import { logger } from '../utils/logger';
import {
  getBalance,
  requestMint,
  checkMintStatus,
  completeMint,
  receiveToken,
  sendToken as sendTokenService,
  requestMelt,
  completeMelt,
  clearWallet,
} from '../services/cashu/cashuWalletService';
import { usePolling } from '../hooks/usePolling';

const CashuContext = createContext();

export const useCashu = () => {
  const context = useContext(CashuContext);
  if (!context) {
    throw new Error('useCashu must be used within a CashuProvider');
  }
  return context;
};

export const CashuProvider = ({ children }) => {
  // ============================================================
  // STATE
  // ============================================================

  const [balance, setBalance] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  // Pending mint quotes (waiting for deposits)
  const [pendingMints, setPendingMints] = useState([]);

  // ============================================================
  // BALANCE FETCHING
  // ============================================================

  const fetchBalance = useCallback(async () => {
    try {
      const newBalance = await getBalance();
      setBalance(newBalance);
      setError(null);
      return newBalance;
    } catch (err) {
      logger.error('Failed to fetch Cashu balance', { error: err.message });
      setError(err.message);
      return balance; // Return cached balance on error
    }
  }, [balance]);

  // Auto-refresh balance every 10 seconds
  usePolling({
    onPoll: fetchBalance,
    interval: 10000,
    enabled: true,
    immediate: false, // Don't call immediately, let useEffect handle initial load
  });

  // Auto-complete pending mints
  usePolling({
    onPoll: async () => {
      // Check all pending mints
      for (const mint of pendingMints) {
        try {
          const result = await checkAndCompleteMint(mint.quoteId);
          if (result.completed) {
            logger.info('Auto-completed mint', { quoteId: mint.quoteId, amount: result.amount });
          }
        } catch (error) {
          // Ignore errors, will retry next poll
          logger.debug('Error auto-completing mint', { quoteId: mint.quoteId, error: error.message });
        }
      }
    },
    interval: 5000, // Check every 5 seconds
    enabled: pendingMints.length > 0,
    immediate: false,
  });

  // Initial load
  useEffect(() => {
    fetchBalance();
  }, [fetchBalance]);

  // ============================================================
  // MINT OPERATIONS (Runes → Cashu)
  // ============================================================

  /**
   * Start mint process - get deposit address
   * @param {number} amount - Amount in sats
   * @returns {Promise<Object>} Quote with deposit address
   */
  const startMint = useCallback(async (amount) => {
    setIsLoading(true);
    setError(null);

    try {
      logger.info('Starting mint', { amount });

      const quote = await requestMint(amount);

      // Add to pending mints
      setPendingMints((prev) => [
        ...prev,
        {
          ...quote,
          createdAt: Date.now(),
        },
      ]);

      logger.info('Mint started', { quoteId: quote.quoteId });
      return quote;
    } catch (err) {
      logger.error('Failed to start mint', { error: err.message });
      setError(err.message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Check mint status and complete if paid
   * @param {string} quoteId - Quote ID
   * @returns {Promise<Object>} Status and new proofs if completed
   */
  const checkAndCompleteMint = useCallback(async (quoteId) => {
    try {
      logger.info('Checking mint status', { quoteId });

      // Check status
      const status = await checkMintStatus(quoteId);

      if (status.paid) {
        logger.info('Mint paid, completing...', { quoteId });

        // Find quote amount
        const quote = pendingMints.find((q) => q.quoteId === quoteId);
        if (!quote) {
          throw new Error('Quote not found');
        }

        // Complete mint
        const proofs = await completeMint(quoteId, quote.amount);

        // Remove from pending
        setPendingMints((prev) => prev.filter((q) => q.quoteId !== quoteId));

        // Refresh balance
        await fetchBalance();

        logger.info('Mint completed', { quoteId, proofCount: proofs.length });

        return {
          completed: true,
          proofs,
          amount: quote.amount,
        };
      }

      return {
        completed: false,
        state: status.state,
      };
    } catch (err) {
      logger.error('Failed to check/complete mint', { error: err.message, quoteId });
      throw err;
    }
  }, [pendingMints, fetchBalance]);

  /**
   * Remove a pending mint quote
   * @param {string} quoteId - Quote ID to remove
   */
  const removePendingMint = useCallback((quoteId) => {
    setPendingMints((prev) => prev.filter((q) => q.quoteId !== quoteId));
  }, []);

  // ============================================================
  // RECEIVE OPERATIONS (Cashu → Cashu)
  // ============================================================

  /**
   * Receive Cashu token from QR or paste
   * @param {string} token - Encoded Cashu token
   * @returns {Promise<Object>} Received amount
   */
  const receive = useCallback(async (token) => {
    setIsLoading(true);
    setError(null);

    try {
      logger.info('Receiving Cashu token');

      const result = await receiveToken(token);

      // Refresh balance
      await fetchBalance();

      logger.info('Token received', { amount: result.amount });
      return result;
    } catch (err) {
      logger.error('Failed to receive token', { error: err.message });
      setError(err.message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [fetchBalance]);

  // ============================================================
  // SEND OPERATIONS (Cashu → Cashu)
  // ============================================================

  /**
   * Send Cashu token (for QR code or sharing)
   * @param {number} amount - Amount to send
   * @returns {Promise<Object>} Encoded token
   */
  const send = useCallback(async (amount) => {
    setIsLoading(true);
    setError(null);

    try {
      logger.info('Sending Cashu token', { amount });

      const result = await sendTokenService(amount, true);

      // Balance is already updated by sendTokenService
      setBalance(result.balance);

      logger.info('Token sent', { amount: result.amount });
      return result;
    } catch (err) {
      logger.error('Failed to send token', { error: err.message });
      setError(err.message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // ============================================================
  // MELT OPERATIONS (Cashu → Runes)
  // ============================================================

  /**
   * Start melt process - get quote
   * @param {string} address - Taproot address
   * @param {number} amount - Amount in sats
   * @returns {Promise<Object>} Melt quote with fee
   */
  const startMelt = useCallback(async (address, amount) => {
    setIsLoading(true);
    setError(null);

    try {
      logger.info('Starting melt', { address, amount });

      const quote = await requestMelt(address, amount);

      logger.info('Melt quote created', { quoteId: quote.quoteId, total: quote.total });
      return quote;
    } catch (err) {
      logger.error('Failed to start melt', { error: err.message });
      setError(err.message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Complete melt - send proofs and get Runes
   * @param {string} quoteId - Melt quote ID
   * @param {number} totalAmount - Total amount including fee
   * @returns {Promise<Object>} Payment result with txid
   */
  const finishMelt = useCallback(async (quoteId, totalAmount) => {
    setIsLoading(true);
    setError(null);

    try {
      logger.info('Completing melt', { quoteId, totalAmount });

      const result = await completeMelt(quoteId, totalAmount);

      // Balance is already updated by completeMelt
      setBalance(result.balance);

      logger.info('Melt completed', { txid: result.txid });
      return result;
    } catch (err) {
      logger.error('Failed to complete melt', { error: err.message });
      setError(err.message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // ============================================================
  // WALLET MANAGEMENT
  // ============================================================

  /**
   * Clear all Cashu proofs (for testing/reset)
   */
  const reset = useCallback(async () => {
    try {
      await clearWallet();
      setBalance(0);
      setPendingMints([]);
      setError(null);
      logger.info('Cashu wallet reset');
    } catch (err) {
      logger.error('Failed to reset wallet', { error: err.message });
      throw err;
    }
  }, []);

  /**
   * Refresh all data
   */
  const refresh = useCallback(async () => {
    await fetchBalance();
  }, [fetchBalance]);

  /**
   * Automatic one-step mint - creates quote and returns deposit info
   * User then navigates to send UNIT to complete the process
   * @param {number} amount - Amount in sats
   * @param {Function} onSuccess - Callback with deposit address for navigation
   * @returns {Promise<Object>} Quote with deposit address
   */
  const autoMint = useCallback(async (amount, onSuccess) => {
    setIsLoading(true);
    setError(null);

    try {
      logger.info('Starting auto-mint', { amount });

      // Step 1: Create mint quote
      const quote = await requestMint(amount);

      // Add to pending mints
      setPendingMints((prev) => [
        ...prev,
        {
          ...quote,
          createdAt: Date.now(),
        },
      ]);

      logger.info('Auto-mint quote created', {
        quoteId: quote.quoteId,
        depositAddress: quote.depositAddress
      });

      // Step 2: Navigate user to send UNIT
      if (onSuccess) {
        onSuccess({
          address: quote.depositAddress,
          amount: quote.amount,
          quoteId: quote.quoteId,
        });
      }

      return quote;
    } catch (err) {
      logger.error('Failed to auto-mint', { error: err.message });
      setError(err.message);
      Alert.alert('Error', err.message || 'Failed to start mint');
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // ============================================================
  // CONTEXT VALUE
  // ============================================================

  const value = {
    // State
    balance,
    isLoading,
    error,
    pendingMints,

    // Mint operations
    startMint,
    checkAndCompleteMint,
    removePendingMint,
    autoMint, // One-step mint

    // Receive/Send
    receive,
    send,

    // Melt operations
    startMelt,
    finishMelt,

    // Wallet management
    refresh,
    reset,
  };

  return <CashuContext.Provider value={value}>{children}</CashuContext.Provider>;
};

export default CashuProvider;
