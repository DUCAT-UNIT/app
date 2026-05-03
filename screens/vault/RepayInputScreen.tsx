/**
 * RepayInputScreenNew - Repay input screen using generic VaultInputScreen
 */

import { NavigationProp } from '@react-navigation/native';
import React,{ useEffect,useMemo } from 'react';
import { useSettingsHandlers } from '../../contexts/NavigationHandlersContext';
import { useCashuBalanceState } from '../../contexts/CashuContext';
import { useBalance, useEvmAssets } from '../../contexts/WalletDataContext';
import { useRepayFromUsdcSettlement } from '../../hooks/vault';
import { useRepay } from '../../stores/repayStore';
import { getRunesAmount } from '../../utils/runesHelper';
import { getRepayableTurboUnitContribution } from '../../utils/turboRepay';
import VaultInputScreen from './VaultInputScreen';
import { repayInputConfig } from './configs';

interface RepayInputScreenNewProps {
  navigation: NavigationProp<Record<string, object | undefined>>;
}

export default function RepayInputScreenNew({ navigation }: RepayInputScreenNewProps) {
  const store = useRepay();
  const {
    setAvailableRepayBalanceUsd,
    setAvailableTurboUnitBalance,
    setAvailableDirectUnitBalance,
    setRepayAmountUnit,
  } = store;
  const { loadVaultData } = useRepayFromUsdcSettlement();
  const { runesBalance } = useBalance();
  const { balance: cashuBalance } = useCashuBalanceState();
  const { evmBalances } = useEvmAssets();
  const { settingsHandlers } = useSettingsHandlers();
  const allowUsdc = settingsHandlers.usdcFeaturesEnabled;

  // USDC repay is developer-gated. Default users repay only with spendable UNIT.
  const repayBalanceUsd = useMemo((): number => {
    if (!allowUsdc) return 0;
    const parsed = Number.parseFloat(evmBalances?.usdc || '0');
    return Number.isFinite(parsed) ? parsed : 0;
  }, [allowUsdc, evmBalances?.usdc]);

  const directUnitBalanceUsd = useMemo((): number => {
    const parsed = getRunesAmount(runesBalance);
    return Number.isFinite(parsed) ? parsed : 0;
  }, [runesBalance]);

  const turboUnitBalanceUsd = useMemo((): number => {
    return getRepayableTurboUnitContribution(cashuBalance);
  }, [cashuBalance]);

  // Sync the currently repayable face value into the repay store.
  useEffect(() => {
    setAvailableRepayBalanceUsd(repayBalanceUsd);
  }, [repayBalanceUsd, setAvailableRepayBalanceUsd]);

  useEffect(() => {
    setAvailableDirectUnitBalance(directUnitBalanceUsd);
  }, [directUnitBalanceUsd, setAvailableDirectUnitBalance]);

  useEffect(() => {
    setAvailableTurboUnitBalance(turboUnitBalanceUsd);
  }, [setAvailableTurboUnitBalance, turboUnitBalanceUsd]);

  useEffect(() => {
    if (store.repayAmountUnit > store.maxRepayable && store.maxRepayable >= 0) {
      setRepayAmountUnit(store.maxRepayable);
    }
  }, [setRepayAmountUnit, store.maxRepayable, store.repayAmountUnit]);

  return (
    <VaultInputScreen
      navigation={navigation}
      config={repayInputConfig}
      store={store}
      loadVaultData={loadVaultData}
      additionalData={{ repayBalanceUsd, directUnitBalanceUsd, turboUnitBalanceUsd, allowUsdc, allowTurboUnit: true }}
    />
  );
}
