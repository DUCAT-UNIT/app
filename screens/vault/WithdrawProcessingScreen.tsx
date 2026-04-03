/**
 * WithdrawProcessingScreenNew - Withdraw processing screen using generic VaultProcessingScreen
 */

import React from 'react';
import { NavigationProp } from '@react-navigation/native';
import VaultProcessingScreen from './VaultProcessingScreen';
import { withdrawProcessingConfig } from './configs';
import { useWithdraw } from '../../stores/withdrawStore';

interface WithdrawProcessingScreenNewProps {
  navigation: NavigationProp<Record<string, object | undefined>>;
}

export default function WithdrawProcessingScreenNew({ navigation }: WithdrawProcessingScreenNewProps) {
  const store = useWithdraw();

  return (
    <VaultProcessingScreen
      navigation={navigation}
      config={withdrawProcessingConfig}
      store={store}
    />
  );
}
