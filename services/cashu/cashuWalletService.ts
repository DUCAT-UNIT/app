import * as SecureStore from 'expo-secure-store';
import { logger } from '../../utils/logger';
import { deletePreferenceItem } from '../storagePolicy';

/**
 * Cashu Wallet Service - Main Public API
 *
 * This service provides the public API for Cashu wallet operations.
 * It re-exports functionality from specialized modules for better code organization:
 *
 * - cashuProofManager: Proof storage and account management
 * - cashuBalanceService: Balance calculations and keyset management
 * - operations/*: Mint, melt, swap, send, receive operations
 *
 * Refactored from 1,490 lines into modular services for:
 * - Better maintainability and testability
 * - Easier code review and security audits
 * - Single responsibility principle
 */

import {
  setCurrentAccount,
  getStorageKey,
  loadProofs,
  saveProofs,
  addProofs,
  removeProofs,
  loadProofsPartial,
  removeSpentProofs,
  subscribeToProofChanges,
} from './cashuProofManager';

import {
  getOrFetchKeys,
  getBalance,
} from './cashuBalanceService';

import {
  requestMint,
  checkMintStatus,
  completeMint,
} from './operations/cashuMintOperations';
import { receiveToken } from './operations/cashuReceiveToken';
import { sendToken } from './operations/cashuSendToken';
import {
  requestMelt,
  completeMelt,
  completeMeltWithoutCleanup,
  cleanupMeltProofs,
} from './operations/cashuMeltOperations';
import { sendP2PKToken } from './operations/cashuSendP2PK';
import { receiveP2PKToken } from './operations/cashuReceiveP2PK';
import { recoverLockedChange } from './operations/cashuRecoverLockedChange';

export type { MintQuoteResult, MintStatusResult } from './operations/cashuMintOperations';
export type { MeltQuoteResult, MeltResult } from './operations/cashuMeltOperations';
export type { ReceiveTokenResult } from './operations/cashuReceiveToken';
export type { SendTokenResult } from './operations/cashuSendToken';
export type { SendP2PKTokenResult } from './operations/cashuSendP2PK';
export type { ReceiveP2PKTokenResult } from './operations/cashuReceiveP2PK';
export type { CashuProof } from './crypto';
export type { AccountMatch } from './p2pk';

export { checkMintQuote, checkProofsSpent } from './cashuMintClient';
export { decodeToken, decodeTokenMetadata, encodeToken } from './crypto';
export {
  clearP2PKCache,
  findAccountForP2PKToken,
  getP2PKRecipient,
  hasP2PKProofs,
  isP2PKSecret,
} from './p2pk';

export {
  setCurrentAccount,
  getStorageKey,
  loadProofs,
  saveProofs,
  addProofs,
  removeProofs,
  loadProofsPartial,
  removeSpentProofs,
  subscribeToProofChanges,
  getOrFetchKeys,
  getBalance,
  requestMint,
  checkMintStatus,
  completeMint,
  receiveToken,
  sendToken,
  requestMelt,
  completeMelt,
  completeMeltWithoutCleanup,
  cleanupMeltProofs,
  sendP2PKToken,
  receiveP2PKToken,
  recoverLockedChange,
};

// Constants
const KEYSETS_KEY = 'cashu_keysets';

/**
 * Clear all wallet data (proofs and keysets)
 * WARNING: This will delete all Cashu tokens - use with caution!
 */
export const clearWallet = async (): Promise<void> => {
  const STORAGE_KEY = getStorageKey();
  await SecureStore.deleteItemAsync(STORAGE_KEY);
  await deletePreferenceItem(KEYSETS_KEY);
  logger.info('Wallet cleared', { storageKey: STORAGE_KEY });
};

/**
 * Convenience default export for grouped Cashu wallet operations
 */
export default {
  // Account management
  setCurrentAccount,
  getStorageKey,

  // Proof management
  loadProofs,
  saveProofs,
  addProofs,
  removeProofs,
  loadProofsPartial,
  removeSpentProofs,

  // Balance
  getOrFetchKeys,
  getBalance,

  // Token operations
  requestMint,
  checkMintStatus,
  completeMint,
  receiveToken,
  sendToken,
  requestMelt,
  completeMelt,
  completeMeltWithoutCleanup,
  cleanupMeltProofs,
  sendP2PKToken,
  receiveP2PKToken,
  recoverLockedChange,

  // Wallet management
  clearWallet,
};
