import React, { useCallback, useEffect, useMemo } from 'react';
import { NavigationProp } from '@react-navigation/native';
import { RepayFundingStep } from '../../components/vaultAction';
import { useSettingsHandlers } from '../../contexts/NavigationHandlersContext';
import { useRepay } from '../../stores/repayStore';
import { resolveVaultSettlementRequestedAsset, type VaultSettlementRequestedAsset } from '../../stores/vaultSettlementStore';

interface RepayFundingScreenProps {
  navigation: NavigationProp<Record<string, object | undefined>>;
}

function canFund(
  asset: VaultSettlementRequestedAsset,
  amountUsd: number,
  balances: Record<VaultSettlementRequestedAsset, number>,
): boolean {
  return balances[asset] >= amountUsd;
}

export default function RepayFundingScreen({ navigation }: RepayFundingScreenProps): React.JSX.Element {
  const {
    repayAmountUsd,
    repayFundingAsset,
    availableRepayBalanceUsd,
    availableTurboUnitBalanceUsd,
    availableDirectUnitBalanceUsd,
    setRepayFundingAsset,
    setCurrentStep,
  } = useRepay();
  const { settingsHandlers } = useSettingsHandlers();
  const allowUsdc = settingsHandlers.usdcFeaturesEnabled;
  const effectiveFundingAsset = resolveVaultSettlementRequestedAsset(repayFundingAsset, allowUsdc);

  const balances = useMemo(
    () => ({
      UNIT: availableDirectUnitBalanceUsd,
      TURBOUNIT: availableTurboUnitBalanceUsd,
      USDC: allowUsdc ? availableRepayBalanceUsd : 0,
    }),
    [allowUsdc, availableDirectUnitBalanceUsd, availableRepayBalanceUsd, availableTurboUnitBalanceUsd],
  );

  useEffect(() => {
    if (effectiveFundingAsset !== repayFundingAsset) {
      setRepayFundingAsset(effectiveFundingAsset);
    }
  }, [effectiveFundingAsset, repayFundingAsset, setRepayFundingAsset]);

  useEffect(() => {
    if (canFund(effectiveFundingAsset, repayAmountUsd, balances)) return;
    const fallback = (['UNIT', 'TURBOUNIT', ...(allowUsdc ? (['USDC'] as const) : [])] as const)
      .find((asset) => canFund(asset, repayAmountUsd, balances));

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
