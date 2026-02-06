/**
 * RepayInputScreenNew - Repay input screen using generic VaultInputScreen
 */

import React, { useMemo } from 'react';
import { NavigationProp } from '@react-navigation/native';
import VaultInputScreen from '../VaultInputScreen';
import { repayInputConfig } from '../configs';
import { useRepay } from '../../../stores/repayStore';
import { useRepayVault } from '../../../hooks/useRepayVault';
import { useBalance } from '../../../contexts/WalletDataContext';
import { getRunesAmount } from '../../../utils/runesHelper';

interface RepayInputScreenNewProps {
  navigation: NavigationProp<Record<string, object | undefined>>;
}

export default function RepayInputScreenNew({ navigation }: RepayInputScreenNewProps) {
  const store = useRepay();
  const { loadVaultData } = useRepayVault();
  const { runesBalance } = useBalance();

  // Get UNIT balance from runes for repay validation
  const unitBalance = useMemo((): number => {
    return getRunesAmount(runesBalance);
  }, [runesBalance]);

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
