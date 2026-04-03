/**
 * WithdrawInputScreenNew - Withdraw input screen using generic VaultInputScreen
 */

import React from 'react';
import { NavigationProp } from '@react-navigation/native';
import VaultInputScreen from './VaultInputScreen';
import { withdrawInputConfig } from './configs';
import { useWithdraw } from '../../stores/withdrawStore';
import { useWithdrawVault } from '../../hooks/vault';

interface WithdrawInputScreenNewProps {
  navigation: NavigationProp<Record<string, object | undefined>>;
}

export default function WithdrawInputScreenNew({ navigation }: WithdrawInputScreenNewProps) {
  const store = useWithdraw();
  const { loadVaultData } = useWithdrawVault();

  return (
    <VaultInputScreen
      navigation={navigation}
      config={withdrawInputConfig}
      store={store}
      loadVaultData={loadVaultData}
    />
  );
}
