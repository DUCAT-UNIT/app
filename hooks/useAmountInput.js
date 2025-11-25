/**
 * useAmountInput Hook
 * Manages amount input logic, balance calculations, and MAX button functionality
 */

import { useState } from 'react';
import { calculateMaxSendableBTC } from '../services/transactionCalculationService';
import { logger } from '../utils/logger';

export function useAmountInput({
  sendAssetType,
  segwitBalance,
  runesBalance,
  cashuBalance,
  wallet,
  setSendAmount
}) {
  const [isCalculatingMax, setIsCalculatingMax] = useState(false);

  // Calculate balance based on asset type
  // BTC is always sent from segwit address, so only show segwit balance
  const btcBalance = segwitBalance || 0;
  // For UNIT, combine on-chain runes balance + ecash balance
  const unitRunesBalance =
    runesBalance && runesBalance.length > 0 ? parseFloat(runesBalance[0][1]) : 0;
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
          sourceAddress,
          btcBalance: segwitBalance, // Use only segwit balance for BTC
        });
        setSendAmount(String(maxSendable));
      } catch (error) {
        logger.error('Error calculating max:', error);
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

  const calculateUsdValue = (amount, btcPrice) => {
    return amount && (sendAssetType === 'btc' ? btcPrice : 1)
      ? (parseFloat(amount) * (sendAssetType === 'btc' ? btcPrice : 1)).toLocaleString(
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
