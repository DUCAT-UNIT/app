/**
 * DepositConfirmScreenNew - Deposit confirm screen using generic VaultConfirmScreen
 */

import React from 'react';
import { NavigationProp } from '@react-navigation/native';
import VaultConfirmScreen from './VaultConfirmScreen';
import { depositConfirmConfig } from './configs';
import { useDeposit } from '../../stores/depositStore';
import { useDepositVaultNew as useDepositVault } from '../../hooks/vault';

interface DepositConfirmScreenNewProps {
  navigation: NavigationProp<Record<string, object | undefined>>;
}

export default function DepositConfirmScreenNew({ navigation }: DepositConfirmScreenNewProps) {
  const store = useDeposit();
  const vaultHook = useDepositVault();

  return (
    <VaultConfirmScreen
      navigation={navigation}
      config={depositConfirmConfig}
      store={store}
      vaultHook={vaultHook}
    />
  );
}
