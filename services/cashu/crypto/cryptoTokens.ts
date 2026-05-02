/**
 * Crypto Tokens - Token encoding and decoding
 */

import {
  decodeCashuToken,
  decodeCashuTokenMetadata,
  encodeCashuTokenV4,
  type CashuTokenMetadata,
} from '../cashuTsCompat';
import { CashuProof } from './cryptoProofs';

export interface DecodedToken {
  mint: string;
  proofs: CashuProof[];
  amount: number;
  unit?: string;
}

/**
 * Encode token (for sending)
 * @param proofs - Proofs to encode
 * @param mint - Mint URL
 * @returns Encoded token in Cashu v4 cashuB format
 */
export const encodeToken = (proofs: CashuProof[], mint: string, unit = 'unit'): string =>
  encodeCashuTokenV4(proofs, mint, unit);

/**
 * Decode token (for receiving)
 * @param tokenString - Encoded token
 * @param keysetIds - Full keyset IDs from the mint, required for cashuB tokens with short keyset IDs
 * @returns Decoded token with mint, proofs, and amount
 */
export const decodeToken = (tokenString: string, keysetIds: readonly string[] = []): DecodedToken =>
  decodeCashuToken(tokenString, keysetIds);

export const decodeTokenMetadata = (tokenString: string): CashuTokenMetadata =>
  decodeCashuTokenMetadata(tokenString);
