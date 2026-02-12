/**
 * Unified Signing Service
 *
 * This module consolidates all PSBT signing functionality into a single,
 * unified interface. It supports both wallet-level operations (BTC/UNIT sends)
 * and vault-specific operations.
 *
 * Usage:
 *
 * ```typescript
 * import {
 *   signPsbt,           // Wallet signing with finalization
 *   signPsbtRaw,        // Wallet signing without finalization
 *   signPsbtWithSdkObject, // Vault signing with SDK object
 *   psbtPreProcess,     // Vault pre-processing
 *   psbtPostProcess,    // Vault post-processing
 * } from '../services/signing';
 * ```
 */

// Main signing functions
export {
  signPsbt,
  signPsbtRaw,
  signPsbtWithSdkObject,
  patchPreProcessFields,
  patchPostProcessFields,
  psbtPreProcess,
  psbtPostProcess,
} from './psbtService';

// Crypto utilities (for advanced use cases)
export {
  extractWitnessData,
  getAddressTypeInfo,
  deriveKeyPair,
  getSegwitKeyPair,
  computeTapleafHash,
  getTaprootSighash,
  signSchnorr,
  signSegwitInput,
  signTaprootScriptPath,
  signTaprootKeyPath,
  getXOnlyPubkey,
  withSigningContext,
  witnessToScriptWitness,
} from './cryptoUtils';

// Types
export type {
  SignatureData,
  PsbtFieldData,
  PsbtSigningOptions,
  WitnessData,
  AddressTypeInfo,
  MobileWalletInfo,
  PsbtCache,
  PsbtWithCache,
  SigningContext,
  VaultSigningContext,
} from './types';
