/**
 * Transaction Service - DEPRECATED
 *
 * This file is deprecated and maintained only for backwards compatibility.
 * New code should import from 'services/transaction' instead.
 *
 * The transaction service has been split into focused modules:
 * - services/transaction/btcTransaction.js - BTC transactions
 * - services/transaction/runesTransaction.js - Runes/UNIT transactions
 * - services/transaction/utxoSelection.js - UTXO selection logic
 */

// Re-export everything from the new modular structure
export * from './transaction';
