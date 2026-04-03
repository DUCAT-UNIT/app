/**
 * WithdrawConfirmScreenNew - Withdraw confirm screen using generic VaultConfirmScreen
 */

import React from 'react';
import { NavigationProp } from '@react-navigation/native';
import VaultConfirmScreen from '../VaultConfirmScreen';
import { withdrawConfirmConfig } from '../configs';
import { useWithdraw } from '../../../stores/withdrawStore';
import { useWithdrawVaultNew as useWithdrawVault } from '../../../hooks/vault';

interface WithdrawConfirmScreenNewProps {
  navigation: NavigationProp<Record<string, object | undefined>>;
}

export default function WithdrawConfirmScreenNew({ navigation }: WithdrawConfirmScreenNewProps) {
  const store = useWithdraw();
  const vaultHook = useWithdrawVault();

  return (
    <VaultConfirmScreen
      navigation={navigation}
      config={withdrawConfirmConfig}
      store={store}
      vaultHook={vaultHook}
    />
  );
}
