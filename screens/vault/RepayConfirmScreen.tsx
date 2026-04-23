/**
 * RepayConfirmScreenNew - Repay confirm screen using generic VaultConfirmScreen
 */

import React, { useEffect } from 'react';
import { NavigationProp } from '@react-navigation/native';
import VaultConfirmScreen from './VaultConfirmScreen';
import { repayConfirmConfig } from './configs';
import { useRepay } from '../../stores/repayStore';
import { useRepayFromUsdcSettlement } from '../../hooks/vault';

interface RepayConfirmScreenNewProps {
  navigation: NavigationProp<Record<string, object | undefined>>;
}

export default function RepayConfirmScreenNew({ navigation }: RepayConfirmScreenNewProps) {
  const store = useRepay();
  const { repayAmountUsd, setRepayQuote } = store;
  const vaultHook = useRepayFromUsdcSettlement();
  const { quoteRepayFromUsdc } = vaultHook;

  useEffect(() => {
    let cancelled = false;

    if (repayAmountUsd <= 0) {
      setRepayQuote(null, null);
      return () => {
        cancelled = true;
      };
    }

    quoteRepayFromUsdc(repayAmountUsd)
      .catch(() => {
        if (!cancelled) {
          setRepayQuote(null, null);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [quoteRepayFromUsdc, repayAmountUsd, setRepayQuote]);

  return (
    <VaultConfirmScreen
      navigation={navigation}
      config={repayConfirmConfig}
      store={store}
      vaultHook={vaultHook}
    />
  );
}
