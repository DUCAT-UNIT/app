/**
 * BorrowProcessingScreenNew - Borrow processing screen using generic VaultProcessingScreen
 */

import React from 'react';
import { NavigationProp } from '@react-navigation/native';
import VaultProcessingScreen from '../VaultProcessingScreen';
import { borrowProcessingConfig } from '../configs';
import { useBorrow } from '../../../stores/borrowStore';

interface BorrowProcessingScreenNewProps {
  navigation: NavigationProp<Record<string, object | undefined>>;
}

export default function BorrowProcessingScreenNew({ navigation }: BorrowProcessingScreenNewProps) {
  const store = useBorrow();

  return (
    <VaultProcessingScreen
      navigation={navigation}
      config={borrowProcessingConfig}
      store={store}
    />
  );
}
