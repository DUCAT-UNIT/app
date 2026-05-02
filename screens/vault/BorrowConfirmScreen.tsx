/**
 * BorrowConfirmScreenNew - Borrow confirm screen using generic VaultConfirmScreen
 */

import React, { useEffect, useMemo, useState } from 'react';
import { NavigationProp } from '@react-navigation/native';
import VaultConfirmScreen from './VaultConfirmScreen';
import { createBorrowConfirmConfig } from './configs';
import { useSettingsHandlers } from '../../contexts/NavigationHandlersContext';
import { useBorrow } from '../../stores/borrowStore';
import { useBorrowToUsdcSettlement } from '../../hooks/vault';

interface BorrowConfirmScreenNewProps {
  navigation: NavigationProp<Record<string, object | undefined>>;
}

export default function BorrowConfirmScreenNew({ navigation }: BorrowConfirmScreenNewProps) {
  const store = useBorrow();
  const vaultHook = useBorrowToUsdcSettlement();
  const { settingsHandlers } = useSettingsHandlers();
  const effectiveReceiveAsset = settingsHandlers.usdcFeaturesEnabled ? store.receiveAsset : 'UNIT';
  const [estimatedUsdcOut, setEstimatedUsdcOut] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    if (store.borrowAmountUsd <= 0 || effectiveReceiveAsset !== 'USDC') {
      setEstimatedUsdcOut(null);
      return () => {
        cancelled = true;
      };
    }

    vaultHook
      .quoteBorrowToUsdc(store.borrowAmountUsd)
      .then((quote) => {
        if (!cancelled) {
          setEstimatedUsdcOut(quote.estimatedUsdcOut);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setEstimatedUsdcOut(null);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [store.borrowAmountUsd, effectiveReceiveAsset, vaultHook]);

  const config = useMemo(
    () => createBorrowConfirmConfig(estimatedUsdcOut, effectiveReceiveAsset),
    [estimatedUsdcOut, effectiveReceiveAsset],
  );

  return (
    <VaultConfirmScreen
      navigation={navigation}
      config={config}
      store={store}
      vaultHook={vaultHook}
    />
  );
}
