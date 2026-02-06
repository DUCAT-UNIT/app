/**
 * DepositProcessingScreenNew - Deposit processing screen using generic VaultProcessingScreen
 */

import React from 'react';
import { NavigationProp } from '@react-navigation/native';
import VaultProcessingScreen from '../VaultProcessingScreen';
import { depositProcessingConfig } from '../configs';
import { useDeposit } from '../../../stores/depositStore';

interface DepositProcessingScreenNewProps {
  navigation: NavigationProp<Record<string, object | undefined>>;
}

export default function DepositProcessingScreenNew({ navigation }: DepositProcessingScreenNewProps) {
  const store = useDeposit();

  return (
    <VaultProcessingScreen
      navigation={navigation}
      config={depositProcessingConfig}
      store={store}
    />
  );
}
