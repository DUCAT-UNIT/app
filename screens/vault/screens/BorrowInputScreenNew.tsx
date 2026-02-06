/**
 * BorrowInputScreenNew - Borrow input screen using generic VaultInputScreen
 */

import React from 'react';
import { NavigationProp } from '@react-navigation/native';
import VaultInputScreen from '../VaultInputScreen';
import { borrowInputConfig } from '../configs';
import { useBorrow } from '../../../stores/borrowStore';
import { useBorrowVault } from '../../../hooks/useBorrowVault';

interface BorrowInputScreenNewProps {
  navigation: NavigationProp<Record<string, object | undefined>>;
}

export default function BorrowInputScreenNew({ navigation }: BorrowInputScreenNewProps) {
  const store = useBorrow();
  const { loadVaultData } = useBorrowVault();

  return (
    <VaultInputScreen
      navigation={navigation}
      config={borrowInputConfig}
      store={store}
      loadVaultData={loadVaultData}
    />
  );
}
