/**
 * Mint Swap API - Token swapping and state checking
 */

import { postJSON } from '../../../utils/apiClient';
import { logger } from '../../../utils/logger';
import { MINT_URL } from './mintConfig';
import { CashuProof } from '../p2pk';
import { BlindedOutput, MintResponse } from './mintQuotes';
import { hashToCurve } from '../crypto';

export interface ProofState {
  Y: string;
  state: string;
  witness?: string;
}

export interface CheckStateResponse {
  states: ProofState[];
}

/**
 * Swap tokens (e.g., for splitting/combining)
 * @param inputs - Proofs to swap
 * @param outputs - Blinded messages for new amounts
 * @returns New blind signatures
 */
export const swapTokens = async (inputs: CashuProof[], outputs: BlindedOutput[]): Promise<MintResponse> => {
  try {
    logger.info('Swapping tokens', {
      inputCount: inputs.length,
      outputCount: outputs.length
    });

    const response = await postJSON<MintResponse>(`${MINT_URL}/v1/swap`, {
      inputs,
      outputs,
    }, {
      timeout: 10000,
      description: 'Swap tokens',
    });

    // Check if response contains an error
    if (response.error) {
      throw new Error(`Swap failed: ${response.error}`);
    }

    // Validate response has signatures
    if (!response.signatures || !Array.isArray(response.signatures)) {
      throw new Error('Invalid swap response: missing signatures');
    }

    // Validate signature count matches expected output count
    if (response.signatures.length !== outputs.length) {
      throw new Error(`Signature count mismatch: expected ${outputs.length} signatures but got ${response.signatures.length}`);
    }

    logger.info('Tokens swapped', { signatureCount: response.signatures.length });
    return response;
  } catch (error: unknown) {
    logger.error('Failed to swap tokens', { error: (error as Error).message });
    throw error;
  }
};

/**
 * Check if proofs have been spent (NUT-07)
 * @param proofs - Proofs to check
 * @returns States of proofs
 */
export const checkProofsSpent = async (proofs: CashuProof[]): Promise<CheckStateResponse> => {
  try {
    // Hash secrets to Y values (curve points) as required by NUT-07
    const Ys = await Promise.all(
      proofs.map(async (p) => await hashToCurve(p.secret))
    );

    const response = await postJSON<CheckStateResponse>(`${MINT_URL}/v1/checkstate`, {
      Ys,
    }, {
      timeout: 5000,
      description: 'Check proof state',
    });

    return response;
  } catch (error: unknown) {
    logger.error('Failed to check proof state', { error: (error as Error).message });
    throw error;
  }
};
