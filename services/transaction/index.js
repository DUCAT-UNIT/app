/**
 * Transaction Service - Barrel Export
 * Provides backwards compatibility by exporting all transaction-related functions
 */

// Export BTC transaction functions
export { createBtcIntent } from './btcTransaction';

// Export Runes transaction functions
export { createUnitIntent } from './runesTransaction';

// Export UTXO selection utilities (for advanced usage)
export {
  mergeAndFilterUtxos,
  selectUtxosForTransaction,
  createFeeCalculator,
} from './utxoSelection';

// Re-export from existing services
export { signIntent } from '../transactionSigningService';
export { broadcastTransaction } from '../transactionBroadcastService';
