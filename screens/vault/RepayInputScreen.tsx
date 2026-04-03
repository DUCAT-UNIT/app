/**
 * RepayInputScreenNew - Repay input screen using generic VaultInputScreen
 */

import { NavigationProp } from '@react-navigation/native';
import React,{ useEffect,useMemo } from 'react';
import { useBalance } from '../../contexts/WalletDataContext';
import { useRepayVaultNew as useRepayVault } from '../../hooks/vault';
import { useRepay } from '../../stores/repayStore';
import { getRunesAmount } from '../../utils/runesHelper';
import VaultInputScreen from './VaultInputScreen';
import { repayInputConfig } from './configs';

interface RepayInputScreenNewProps {
  navigation: NavigationProp<Record<string, object | undefined>>;
}

export default function RepayInputScreenNew({ navigation }: RepayInputScreenNewProps) {
  const store = useRepay();
  const { setAvailableUnitBalance } = store;
  const { loadVaultData } = useRepayVault();
  const { runesBalance } = useBalance();

  // Get UNIT balance from runes for repay validation
  const unitBalance = useMemo((): number => {
    const runes = getRunesAmount(runesBalance);
    // E2E bypass: Ord indexer on Mutinynet is intermittent — Runes balance may
    // read as 0 even though UTXOs exist on-chain. Fall back to vault debt amount.
    if (__DEV__ && process.env.EXPO_PUBLIC_E2E_BYPASS === 'true' && runes === 0 && store.currentUnitBorrowed > 0) {
      return store.currentUnitBorrowed;
    }
    return runes;
  }, [runesBalance, store.currentUnitBorrowed]);

  // Sync UNIT balance to repay store for maxRepayable calculation
  useEffect(() => {
    setAvailableUnitBalance(unitBalance);
  }, [unitBalance, setAvailableUnitBalance]);

  return (
    <VaultInputScreen
      navigation={navigation}
      config={repayInputConfig}
      store={store}
      loadVaultData={loadVaultData}
      additionalData={{ unitBalance }}
    />
  );
}
