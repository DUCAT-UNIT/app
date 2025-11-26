/**
 * Transaction Service - Barrel Export
 * Provides backwards compatibility by exporting all transaction-related functions
 */

// Export BTC transaction functions
export { createBtcIntent } from './btcTransaction';
export type { BtcTransactionIntent } from './btcTransaction';

// Export Runes transaction functions
export { createUnitIntent } from './runesTransaction';
export type { UnitTransactionIntent } from './runesTransaction';

// Export UTXO selection utilities (for advanced usage)
export {
  mergeAndFilterUtxos,
  selectUtxosForTransaction,
  createFeeCalculator,
} from './utxoSelection';
export type { UTXO, UtxoSelectionResult, FeeCalculator } from './utxoSelection';

// Export Runes utilities
export { findRuneUtxo, findSatUtxo } from './runesUtxoSelection';
export type { RuneUtxo, SatUtxo } from './runesUtxoSelection';

export { buildRunesPsbt, fetchTransactionHex } from './runesPsbtBuilder';

// Re-export from existing services
export { signIntent } from '../transactionSigningService';
export type { SignedTransaction, TransactionIntent } from '../transactionSigningService';

export { broadcastTransaction } from '../transactionBroadcastService';
