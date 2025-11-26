/**
 * useReviewScreenData Hook
 * Manages state and data processing for ReviewScreen
 */

import { useState, useEffect, useMemo, Dispatch, SetStateAction } from 'react';
import { parsePSBT, buildFallbackOutputs, hasUnconfirmedInputs as checkUnconfirmedInputs, PSBTInput, PSBTOutput, SendIntent as PSBTSendIntent } from '../services/psbtService';
import { useTransactionBuild } from '../contexts/TransactionBuildContext';
import type { SendIntent } from '../contexts/TransactionBuildContext';
import { usePrice } from '../contexts/PriceContext';

interface UseReviewScreenDataReturn {
  sendIntent: SendIntent | null;
  btcPrice: number;
  isDetailsExpanded: boolean;
  setIsDetailsExpanded: Dispatch<SetStateAction<boolean>>;
  runeUtxoBalance: number | null;
  hasUnconfirmedInputs: boolean;
  displayAmount: string;
  usdAmount: string;
  psbtInputs: PSBTInput[];
  outputs: PSBTOutput[];
  actualFee: number;
}

export function useReviewScreenData(): UseReviewScreenDataReturn {
  const { sendIntent } = useTransactionBuild();
  const { btcPrice } = usePrice();
  const [isDetailsExpanded, setIsDetailsExpanded] = useState(false);
  const [runeUtxoBalance, setRuneUtxoBalance] = useState<number | null>(null);

  // Get UNIT balance from rune UTXO
  useEffect(() => {
    if (sendIntent?.assetType === 'UNIT' && sendIntent?.runeUtxo?.runeAmount) {
      setRuneUtxoBalance(sendIntent.runeUtxo.runeAmount);
    }
  }, [sendIntent]);

  // Check if any inputs are unconfirmed
  const hasUnconfirmedInputs = useMemo(() => {
    return checkUnconfirmedInputs(sendIntent as PSBTSendIntent | null);
  }, [sendIntent]);

  // Calculate display values
  const displayAmount = useMemo(() => {
    if (!sendIntent) return '';

    const amount = typeof sendIntent.amount === 'number'
      ? sendIntent.amount.toString()
      : (sendIntent.amount || '0');
    const amountBTC = sendIntent.amountBTC || '0';

    return sendIntent.assetType === 'UNIT'
      ? `${(parseFloat(amount) / 100).toLocaleString('en-US', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2
        })} UNIT`
      : `${amountBTC} BTC`;
  }, [sendIntent]);

  const usdAmount = useMemo(() => {
    if (!sendIntent) return '0.00';

    const amount = typeof sendIntent.amount === 'number'
      ? sendIntent.amount.toString()
      : (sendIntent.amount || '0');
    const amountBTC = sendIntent.amountBTC || '0';

    return sendIntent.assetType === 'UNIT'
      ? (parseFloat(amount) / 100).toLocaleString('en-US', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })
      : (parseFloat(amountBTC) * (btcPrice || 0)).toLocaleString('en-US', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        });
  }, [sendIntent, btcPrice]);

  // Parse PSBT to get inputs, outputs, and fee
  const { psbtInputs, psbtOutputs, actualFee } = useMemo(() => {
    if (!sendIntent?.psbt) return { psbtInputs: [], psbtOutputs: [], actualFee: 0 };
    return parsePSBT(sendIntent as unknown as PSBTSendIntent);
  }, [sendIntent]);

  // Use PSBT outputs if available, otherwise fall back to manual construction
  const outputs = useMemo(() => {
    if (psbtOutputs.length > 0) return psbtOutputs;
    if (!sendIntent?.psbt) return [];
    return buildFallbackOutputs(sendIntent as unknown as PSBTSendIntent);
  }, [psbtOutputs, sendIntent]);

  return {
    sendIntent,
    btcPrice: btcPrice || 0,
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
