/**
 * useAmountInput Hook
 * Manages amount input logic, balance calculations, and MAX button functionality
 */

import { useState } from 'react';
import { calculateMaxSendableBTC } from '../services/transactionCalculationService';
import { logger } from '../utils/logger';
import { getRunesAmount } from '../utils/runesHelper';
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
  runesBalance,
  cashuBalance,
  wallet,
  setSendAmount
}: UseAmountInputParams): UseAmountInputReturn {
  const [isCalculatingMax, setIsCalculatingMax] = useState(false);

  // Calculate balance based on asset type
  // BTC is always sent from segwit address, so only show segwit balance
  const btcBalance = segwitBalance || 0;
  // For UNIT, combine on-chain runes balance + ecash balance
  const unitRunesBalance = getRunesAmount(runesBalance);
  const unitBalance = unitRunesBalance + (cashuBalance || 0);
  const balance = sendAssetType === 'btc' ? btcBalance : unitBalance;
  const assetLabel = sendAssetType === 'btc' ? 'BTC' : 'UNIT';

  const handleMaxPress = async () => {
    if (sendAssetType === 'btc') {
      setIsCalculatingMax(true);
      try {
        // BTC is always sent from segwit address
        const sourceAddress = wallet?.segwitAddress;

        const maxSendable = await calculateMaxSendableBTC({
          sourceAddress: sourceAddress || '',
          btcBalance: segwitBalance, // Use only segwit balance for BTC
        });
        setSendAmount(String(maxSendable));
      } catch (error: unknown) {
        logger.error('Error calculating max:', { error });
        // Fallback to segwit balance
        setSendAmount(String(segwitBalance || 0));
      } finally {
        setIsCalculatingMax(false);
      }
    } else {
      // For UNIT, just use full balance
      setSendAmount(String(balance || 0));
    }
  };

  const calculateUsdValue = (amount: string, btcPrice: number | null): string => {
    const price = btcPrice ?? 0;
    return amount && (sendAssetType === 'btc' ? price : 1)
      ? (parseFloat(amount) * (sendAssetType === 'btc' ? price : 1)).toLocaleString(
          'en-US',
          { minimumFractionDigits: 2, maximumFractionDigits: 2 }
        )
      : '0.00';
  };

  return {
    balance,
    assetLabel,
    isCalculatingMax,
    handleMaxPress,
    calculateUsdValue,
  };
}
