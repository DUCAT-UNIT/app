/**
 * Parse and simplify error messages for user display
 * @param {Error|string} error - The error object or message
 * @returns {string} A user-friendly error message
 */
export function parseErrorMessage(error) {
  if (!error) return 'An unknown error occurred';

  const errorMessage = typeof error === 'string' ? error : error.message || String(error);

  // Common error patterns and their user-friendly versions
  const errorPatterns = [
    {
      pattern: /insufficient funds|not enough/i,
      message: 'Insufficient funds for this transaction'
    },
    {
      pattern: /network request failed|fetch failed|ECONNREFUSED/i,
      message: 'Network connection failed. Please check your internet.'
    },
    {
      pattern: /timeout|timed out/i,
      message: 'Request timed out. Please try again.'
    },
    {
      pattern: /invalid address/i,
      message: 'Invalid Bitcoin address'
    },
    {
      pattern: /transaction too large/i,
      message: 'Transaction size exceeds limit'
    },
    {
      pattern: /dust|amount too small/i,
      message: 'Amount too small (below dust limit)'
    },
    {
      pattern: /fee too (low|high)/i,
      message: 'Transaction fee is outside acceptable range'
    },
    {
      pattern: /bad-txns-inputs-missingorspent/i,
      message: 'Transaction inputs already spent'
    },
    {
      pattern: /mempool conflict|txn-mempool-conflict/i,
      message: 'Transaction conflicts with another in mempool'
    },
    {
      pattern: /non-final/i,
      message: 'Transaction is not yet final'
    },
    {
      pattern: /min relay fee not met/i,
      message: 'Transaction fee too low'
    },
    {
      pattern: /authentication failed|unauthorized/i,
      message: 'Authentication failed'
    },
    {
      pattern: /biometric|fingerprint|face id/i,
      message: 'Biometric authentication failed'
    },
    {
      pattern: /pin (incorrect|wrong|invalid)/i,
      message: 'Incorrect PIN'
    },
    {
      pattern: /broadcast.*failed/i,
      message: 'Failed to broadcast transaction'
    },
    {
      pattern: /decode.*failed|invalid hex/i,
      message: 'Invalid transaction format'
    },
    {
      pattern: /No UTXO.*with sufficient UNIT balance/i,
      message: 'No available UNIT balance to send'
    },
    {
      pattern: /No confirmed UTXOs available/i,
      message: 'No confirmed funds available'
    }
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
