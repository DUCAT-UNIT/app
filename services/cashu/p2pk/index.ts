/**
 * P2PK (Pay-to-Pubkey) Utilities - NUT-11 Implementation
 * Lock ecash tokens to a recipient's public key
 */

export { generateP2PKKeyPair, createP2PKSecret } from './p2pkSecrets';
export type { P2PKKeyPair, P2PKOptions } from './p2pkSecrets';

export { signP2PKSecret, signP2PKProofs } from './p2pkSigning';

export {
  isP2PKSecret,
  getP2PKRecipient,
  verifyP2PKWitness,
  isP2PKLocked,
  hasP2PKProofs
} from './p2pkVerification';
export type { CashuProof } from './p2pkVerification';

export {
  clearP2PKCache,
  findAccountForP2PKToken,
  getP2PKPrivateKey
} from './p2pkKeyManager';
export type { AccountMatch } from './p2pkKeyManager';
