/**
 * Authentication Service - Unified export
 *
 * This file maintains backward compatibility by re-exporting from specialized services.
 * New code should import directly from:
 * - services/pinService
 * - services/biometricService
 * - services/secureStorageService
 */

// Re-export PIN service
export {
  savePin,
  checkPinLockout,
  resetPinAttempts,
  getRemainingPinAttempts,
  verifyPin,
} from './pinService';

// Re-export biometric service
export {
  checkBiometricSupport,
  authenticateWithBiometrics,
  isBiometricEnabled,
  setBiometricEnabled,
} from './biometricService';

// Re-export secure storage service
export {
  saveMnemonic,
  getMnemonic,
  withMnemonic,
  deleteMnemonic,
  saveCurrentAccount,
  getCurrentAccount,
  deleteWalletData,
} from './secureStorageService';
