/**
 * Mint Swap API - Token swapping and state checking
 */

import { postJsonWithNativeTimeout } from '../../../utils/nativeHttp';
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

interface RestoreResponse {
  outputs?: BlindedOutput[];
  signatures?: MintResponse['signatures'];
  promises?: MintResponse['signatures'];
  error?: string;
}

/**
 * Swap tokens (e.g., for splitting/combining)
 * @param inputs - Proofs to swap
 * @param outputs - Blinded messages for new amounts
 * @returns New blind signatures
 */
export const swapTokens = async (
  inputs: CashuProof[],
  outputs: BlindedOutput[]
): Promise<MintResponse> => {
  try {
    logger.info('Swapping tokens', {
      inputCount: inputs.length,
      outputCount: outputs.length,
    });

    const response = await postJsonWithNativeTimeout<MintResponse>(
      `${MINT_URL}/v1/swap`,
      {
        inputs,
        outputs,
      },
      {
        timeout: 10000,
        headers: { Accept: 'application/json' },
      }
    );

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
      throw new Error(
        `Signature count mismatch: expected ${outputs.length} signatures but got ${response.signatures.length}`
      );
    }

    logger.info('Tokens swapped', { signatureCount: response.signatures.length });
    return response;
  } catch (error: unknown) {
    logger.error('Failed to swap tokens', { error: (error as Error).message });
    throw error;
  }
};

/**
 * Restore blind signatures for already-signed blinded outputs (NUT-09).
 * Used to recover an interrupted swap after the mint spent inputs but before
 * the app durably stored the swap response.
 */
export const restoreSignatures = async (outputs: BlindedOutput[]): Promise<MintResponse> => {
  try {
    logger.info('Restoring Cashu signatures', { outputCount: outputs.length });

    const response = await postJsonWithNativeTimeout<RestoreResponse>(
      `${MINT_URL}/v1/restore`,
      {
        outputs,
      },
      {
        timeout: 10000,
        headers: { Accept: 'application/json' },
      }
    );

    if (response.error) {
      throw new Error(`Restore failed: ${response.error}`);
    }

    const signatures = response.signatures ?? response.promises;
    if (!signatures || !Array.isArray(signatures)) {
      throw new Error('Invalid restore response: missing signatures');
    }

    if (response.outputs && Array.isArray(response.outputs)) {
      if (response.outputs.length !== signatures.length) {
        throw new Error('Invalid restore response: output/signature length mismatch');
      }

      const signaturesByOutput = new Map<string, MintResponse['signatures'][number]>();
      response.outputs.forEach((output, index) => {
        signaturesByOutput.set(output.B_, signatures[index]);
      });

      const restoredInRequestOrder = outputs
        .map((output) => signaturesByOutput.get(output.B_))
        .filter((signature): signature is MintResponse['signatures'][number] => Boolean(signature));

      if (restoredInRequestOrder.length !== outputs.length) {
        throw new Error('Restore returned partial signatures');
      }

      logger.info('Cashu signatures restored', { signatureCount: restoredInRequestOrder.length });
      return { signatures: restoredInRequestOrder };
    }

    if (signatures.length !== outputs.length) {
      throw new Error('Restore returned partial signatures');
    }

    logger.info('Cashu signatures restored', { signatureCount: signatures.length });
    return { signatures };
  } catch (error: unknown) {
    logger.warn('Failed to restore Cashu signatures', { error: (error as Error).message });
    throw error;
  }
};

/**
 * Check if proofs have been spent (NUT-07)
 * @param proofs - Proofs to check
 * @returns States of proofs
 */
export const checkProofsSpent = async (
  proofs: Array<CashuProof | { secret: string }>
): Promise<CheckStateResponse> => {
  try {
    // Hash secrets to Y values (curve points) as required by NUT-07
    const Ys = await Promise.all(proofs.map(async (p) => await hashToCurve(p.secret)));

    const response = await postJsonWithNativeTimeout<CheckStateResponse>(
      `${MINT_URL}/v1/checkstate`,
      {
        Ys,
      },
      {
        timeout: 5000,
        headers: { Accept: 'application/json' },
      }
    );

    return response;
  } catch (error: unknown) {
    logger.error('Failed to check proof state', { error: (error as Error).message });
    throw error;
  }
};
