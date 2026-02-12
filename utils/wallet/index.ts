/**
 * Wallet utilities - message signing and key derivation
 * Re-exports from individual modules
 *
 * Note: PSBT signing has been moved to services/signing
 * Import signing functions directly from 'services/signing' instead.
 */

export { signMessage } from './messageSigning';
export { getPrivateKeyForAddress, type DerivedKeyData } from './keyDerivation';
