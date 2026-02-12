/**
 * RepayProcessingScreenNew - Repay processing screen using generic VaultProcessingScreen
 */

import React from 'react';
import { NavigationProp } from '@react-navigation/native';
import VaultProcessingScreen from '../VaultProcessingScreen';
import { repayProcessingConfig } from '../configs';
import { useRepay } from '../../../stores/repayStore';

interface RepayProcessingScreenNewProps {
  navigation: NavigationProp<Record<string, object | undefined>>;
}

export default function RepayProcessingScreenNew({ navigation }: RepayProcessingScreenNewProps) {
  const store = useRepay();

  return (
    <VaultProcessingScreen
      navigation={navigation}
      config={repayProcessingConfig}
      store={store}
    />
  );
}
