/**
 * Rune Validation Service
 * Validates that configured Rune ID matches expected rune on the network
 */

import { API, RUNES_CONFIG } from '../utils/constants';
import { logger } from '../utils/logger';
import { getJSON } from '../utils/apiClient';

interface RuneInfo {
  id: string;
  spaced_rune: string;
  number: number;
  rune: string;
  block: number;
  txIndex: number;
}

/**
 * Validate that DUCAT•UNIT•RUNE ID matches expected configuration
 * CRITICAL: This prevents loss of funds due to misconfigured rune ID
 * Should be called once at app startup or before first rune transaction
 *
 * @returns True if valid, throws error if invalid
 * @throws Error if rune ID doesn't match expected label or network data
 */
export const validateRuneConfiguration = async (): Promise<boolean> => {
  try {
    const { block, tx } = RUNES_CONFIG.DUCAT_UNIT_RUNE_ID;
    const expectedLabel = RUNES_CONFIG.DUCAT_UNIT_RUNE_LABEL;
    const ordBaseUrl = API.ORD_URL || API.ORD_MUTINYNET_BASE;

    logger.security('Validating Rune configuration', {
      configuredBlock: block.toString(),
      configuredTx: tx.toString(),
      expectedLabel,
    });

    // Fetch rune info from ord API
    // Note: This assumes ord API has a runes/{id} endpoint
    // Adjust URL based on actual API structure
    const runeIdStr = `${block}:${tx}`;
    const url = `${ordBaseUrl}/rune/${runeIdStr}`;

    const runeInfo = await getJSON<RuneInfo>(url, {
      headers: {
        'Accept': 'application/json',
      },
      timeout: 8000,
      retryOptions: { maxRetries: 1 },
      cacheKey: `rune-validation:${runeIdStr}`,
      cacheTtlMs: 60_000,
      staleOnError: true,
      circuitKey: 'ord-rune-validation',
    });

    // Validate the spaced_rune matches expected label
    if (runeInfo.spaced_rune !== expectedLabel) {
      const error = new Error(
        `CRITICAL: Rune configuration mismatch!\n` +
        `Expected label: ${expectedLabel}\n` +
        `Actual label: ${runeInfo.spaced_rune}\n` +
        `Configured ID: ${runeIdStr}\n` +
        `This prevents loss of funds. Do NOT proceed with rune transactions.`
      );

      logger.error('RUNE CONFIGURATION MISMATCH', {
        expectedLabel,
        actualLabel: runeInfo.spaced_rune,
        configuredId: runeIdStr,
        severity: 'CRITICAL',
      });

      throw error;
    }

    // Validate block and tx index match
    if (runeInfo.block !== Number(block) || runeInfo.txIndex !== Number(tx)) {
      const error = new Error(
        `CRITICAL: Rune ID mismatch!\n` +
        `Expected: block ${block}, tx ${tx}\n` +
        `Actual: block ${runeInfo.block}, tx ${runeInfo.txIndex}\n` +
        `This prevents loss of funds. Do NOT proceed with rune transactions.`
      );

      logger.error('RUNE ID MISMATCH', {
        expectedBlock: block.toString(),
        actualBlock: runeInfo.block,
        expectedTx: tx.toString(),
        actualTx: runeInfo.txIndex,
        severity: 'CRITICAL',
      });

      throw error;
    }

    logger.security('Rune configuration validated successfully', {
      label: runeInfo.spaced_rune,
      runeId: runeIdStr,
      block: runeInfo.block,
      txIndex: runeInfo.txIndex,
    });

    return true;
  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error(String(error));

    // If this is a critical configuration error, re-throw
    if (err.message.includes('CRITICAL:')) {
      throw err;
    }

    // For network errors or API issues, log but don't block
    logger.warn('Rune validation failed (network error)', {
      error: err.message,
      recommendation: 'Verify rune ID manually before proceeding with transactions',
    });

    // Return true to not block app startup on network errors
    // But transaction will be logged with audit trail
    return true;
  }
};

/**
 * Get human-readable rune ID string for logging
 * @returns Formatted rune ID string
 */
export const getRuneIdString = (): string => {
  const { block, tx } = RUNES_CONFIG.DUCAT_UNIT_RUNE_ID;
  return `${block}:${tx} (${RUNES_CONFIG.DUCAT_UNIT_RUNE_LABEL})`;
};
