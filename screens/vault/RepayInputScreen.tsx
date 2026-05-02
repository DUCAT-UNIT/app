/**
 * RepayInputScreenNew - Repay input screen using generic VaultInputScreen
 */

import { NavigationProp } from '@react-navigation/native';
import React,{ useEffect,useMemo } from 'react';
import { useSettingsHandlers } from '../../contexts/NavigationHandlersContext';
import { useBalance, useEvmAssets } from '../../contexts/WalletDataContext';
import { useRepayFromUsdcSettlement } from '../../hooks/vault';
import { useRepay } from '../../stores/repayStore';
import { getRunesAmount } from '../../utils/runesHelper';
import VaultInputScreen from './VaultInputScreen';
import { repayInputConfig } from './configs';

interface RepayInputScreenNewProps {
  navigation: NavigationProp<Record<string, object | undefined>>;
}

export default function RepayInputScreenNew({ navigation }: RepayInputScreenNewProps) {
  const store = useRepay();
  const { setAvailableRepayBalanceUsd, setAvailableDirectUnitBalance } = store;
  const { loadVaultData } = useRepayFromUsdcSettlement();
  const { runesBalance } = useBalance();
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

  // Sync the currently repayable face value into the repay store.
  useEffect(() => {
    setAvailableRepayBalanceUsd(repayBalanceUsd);
  }, [repayBalanceUsd, setAvailableRepayBalanceUsd]);

  useEffect(() => {
    setAvailableDirectUnitBalance(directUnitBalanceUsd);
  }, [directUnitBalanceUsd, setAvailableDirectUnitBalance]);

  return (
    <VaultInputScreen
      navigation={navigation}
      config={repayInputConfig}
      store={store}
      loadVaultData={loadVaultData}
      additionalData={{ repayBalanceUsd, directUnitBalanceUsd, allowUsdc }}
    />
  );
}
