/**
 * Transaction Calculation Service
 * Handles transaction fee estimation and max sendable amount calculations
 */

// Transaction size calculation constants
const BASE_TX_SIZE = 10;
const P2WPKH_INPUT_SIZE = 68;
const P2WPKH_OUTPUT_SIZE = 31;
const DUST_LIMIT = 546;
const DEFAULT_FEE_RATE = 1; // sats per vbyte (testnet)

/**
 * Calculate transaction fee based on inputs and outputs
 * @param {number} numInputs - Number of inputs
 * @param {number} numOutputs - Number of outputs
 * @param {number} feeRate - Fee rate in sats per vbyte (default: 1)
 * @returns {number} Estimated fee in satoshis
 */
export const calculateTransactionFee = (numInputs, numOutputs, feeRate = DEFAULT_FEE_RATE) => {
  const txSize = BASE_TX_SIZE + (numInputs * P2WPKH_INPUT_SIZE) + (numOutputs * P2WPKH_OUTPUT_SIZE);
  return Math.ceil(txSize * feeRate);
};

/**
 * Fetch UTXOs for a given address
 * @param {string} address - Bitcoin address
 * @returns {Promise<Array>} Array of confirmed UTXOs
 */
export const fetchUtxosForAddress = async (address) => {
  const response = await fetch(`https://mutinynet.com/api/address/${address}/utxo`);
  const utxos = await response.json();
  return utxos.filter(u => u.status.confirmed);
};

/**
 * Calculate maximum sendable amount for BTC
 * Takes into account all UTXOs and transaction fees
 *
 * @param {Object} params
 * @param {string} params.sourceAddress - Address to send from
 * @param {number} params.btcBalance - Current BTC balance (in BTC, not sats)
 * @param {number} params.feeRate - Fee rate in sats per vbyte (optional)
 * @returns {Promise<number>} Maximum sendable amount in BTC
 */
export const calculateMaxSendableBTC = async ({ sourceAddress, btcBalance, feeRate = DEFAULT_FEE_RATE }) => {
  try {
    if (!sourceAddress) {
      // Fallback: use balance-based estimation
      const estimatedFee = 250; // Conservative estimate in sats
      const btcBalanceInSats = Math.round(btcBalance * 100000000);
      const maxSendable = Math.max(0, btcBalanceInSats - estimatedFee);
      return maxSendable / 100000000; // Convert back to BTC
    }

    // Fetch UTXOs to calculate realistic fee based on actual inputs needed
    const confirmedUtxos = await fetchUtxosForAddress(sourceAddress);

    // Calculate total value of all UTXOs
    const totalInputValue = confirmedUtxos.reduce((sum, utxo) => sum + utxo.value, 0);
    const numInputsNeeded = confirmedUtxos.length;

    // When sending MAX, there's only 1 output (recipient), no change
    // Calculate fee for all inputs and 1 output
    const estimatedFee = calculateTransactionFee(numInputsNeeded, 1, feeRate);
    const actualMaxSendable = totalInputValue - estimatedFee;

    // Ensure we're above dust limit
    if (actualMaxSendable < DUST_LIMIT) {
      return 0;
    }

    return actualMaxSendable / 100000000; // Convert to BTC
  } catch (error) {
    // Fallback on error: use balance-based estimation
    const estimatedFee = 250; // Conservative estimate in sats
    const btcBalanceInSats = Math.round(btcBalance * 100000000);
    const maxSendable = Math.max(0, btcBalanceInSats - estimatedFee);
    return maxSendable / 100000000; // Convert back to BTC
  }
};

/**
 * Determine source address based on recipient address type
 * @param {string} recipientAddress - Recipient's Bitcoin address
 * @param {Object} wallet - Wallet object with segwitAddress and taprootAddress
 * @returns {string|null} Source address to use (taproot or segwit)
 */
export const determineSourceAddress = (recipientAddress, wallet) => {
  if (!recipientAddress || !wallet) {
    return null;
  }

  // If recipient is taproot (bc1p or tb1p), use taproot address
  if (recipientAddress.startsWith('tb1p') || recipientAddress.startsWith('bc1p')) {
    return wallet.taprootAddress;
  }

  // Otherwise use segwit
  return wallet.segwitAddress;
};
