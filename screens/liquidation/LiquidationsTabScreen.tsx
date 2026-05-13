/**
 * LiquidationsTabScreen
 * Main-tab wrapper around the liquidation flow.
 */

import type { NativeBottomTabNavigationProp } from '@react-navigation/bottom-tabs/unstable';
import { useIsFocused, useNavigation } from '@react-navigation/native';
import React from 'react';
import { StyleSheet, View } from 'react-native';
import LiquidationScreen from '../../components/liquidation/LiquidationScreen';
import { useWallet } from '../../contexts/WalletContext';
import { useBalance, useVaultData } from '../../contexts/WalletDataContext';
import { useWalletCalculations } from '../../hooks/useWalletCalculations';
import type { MainTabParamList } from '../../navigation/types';
import { usePrice } from '../../stores/priceStore';
import { COLORS } from '../../theme';

type LiquidationsTabNavigationProp = NativeBottomTabNavigationProp<
  MainTabParamList,
  'LiquidationsTab'
>;

export default function LiquidationsTabScreen(): React.ReactElement {
  const isFocused = useIsFocused();
  const navigation = useNavigation<LiquidationsTabNavigationProp>();
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
    navigation.navigate({ name: 'WalletTab', params: undefined });
  }, [navigation]);

  const navigateReview = React.useCallback(() => {
    navigation.getParent()?.navigate('LiquidationFlow' as never);
  }, [navigation]);

  return (
    <View style={styles.container} testID="liquidations-tab-screen">
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
        visible={isFocused}
        onClose={navigateHome}
        onToggle={navigateHome}
        onReviewStart={navigateReview}
        bottomInset={104}
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
