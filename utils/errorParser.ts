import { ERRORS } from './messages';

interface ErrorPattern {
  pattern: RegExp;
  message: string;
}

/**
 * Extract raw error message from any error type for logging
 * Unlike parseErrorMessage, this returns the original message without transformations
 * @param error - The error object, string, or unknown value
 * @returns The raw error message string
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  if (error === null) return 'null';
  if (error === undefined) return 'undefined';
  return String(error);
}

/**
 * Parse and simplify error messages for user display
 * @param error - The error object or message
 * @returns A user-friendly error message
 */
export function parseErrorMessage(error: Error | string | unknown): string {
  if (!error) return ERRORS.UNKNOWN_ERROR;

  const errorMessage = typeof error === 'string' ? error : (error as Error).message || String(error);

  // Common error patterns and their user-friendly versions
  const errorPatterns: ErrorPattern[] = [
    {
      pattern: /insufficient funds|not enough/i,
      message: ERRORS.INSUFFICIENT_FUNDS,
    },
    {
      pattern: /network request failed|fetch failed|ECONNREFUSED/i,
      message: ERRORS.NETWORK_FAILED,
    },
    {
      pattern: /timeout|timed out/i,
      message: ERRORS.REQUEST_TIMEOUT,
    },
    {
      pattern: /invalid address/i,
      message: ERRORS.INVALID_ADDRESS,
    },
    {
      pattern: /transaction too large/i,
      message: ERRORS.TRANSACTION_TOO_LARGE,
    },
    {
      pattern: /dust|amount too small/i,
      message: ERRORS.AMOUNT_TOO_SMALL,
    },
    {
      pattern: /fee too (low|high)/i,
      message: ERRORS.FEE_OUT_OF_RANGE,
    },
    {
      pattern: /bad-txns-inputs-missingorspent/i,
      message: ERRORS.TRANSACTION_ALREADY_SPENT,
    },
    {
      pattern: /mempool conflict|txn-mempool-conflict/i,
      message: ERRORS.TRANSACTION_CONFLICT,
    },
    {
      pattern: /non-final/i,
      message: ERRORS.TRANSACTION_NOT_FINAL,
    },
    {
      pattern: /min relay fee not met/i,
      message: ERRORS.FEE_TOO_LOW,
    },
    {
      pattern: /authentication failed|unauthorized/i,
      message: ERRORS.BIOMETRIC_AUTH_FAILED,
    },
    {
      pattern: /biometric|fingerprint|face id/i,
      message: ERRORS.BIOMETRIC_AUTH_FAILED,
    },
    {
      pattern: /pin (incorrect|wrong|invalid)/i,
      message: ERRORS.INCORRECT_PIN,
    },
    {
      pattern: /broadcast.*failed/i,
      message: ERRORS.BROADCAST_FAILED,
    },
    {
      pattern: /decode.*failed|invalid hex/i,
      message: ERRORS.INVALID_TRANSACTION,
    },
    {
      pattern: /No UTXO.*with sufficient UNIT balance/i,
      message: ERRORS.NO_UNIT_BALANCE,
    },
    {
      pattern: /No confirmed UTXOs available/i,
      message: ERRORS.NO_CONFIRMED_FUNDS,
    },
  ];

  // Check each pattern
  for (const { pattern, message } of errorPatterns) {
    if (pattern.test(errorMessage)) {
      return message;
    }
  }

  // If no pattern matches, try to extract the most meaningful part
  // Remove common prefixes
  let cleanedMessage = errorMessage
    .replace(/^Error:\s*/i, '')
    .replace(/^TypeError:\s*/i, '')
    .replace(/^ReferenceError:\s*/i, '')
    .replace(/^Network error:\s*/i, '')
    .replace(/^API error:\s*/i, '');

  // Take only the first sentence if it's too long
  if (cleanedMessage.length > 80) {
    const firstSentence = cleanedMessage.split(/[.!?]/)[0];
    if (firstSentence.length > 0 && firstSentence.length < 80) {
      cleanedMessage = firstSentence;
    } else {
      // If still too long, truncate and add ellipsis
      cleanedMessage = cleanedMessage.substring(0, 77) + '...';
    }
  }

  // Capitalize first letter
  cleanedMessage = cleanedMessage.charAt(0).toUpperCase() + cleanedMessage.slice(1);

  return cleanedMessage;
}
