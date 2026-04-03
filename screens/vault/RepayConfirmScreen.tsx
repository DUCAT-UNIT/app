/**
 * RepayConfirmScreenNew - Repay confirm screen using generic VaultConfirmScreen
 */

import React from 'react';
import { NavigationProp } from '@react-navigation/native';
import VaultConfirmScreen from './VaultConfirmScreen';
import { repayConfirmConfig } from './configs';
import { useRepay } from '../../stores/repayStore';
import { useRepayVault } from '../../hooks/vault';

interface RepayConfirmScreenNewProps {
  navigation: NavigationProp<Record<string, object | undefined>>;
}

export default function RepayConfirmScreenNew({ navigation }: RepayConfirmScreenNewProps) {
  const store = useRepay();
  const vaultHook = useRepayVault();

  return (
    <VaultConfirmScreen
      navigation={navigation}
      config={repayConfirmConfig}
      store={store}
      vaultHook={vaultHook}
    />
  );
}
