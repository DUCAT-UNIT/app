/**
 * RepayConfirmScreenNew - Repay confirm screen using generic VaultConfirmScreen
 */

import React, { useEffect, useMemo } from 'react';
import { NavigationProp } from '@react-navigation/native';
import VaultConfirmScreen from './VaultConfirmScreen';
import { createRepayConfirmConfig } from './configs';
import { useSettingsHandlers } from '../../contexts/NavigationHandlersContext';
import { useRepay } from '../../stores/repayStore';
import { useRepayFromUsdcSettlement } from '../../hooks/vault';

interface RepayConfirmScreenNewProps {
  navigation: NavigationProp<Record<string, object | undefined>>;
}

export default function RepayConfirmScreenNew({ navigation }: RepayConfirmScreenNewProps) {
  const store = useRepay();
  const { repayAmountUsd, setRepayQuote, setTurboRepayQuote } = store;
  const vaultHook = useRepayFromUsdcSettlement();
  const { quoteRepaySettlement } = vaultHook;
  const { settingsHandlers } = useSettingsHandlers();
  const allowUsdc = settingsHandlers.usdcFeaturesEnabled;
  const config = useMemo(() => createRepayConfirmConfig({ allowUsdc, allowTurboUnit: true }), [allowUsdc]);

  useEffect(() => {
    let cancelled = false;

    if (repayAmountUsd <= 0) {
      setRepayQuote(null, null);
      setTurboRepayQuote(null, null);
      return () => {
        cancelled = true;
      };
    }

    quoteRepaySettlement(repayAmountUsd)
      .catch(() => {
        if (!cancelled) {
          setRepayQuote(null, null);
          setTurboRepayQuote(null, null);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [quoteRepaySettlement, repayAmountUsd, setRepayQuote, setTurboRepayQuote]);

  return (
    <VaultConfirmScreen
      navigation={navigation}
      config={config}
      store={store}
      vaultHook={vaultHook}
    />
  );
}
