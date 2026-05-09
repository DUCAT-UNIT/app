/**
 * Rune Validation Service
 * Validates that configured Rune ID matches expected rune on the network
 */

import { API, RUNES_CONFIG } from '../utils/constants';
import { logger } from '../utils/logger';
import { getJSON } from '../utils/apiClient';

interface RuneInfo {
  id?: string;
  spaced_rune?: string;
  number?: number;
  rune?: string;
  block?: number;
  txIndex?: number;
  tx_index?: number;
  entry?: {
    spaced_rune?: string;
    number?: number;
    rune?: string;
    block?: number;
    txIndex?: number;
    tx_index?: number;
  };
}

function getTxIndexFromRuneId(id?: string): number | undefined {
  if (!id) {
    return undefined;
  }

  const txIndex = Number(id.split(':')[1]);
  return Number.isFinite(txIndex) ? txIndex : undefined;
}

function normalizeRuneInfo(runeInfo: RuneInfo): {
  spacedRune?: string;
  block?: number;
  txIndex?: number;
} {
  return {
    spacedRune: runeInfo.spaced_rune ?? runeInfo.entry?.spaced_rune,
    block: runeInfo.block ?? runeInfo.entry?.block,
    txIndex:
      runeInfo.txIndex ??
      runeInfo.tx_index ??
      runeInfo.entry?.txIndex ??
      runeInfo.entry?.tx_index ??
      getTxIndexFromRuneId(runeInfo.id),
  };
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
        Accept: 'application/json',
      },
      timeout: 8000,
      retryOptions: { maxRetries: 1 },
      cacheKey: `rune-validation:${runeIdStr}`,
      cacheTtlMs: 60_000,
      staleOnError: true,
      circuitKey: 'ord-rune-validation',
    });

    const normalizedRuneInfo = normalizeRuneInfo(runeInfo);

    // Validate the spaced_rune matches expected label
    if (normalizedRuneInfo.spacedRune !== expectedLabel) {
      const error = new Error(
        `CRITICAL: Rune configuration mismatch!\n` +
          `Expected label: ${expectedLabel}\n` +
          `Actual label: ${normalizedRuneInfo.spacedRune}\n` +
          `Configured ID: ${runeIdStr}\n` +
          `This prevents loss of funds. Do NOT proceed with rune transactions.`
      );

      logger.error('RUNE CONFIGURATION MISMATCH', {
        expectedLabel,
        actualLabel: normalizedRuneInfo.spacedRune,
        configuredId: runeIdStr,
        severity: 'CRITICAL',
      });

      throw error;
    }

    // Validate block and tx index match
    if (normalizedRuneInfo.block !== Number(block) || normalizedRuneInfo.txIndex !== Number(tx)) {
      const error = new Error(
        `CRITICAL: Rune ID mismatch!\n` +
          `Expected: block ${block}, tx ${tx}\n` +
          `Actual: block ${normalizedRuneInfo.block}, tx ${normalizedRuneInfo.txIndex}\n` +
          `This prevents loss of funds. Do NOT proceed with rune transactions.`
      );

      logger.error('RUNE ID MISMATCH', {
        expectedBlock: block.toString(),
        actualBlock: normalizedRuneInfo.block,
        expectedTx: tx.toString(),
        actualTx: normalizedRuneInfo.txIndex,
        severity: 'CRITICAL',
      });

      throw error;
    }

    logger.security('Rune configuration validated successfully', {
      label: normalizedRuneInfo.spacedRune,
      runeId: runeIdStr,
      block: normalizedRuneInfo.block,
      txIndex: normalizedRuneInfo.txIndex,
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
