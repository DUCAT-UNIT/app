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
  taprootBalance,
  runesBalance,
  wallet,
  sendAddressType,
  setSendAmount
}) {
  const [isCalculatingMax, setIsCalculatingMax] = useState(false);

  // Calculate balance based on asset type
  const btcBalance = (segwitBalance || 0) + (taprootBalance || 0);
  const unitBalance =
    runesBalance && runesBalance.length > 0 ? parseFloat(runesBalance[0][1]) : 0;
  const balance = sendAssetType === 'btc' ? btcBalance : unitBalance;
  const assetLabel = sendAssetType === 'btc' ? 'BTC' : 'UNIT';

  const handleMaxPress = async () => {
    if (sendAssetType === 'btc') {
      setIsCalculatingMax(true);
      try {
        const sourceAddress = sendAddressType === 'taproot'
          ? wallet?.taprootAddress
          : wallet?.segwitAddress;

        const maxSendable = await calculateMaxSendableBTC({
          sourceAddress,
          btcBalance,
        });
        setSendAmount(String(maxSendable));
      } catch (error) {
        logger.error('Error calculating max:', error);
        // Fallback to balance
        setSendAmount(String(balance || 0));
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
