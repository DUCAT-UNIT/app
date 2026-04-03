/**
 * BorrowConfirmScreenNew - Borrow confirm screen using generic VaultConfirmScreen
 */

import React from 'react';
import { NavigationProp } from '@react-navigation/native';
import VaultConfirmScreen from './VaultConfirmScreen';
import { borrowConfirmConfig } from './configs';
import { useBorrow } from '../../stores/borrowStore';
import { useBorrowVaultNew as useBorrowVault } from '../../hooks/vault';

interface BorrowConfirmScreenNewProps {
  navigation: NavigationProp<Record<string, object | undefined>>;
}

export default function BorrowConfirmScreenNew({ navigation }: BorrowConfirmScreenNewProps) {
  const store = useBorrow();
  const vaultHook = useBorrowVault();

  return (
    <VaultConfirmScreen
      navigation={navigation}
      config={borrowConfirmConfig}
      store={store}
      vaultHook={vaultHook}
    />
  );
}
