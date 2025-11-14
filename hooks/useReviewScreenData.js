/**
 * useReviewScreenData Hook
 * Manages state and data processing for ReviewScreen
 */

import { useState, useEffect, useMemo } from 'react';
import { parsePSBT, buildFallbackOutputs, hasUnconfirmedInputs as checkUnconfirmedInputs } from '../services/psbtService';
import { useTransactionBuild } from '../contexts/TransactionBuildContext';
import { usePrice } from '../contexts/PriceContext';

export function useReviewScreenData() {
  const { sendIntent } = useTransactionBuild();
  const { btcPrice } = usePrice();
  const [isDetailsExpanded, setIsDetailsExpanded] = useState(false);
  const [runeUtxoBalance, setRuneUtxoBalance] = useState(null);

  // Get UNIT balance from rune UTXO
  useEffect(() => {
    if (sendIntent?.assetType === 'UNIT' && sendIntent?.runeUtxo?.runeAmount) {
      setRuneUtxoBalance(sendIntent.runeUtxo.runeAmount);
    }
  }, [sendIntent]);

  // Check if any inputs are unconfirmed
  const hasUnconfirmedInputs = useMemo(() => {
    return checkUnconfirmedInputs(sendIntent);
  }, [sendIntent]);

  // Calculate display values
  const displayAmount = useMemo(() => {
    if (!sendIntent) return '';

    return sendIntent.assetType === 'UNIT'
      ? `${(parseFloat(sendIntent.amount) / 100).toLocaleString('en-US', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2
        })} UNIT`
      : `${sendIntent.amountBTC} BTC`;
  }, [sendIntent]);

  const usdAmount = useMemo(() => {
    if (!sendIntent) return '0.00';

    return sendIntent.assetType === 'UNIT'
      ? (parseFloat(sendIntent.amount) / 100).toLocaleString('en-US', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })
      : (parseFloat(sendIntent.amountBTC) * (btcPrice || 0)).toLocaleString('en-US', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        });
  }, [sendIntent, btcPrice]);

  // Parse PSBT to get inputs, outputs, and fee
  const { psbtInputs, psbtOutputs, actualFee } = useMemo(() => {
    if (!sendIntent) return { psbtInputs: [], psbtOutputs: [], actualFee: 0 };
    return parsePSBT(sendIntent);
  }, [sendIntent]);

  // Use PSBT outputs if available, otherwise fall back to manual construction
  const outputs = useMemo(() => {
    if (psbtOutputs.length > 0) return psbtOutputs;
    if (!sendIntent) return [];
    return buildFallbackOutputs(sendIntent);
  }, [psbtOutputs, sendIntent]);

  return {
    sendIntent,
    btcPrice,
    isDetailsExpanded,
    setIsDetailsExpanded,
    runeUtxoBalance,
    hasUnconfirmedInputs,
    displayAmount,
    usdAmount,
    psbtInputs,
    outputs,
    actualFee,
  };
}
