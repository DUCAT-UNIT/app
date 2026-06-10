/**
 * useAmountInput Hook
 * Manages amount input logic, balance calculations, and MAX button functionality
 */

import { useState } from 'react';
import { calculateMaxSendableBTC } from '../services/transactionCalculationService';
import { hasSufficientBtcForFeesSync, TransactionType } from '../services/feeEstimationService';
import { logger } from '../utils/logger';
import { getRunesAmount } from '../utils/runesHelper';
import { formatFiat } from '../utils/formatters';
import type { WalletAddresses } from '../contexts/WalletContext';
import type { RuneBalance } from '../services/balanceService';

interface UseAmountInputParams {
  sendAssetType: 'btc' | 'unit' | null;
  segwitBalance: number;
  taprootBalance?: number;
  runesBalance: RuneBalance[] | null;
  cashuBalance: number;
  wallet: WalletAddresses | null;
  sendAddressType?: string | null;
  setSendAmount: (amount: string) => void;
  feeRate?: number; // Fee rate in sat/vB for max calculation
  unconfirmedSegwitBalance?: number; // Unconfirmed balance from pending transactions
}

interface UseAmountInputReturn {
  balance: number;
  assetLabel: string;
  isCalculatingMax: boolean;
  handleMaxPress: () => Promise<void>;
  calculateUsdValue: (amount: string, btcPrice: number | null) => string;
}

export function useAmountInput({
  sendAssetType,
  segwitBalance,
  taprootBalance,
  runesBalance,
  cashuBalance,
  wallet,
  sendAddressType = 'segwit',
  setSendAmount,
  feeRate,
  unconfirmedSegwitBalance,
}: UseAmountInputParams): UseAmountInputReturn {
  const [isCalculatingMax, setIsCalculatingMax] = useState(false);

  // Calculate balance based on asset type
  const btcSourceBalance =
    sendAddressType === 'taproot' ? taprootBalance || 0 : segwitBalance || 0;
  // Include unconfirmed SegWit balance for tx chaining. Taproot unconfirmed
  // chaining is handled in the current send flow via pending UTXO selection.
  const btcBalance =
    btcSourceBalance + (sendAddressType === 'segwit' ? unconfirmedSegwitBalance || 0 : 0);
  // For UNIT, combine on-chain runes balance + ecash balance
  // Runes come in display units, ecash is in smallest units (needs /100)
  const unitRunesBalance = getRunesAmount(runesBalance);
  const unitBalance = unitRunesBalance + ((cashuBalance || 0) / 100);
  const balance = sendAssetType === 'btc' ? btcBalance : unitBalance;
  const assetLabel = sendAssetType === 'btc' ? 'BTC' : 'UNIT';

  const handleMaxPress = async () => {
    if (sendAssetType === 'btc') {
      setIsCalculatingMax(true);
      try {
        const sourceAddress =
          sendAddressType === 'taproot' ? wallet?.taprootAddress : wallet?.segwitAddress;

        const maxSendable = await calculateMaxSendableBTC({
          sourceAddress: sourceAddress || '',
          btcBalance: btcSourceBalance,
          feeRate, // Pass fee rate for accurate max calculation
        });
        setSendAmount(String(maxSendable));
      } catch (error: unknown) {
        logger.error('Error calculating max:', { error });
        setSendAmount(String(btcSourceBalance || 0));
      } finally {
        setIsCalculatingMax(false);
      }
    } else {
      // For UNIT, check if user has BTC for fees before setting max
      const btcBalanceSats = Math.round((segwitBalance || 0) * 100_000_000);
      const feeCheck = hasSufficientBtcForFeesSync(TransactionType.UNIT_SEND, btcBalanceSats);

      if (!feeCheck.hasSufficientBtc) {
        logger.warn('Insufficient BTC for UNIT send fees', {
          required: feeCheck.requiredBtcSats,
          available: feeCheck.availableBtcSats,
        });
      }

      // Set max UNIT balance regardless (validation will catch fee issue)
      setSendAmount(String(balance || 0));
    }
  };

  const calculateUsdValue = (amount: string, btcPrice: number | null): string => {
    const price = btcPrice ?? 0;
    if (!amount || !(sendAssetType === 'btc' ? price : 1)) {
      return '0.00';
    }
    const parsedAmount = parseFloat(amount);
    // Validate numeric value: reject NaN, Infinity, and negative numbers
    if (!Number.isFinite(parsedAmount) || parsedAmount < 0) {
      return '0.00';
    }
    const numericValue = parsedAmount * (sendAssetType === 'btc' ? price : 1);
    return formatFiat(numericValue);
  };

  return {
    balance,
    assetLabel,
    isCalculatingMax,
    handleMaxPress,
    calculateUsdValue,
  };
}
