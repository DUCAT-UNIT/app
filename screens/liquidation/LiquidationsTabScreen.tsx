/**
 * LiquidationsTabScreen
 * Main-tab wrapper around the liquidation flow.
 */

import type { NativeBottomTabNavigationProp } from '@react-navigation/bottom-tabs/unstable';
import { useIsFocused, useNavigation, type NavigationProp } from '@react-navigation/native';
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import LiquidationScreen from '../../components/liquidation/LiquidationScreen';
import { useWallet } from '../../contexts/WalletContext';
import { useBalance, useVaultData } from '../../contexts/WalletDataContext';
import { useWalletCalculations } from '../../hooks/useWalletCalculations';
import type { MainTabParamList, RootNavigatorParamList } from '../../navigation/types';
import { usePrice } from '../../stores/priceStore';
import { COLORS } from '../../theme';

type LiquidationsTabNavigationProp = NativeBottomTabNavigationProp<
  MainTabParamList,
  'LiquidationsTab'
>;

export default function LiquidationsTabScreen(): React.ReactElement {
  const isFocused = useIsFocused();
  const navigation = useNavigation<LiquidationsTabNavigationProp>();
  const insets = useSafeAreaInsets();
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
    navigation.getParent<NavigationProp<RootNavigatorParamList>>()?.navigate('LiquidationFlow');
  }, [navigation]);
  const tabBarClearance = Math.max(insets.bottom + 120, 150);

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
        bottomInset={tabBarClearance}
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
