/**
 * RepayProcessingScreenNew - Repay processing screen using generic VaultProcessingScreen
 */

import React, { useMemo } from 'react';
import { NavigationProp } from '@react-navigation/native';
import VaultProcessingScreen from './VaultProcessingScreen';
import { createRepayProcessingConfig } from './configs';
import { useSettingsHandlers } from '../../contexts/NavigationHandlersContext';
import { useRepay } from '../../stores/repayStore';

interface RepayProcessingScreenNewProps {
  navigation: NavigationProp<Record<string, object | undefined>>;
}

export default function RepayProcessingScreenNew({ navigation }: RepayProcessingScreenNewProps) {
  const store = useRepay();
  const { settingsHandlers } = useSettingsHandlers();
  const config = useMemo(
    () => createRepayProcessingConfig(settingsHandlers.usdcFeaturesEnabled),
    [settingsHandlers.usdcFeaturesEnabled],
  );

  return (
    <VaultProcessingScreen
      navigation={navigation}
      config={config}
      store={store}
    />
  );
}
