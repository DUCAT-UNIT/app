/**
 * LiquidationFlowScreen
 * Root-stack liquidation flow used after the tab drop-in input step.
 */

import { useNavigation } from '@react-navigation/native';
import React from 'react';
import { StyleSheet, View } from 'react-native';
import LiquidationScreen from '../../components/liquidation/LiquidationScreen';
import { useWallet } from '../../contexts/WalletContext';
import { useBalance, useVaultData } from '../../contexts/WalletDataContext';
import { useWalletCalculations } from '../../hooks/useWalletCalculations';
import type { RootNavigatorParamList } from '../../navigation/types';
import { usePrice } from '../../stores/priceStore';
import { COLORS } from '../../theme';

type RootNavigation = {
  navigate: <T extends keyof RootNavigatorParamList>(
    screen: T,
    params?: RootNavigatorParamList[T]
  ) => void;
  goBack: () => void;
};

export default function LiquidationFlowScreen(): React.ReactElement {
  const navigation = useNavigation<RootNavigation>();
  const { wallet, currentAccount } = useWallet();
  const { segwitBalance, taprootBalance, runesBalance } = useBalance();
  const { vaultData } = useVaultData();
  const { btcPrice } = usePrice();

  const { vaultDebt, vaultCollateral, hasVault } = useWalletCalculations({
    segwitBalance,
    taprootBalance,
    runesBalance,
    btcPrice,
    vaultData,
  });

  const navigateHome = React.useCallback(() => {
    navigation.navigate('Main', { screen: 'WalletTab', params: undefined });
  }, [navigation]);

  const returnToInput = React.useCallback(() => {
    navigation.goBack();
  }, [navigation]);

  return (
    <View style={styles.container} testID="liquidation-flow-screen">
      <LiquidationScreen
        btcPrice={btcPrice}
        segwitBalance={segwitBalance}
        taprootBalance={taprootBalance}
        vaultCollateral={vaultCollateral}
        vaultDebt={vaultDebt}
        hasVault={hasVault}
        wallet={wallet}
        vaultData={vaultData}
        currentAccount={currentAccount}
        visible={true}
        onClose={navigateHome}
        onToggle={navigateHome}
        onBackToInput={returnToInput}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.DARK_BG,
  },
});
