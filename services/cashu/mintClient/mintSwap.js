/**
 * Mint Swap API - Token swapping and state checking
 */

import { postJSON } from '../../../utils/apiClient';
import { logger } from '../../../utils/logger';
import { MINT_URL } from './mintConfig';

/**
 * Swap tokens (e.g., for splitting/combining)
 * @param {Array} inputs - Proofs to swap
 * @param {Array} outputs - Blinded messages for new amounts
 * @returns {Promise<Object>} New blind signatures
 */
export const swapTokens = async (inputs, outputs) => {
  try {
    logger.info('Swapping tokens', {
      inputCount: inputs.length,
      outputCount: outputs.length
    });

    const response = await postJSON(`${MINT_URL}/v1/swap`, {
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

    logger.info('Tokens swapped', { signatureCount: response.signatures.length });
    return response;
  } catch (error) {
    logger.error('Failed to swap tokens', { error: error.message });
    throw error;
  }
};

/**
 * Check if proofs have been spent (NUT-07)
 * @param {Array} proofs - Proofs to check
 * @returns {Promise<Object>} { states: [{ Y, state, witness }] }
 */
export const checkProofsSpent = async (proofs) => {
  try {
    // Import hashToCurve dynamically to avoid circular dependency
    const { hashToCurve } = await import('../crypto');

    // Hash secrets to Y values (curve points) as required by NUT-07
    const Ys = await Promise.all(
      proofs.map(async (p) => await hashToCurve(p.secret))
    );

    const response = await postJSON(`${MINT_URL}/v1/checkstate`, {
      Ys,
    }, {
      timeout: 5000,
      description: 'Check proof state',
    });

    return response;
  } catch (error) {
    logger.error('Failed to check proof state', { error: error.message });
    throw error;
  }
};
