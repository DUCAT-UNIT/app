/**
 * Crypto Tokens - Token encoding and decoding
 */

import { Buffer } from 'buffer';
import { sumProofs, CashuProof } from './cryptoProofs';

export interface DecodedToken {
  mint: string;
  proofs: CashuProof[];
  amount: number;
}

/**
 * Encode token (for sending)
 * @param proofs - Proofs to encode
 * @param mint - Mint URL
 * @returns Encoded token (with version letter 'A')
 */
export const encodeToken = (proofs: CashuProof[], mint: string): string => {
  const token = {
    token: [
      {
        mint,
        proofs,
      },
    ],
  };

  // Cashu token format: cashu<version><base64>
  // Version 'A' is the current version as per NUT-00
  return 'cashuA' + Buffer.from(JSON.stringify(token)).toString('base64');
};

/**
 * Decode token (for receiving)
 * @param tokenString - Encoded token
 * @returns Decoded token with mint, proofs, and amount
 */
export const decodeToken = (tokenString: string): DecodedToken => {
  // Remove 'cashu' prefix and version letter (if present)
  // Version letters are UPPERCASE (A-Z), not lowercase
  // Old format: cashueyJ... (no version letter, 'e' is start of base64)
  // New format: cashuAeyJ... (version letter 'A')
  const base64 = tokenString.replace(/^cashu[A-Z]?/, '');
  const json = Buffer.from(base64, 'base64').toString('utf-8');
  const token = JSON.parse(json);

  const mint = token.token[0].mint;
  const proofs = token.token[0].proofs;
  const amount = sumProofs(proofs);

  return { mint, proofs, amount };
};
