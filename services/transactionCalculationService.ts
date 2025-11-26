/**
 * Transaction Calculation Service
 * Handles transaction fee estimation and max sendable amount calculations
 */

import { getAddressUtxoUrl } from '../utils/constants';

// Transaction size calculation constants
const BASE_TX_SIZE = 10;
const P2WPKH_INPUT_SIZE = 68;
const P2WPKH_OUTPUT_SIZE = 31;
const DUST_LIMIT = 546;
const DEFAULT_FEE_RATE = 1; // sats per vbyte (testnet)

interface UTXO {
  value: number;
  status: {
    confirmed: boolean;
  };
}

export interface Wallet {
  segwitAddress: string;
  taprootAddress: string;
}

export interface MaxSendableParams {
  sourceAddress: string;
  btcBalance: number;
  feeRate?: number;
}

/**
 * Calculate transaction fee based on inputs and outputs
 * @param numInputs - Number of inputs
 * @param numOutputs - Number of outputs
 * @param feeRate - Fee rate in sats per vbyte (default: 1)
 * @returns Estimated fee in satoshis
 */
export const calculateTransactionFee = (
  numInputs: number,
  numOutputs: number,
  feeRate: number = DEFAULT_FEE_RATE
): number => {
  const txSize = BASE_TX_SIZE + numInputs * P2WPKH_INPUT_SIZE + numOutputs * P2WPKH_OUTPUT_SIZE;
  return Math.ceil(txSize * feeRate);
};

/**
 * Fetch UTXOs for a given address
 * @param address - Bitcoin address
 * @returns Array of confirmed UTXOs
 */
export const fetchUtxosForAddress = async (address: string): Promise<UTXO[]> => {
  const response = await fetch(getAddressUtxoUrl(address));
  const utxos = await response.json() as UTXO[];
  return utxos.filter((u) => u.status.confirmed);
};

/**
 * Calculate maximum sendable amount for BTC
 * Takes into account all UTXOs and transaction fees
 *
 * @param params - Calculation parameters
 * @param params.sourceAddress - Address to send from
 * @param params.btcBalance - Current BTC balance (in BTC, not sats)
 * @param params.feeRate - Fee rate in sats per vbyte (optional)
 * @returns Maximum sendable amount in BTC
 */
export const calculateMaxSendableBTC = async ({
  sourceAddress,
  btcBalance,
  feeRate = DEFAULT_FEE_RATE,
}: MaxSendableParams): Promise<number> => {
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
 * Determine source address for BTC transactions
 * Note: Always uses segwit for BTC sends regardless of recipient type
 * @param recipientAddress - Recipient's Bitcoin address
 * @param wallet - Wallet object with segwitAddress and taprootAddress
 * @returns Source address to use (always segwit for BTC)
 */
export const determineSourceAddress = (
  recipientAddress: string | null | undefined,
  wallet: Wallet | null | undefined
): string | null => {
  if (!recipientAddress || !wallet) {
    return null;
  }

  // Always use segwit for BTC transactions
  return wallet.segwitAddress;
};
