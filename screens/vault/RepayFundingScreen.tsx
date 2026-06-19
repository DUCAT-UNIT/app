import React, { useCallback, useEffect, useMemo } from 'react';
import { NavigationProp } from '@react-navigation/native';
import { RepayFundingStep } from '../../components/vaultAction';
import { useSettingsHandlers } from '../../contexts/NavigationHandlersContext';
import { useCashuBalanceState } from '../../contexts/CashuContext';
import { useBalance, useEvmAssets } from '../../contexts/WalletDataContext';
import { useRepay } from '../../stores/repayStore';
import {
  resolveVaultSettlementRequestedAsset,
  type VaultSettlementRequestedAsset,
} from '../../stores/vaultSettlementStore';
import { getRunesAmount } from '../../utils/runesHelper';
import { getRepayableTurboUnitContribution } from '../../utils/turboRepay';

interface RepayFundingScreenProps {
  navigation: NavigationProp<Record<string, object | undefined>>;
}

function canFund(
  asset: VaultSettlementRequestedAsset,
  amountUsd: number,
  balances: Record<VaultSettlementRequestedAsset, number>
): boolean {
  return balances[asset] >= amountUsd;
}

export default function RepayFundingScreen({
  navigation,
}: RepayFundingScreenProps): React.JSX.Element {
  const {
    repayAmountUsd,
    repayFundingAsset,
    availableRepayBalanceUsd,
    availableTurboUnitBalanceUsd,
    availableDirectUnitBalanceUsd,
    setAvailableRepayBalanceUsd,
    setAvailableTurboUnitBalance,
    setAvailableDirectUnitBalance,
    setRepayFundingAsset,
    setCurrentStep,
  } = useRepay();
  const { settingsHandlers } = useSettingsHandlers();
  const { runesBalance } = useBalance();
  const { balance: cashuBalance } = useCashuBalanceState();
  const { evmBalances } = useEvmAssets();
  const allowUsdc = settingsHandlers.usdcFeaturesEnabled;
  const effectiveFundingAsset = resolveVaultSettlementRequestedAsset(repayFundingAsset, allowUsdc);

  const liveRepayBalanceUsd = useMemo((): number => {
    if (!allowUsdc) return 0;
    const parsed = Number.parseFloat(evmBalances?.usdc || '0');
    return Number.isFinite(parsed) ? parsed : 0;
  }, [allowUsdc, evmBalances?.usdc]);

  const liveDirectUnitBalanceUsd = useMemo((): number => {
    const parsed = getRunesAmount(runesBalance);
    return Number.isFinite(parsed) ? parsed : 0;
  }, [runesBalance]);

  const liveTurboUnitBalanceUsd = useMemo((): number => {
    return getRepayableTurboUnitContribution(cashuBalance);
  }, [cashuBalance]);

  useEffect(() => {
    setAvailableRepayBalanceUsd(liveRepayBalanceUsd);
  }, [liveRepayBalanceUsd, setAvailableRepayBalanceUsd]);

  useEffect(() => {
    setAvailableDirectUnitBalance(liveDirectUnitBalanceUsd);
  }, [liveDirectUnitBalanceUsd, setAvailableDirectUnitBalance]);

  useEffect(() => {
    setAvailableTurboUnitBalance(liveTurboUnitBalanceUsd);
  }, [liveTurboUnitBalanceUsd, setAvailableTurboUnitBalance]);

  const balances = useMemo(
    () => ({
      UNIT: runesBalance == null ? availableDirectUnitBalanceUsd : liveDirectUnitBalanceUsd,
      TURBOUNIT: cashuBalance == null ? availableTurboUnitBalanceUsd : liveTurboUnitBalanceUsd,
      USDC: allowUsdc
        ? evmBalances?.usdc == null
          ? availableRepayBalanceUsd
          : liveRepayBalanceUsd
        : 0,
    }),
    [
      allowUsdc,
      availableDirectUnitBalanceUsd,
      availableRepayBalanceUsd,
      availableTurboUnitBalanceUsd,
      cashuBalance,
      evmBalances?.usdc,
      liveDirectUnitBalanceUsd,
      liveRepayBalanceUsd,
      liveTurboUnitBalanceUsd,
      runesBalance,
    ]
  );

  useEffect(() => {
    if (effectiveFundingAsset !== repayFundingAsset) {
      setRepayFundingAsset(effectiveFundingAsset);
    }
  }, [effectiveFundingAsset, repayFundingAsset, setRepayFundingAsset]);

  useEffect(() => {
    if (canFund(effectiveFundingAsset, repayAmountUsd, balances)) return;
    const fallback = (
      ['UNIT', 'TURBOUNIT', ...(allowUsdc ? (['USDC'] as const) : [])] as const
    ).find((asset) => canFund(asset, repayAmountUsd, balances));

    if (fallback && fallback !== effectiveFundingAsset) {
      setRepayFundingAsset(fallback);
    }
  }, [allowUsdc, balances, effectiveFundingAsset, repayAmountUsd, setRepayFundingAsset]);

  const handleBack = useCallback(() => {
    setCurrentStep('input');
    navigation.goBack();
  }, [navigation, setCurrentStep]);

  const handleContinue = useCallback(() => {
    setCurrentStep('confirm');
    navigation.navigate('RepayConfirm');
  }, [navigation, setCurrentStep]);

  return (
    <RepayFundingStep
      amountUsd={repayAmountUsd}
      value={effectiveFundingAsset}
      balances={balances}
      onChange={setRepayFundingAsset}
      onBack={handleBack}
      onContinue={handleContinue}
      testIDPrefix="vault-repay-funding"
      allowUsdc={allowUsdc}
      allowTurboUnit
    />
  );
}
