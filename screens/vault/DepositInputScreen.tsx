/**
 * DepositInputScreenNew - Deposit input screen using generic VaultInputScreen
 */

import React from 'react';
import { NavigationProp } from '@react-navigation/native';
import VaultInputScreen from './VaultInputScreen';
import { depositInputConfig } from './configs';
import { useDeposit } from '../../stores/depositStore';
import { useDepositVaultNew as useDepositVault } from '../../hooks/vault';

interface DepositInputScreenNewProps {
  navigation: NavigationProp<Record<string, object | undefined>>;
}

export default function DepositInputScreenNew({ navigation }: DepositInputScreenNewProps) {
  const store = useDeposit();
  const { loadVaultData } = useDepositVault();

  return (
    <VaultInputScreen
      navigation={navigation}
      config={depositInputConfig}
      store={store}
      loadVaultData={loadVaultData}
    />
  );
}
