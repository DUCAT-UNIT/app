import * as SecureStore from 'expo-secure-store';
import { logger } from '../../utils/logger';

/**
 * Cashu Wallet Service - Main Public API
 *
 * This service provides the public API for Cashu wallet operations.
 * It re-exports functionality from specialized modules for better code organization:
 *
 * - cashuProofManager: Proof storage and account management
 * - cashuBalanceService: Balance calculations and keyset management
 * - cashuTokenOperations: Mint, melt, swap, send, receive operations
 *
 * Refactored from 1,490 lines into modular services for:
 * - Better maintainability and testability
 * - Easier code review and security audits
 * - Single responsibility principle
 */

// Import and re-export from cashuProofManager
import {
  setCurrentAccount as _setCurrentAccount,
  getStorageKey as _getStorageKey,
  loadProofs as _loadProofs,
  saveProofs as _saveProofs,
  addProofs as _addProofs,
  removeProofs as _removeProofs,
  loadProofsPartial as _loadProofsPartial,
  removeSpentProofs as _removeSpentProofs,
  subscribeToProofChanges as _subscribeToProofChanges,
} from './cashuProofManager';

export const setCurrentAccount = _setCurrentAccount;
export const getStorageKey = _getStorageKey;
export const loadProofs = _loadProofs;
export const saveProofs = _saveProofs;
export const addProofs = _addProofs;
export const removeProofs = _removeProofs;
export const loadProofsPartial = _loadProofsPartial;
export const removeSpentProofs = _removeSpentProofs;
export const subscribeToProofChanges = _subscribeToProofChanges;

// Import and re-export from cashuBalanceService
import {
  getOrFetchKeys as _getOrFetchKeys,
  getBalance as _getBalance,
} from './cashuBalanceService';

export const getOrFetchKeys = _getOrFetchKeys;
export const getBalance = _getBalance;

// Import and re-export from cashuTokenOperations
import {
  requestMint as _requestMint,
  checkMintStatus as _checkMintStatus,
  completeMint as _completeMint,
  receiveToken as _receiveToken,
  sendToken as _sendToken,
  requestMelt as _requestMelt,
  completeMelt as _completeMelt,
  completeMeltWithoutCleanup as _completeMeltWithoutCleanup,
  cleanupMeltProofs as _cleanupMeltProofs,
  sendP2PKToken as _sendP2PKToken,
  receiveP2PKToken as _receiveP2PKToken,
  recoverLockedChange as _recoverLockedChange,
} from './cashuTokenOperations';

export const requestMint = _requestMint;
export const checkMintStatus = _checkMintStatus;
export const completeMint = _completeMint;
export const receiveToken = _receiveToken;
export const sendToken = _sendToken;
export const requestMelt = _requestMelt;
export const completeMelt = _completeMelt;
export const completeMeltWithoutCleanup = _completeMeltWithoutCleanup;
export const cleanupMeltProofs = _cleanupMeltProofs;
export const sendP2PKToken = _sendP2PKToken;
export const receiveP2PKToken = _receiveP2PKToken;
export const recoverLockedChange = _recoverLockedChange;

// Constants
const KEYSETS_KEY = 'cashu_keysets';

/**
 * Clear all wallet data (proofs and keysets)
 * WARNING: This will delete all Cashu tokens - use with caution!
 */
export const clearWallet = async (): Promise<void> => {
  const STORAGE_KEY = _getStorageKey();
  await SecureStore.deleteItemAsync(STORAGE_KEY);
  await SecureStore.deleteItemAsync(KEYSETS_KEY);
  logger.info('Wallet cleared', { storageKey: STORAGE_KEY });
};

/**
 * Default export for backwards compatibility
 */
export default {
  // Account management
  setCurrentAccount: _setCurrentAccount,
  getStorageKey: _getStorageKey,

  // Proof management
  loadProofs: _loadProofs,
  saveProofs: _saveProofs,
  addProofs: _addProofs,
  removeProofs: _removeProofs,
  loadProofsPartial: _loadProofsPartial,
  removeSpentProofs: _removeSpentProofs,

  // Balance
  getOrFetchKeys: _getOrFetchKeys,
  getBalance: _getBalance,

  // Token operations
  requestMint: _requestMint,
  checkMintStatus: _checkMintStatus,
  completeMint: _completeMint,
  receiveToken: _receiveToken,
  sendToken: _sendToken,
  requestMelt: _requestMelt,
  completeMelt: _completeMelt,
  completeMeltWithoutCleanup: _completeMeltWithoutCleanup,
  cleanupMeltProofs: _cleanupMeltProofs,
  sendP2PKToken: _sendP2PKToken,
  receiveP2PKToken: _receiveP2PKToken,
  recoverLockedChange: _recoverLockedChange,

  // Wallet management
  clearWallet,
};
