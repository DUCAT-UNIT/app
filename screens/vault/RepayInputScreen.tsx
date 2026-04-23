/**
 * RepayInputScreenNew - Repay input screen using generic VaultInputScreen
 */

import { NavigationProp } from '@react-navigation/native';
import React,{ useEffect,useMemo } from 'react';
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

  // Repay now sources from Sepolia USDC and swaps back into UNIT under the hood.
  const repayBalanceUsd = useMemo((): number => {
    const parsed = Number.parseFloat(evmBalances?.usdc || '0');
    return Number.isFinite(parsed) ? parsed : 0;
  }, [evmBalances?.usdc]);

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
      additionalData={{ repayBalanceUsd, directUnitBalanceUsd }}
    />
  );
}
