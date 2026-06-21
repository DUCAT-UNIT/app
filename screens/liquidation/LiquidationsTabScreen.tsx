/**
 * LiquidationsTabScreen
 * Static unavailable state for the release-level liquidation kill switch.
 */

import type { NativeBottomTabNavigationProp } from '@react-navigation/bottom-tabs/unstable';
import { useNavigation } from '@react-navigation/native';
import React from 'react';
import { StyleSheet, View } from 'react-native';
import LiquidationEmptyStates from '../../components/liquidation/LiquidationEmptyStates';
import type { MainTabParamList } from '../../navigation/types';
import { COLORS } from '../../theme';

type LiquidationsTabNavigationProp = NativeBottomTabNavigationProp<
  MainTabParamList,
  'LiquidationsTab'
>;

export default function LiquidationsTabScreen(): React.ReactElement {
  const navigation = useNavigation<LiquidationsTabNavigationProp>();

  const navigateHome = React.useCallback(() => {
    navigation.navigate({ name: 'WalletTab', params: undefined });
  }, [navigation]);

  return (
    <View style={styles.container} testID="liquidations-tab-screen">
      <LiquidationEmptyStates variant="unavailable" onBackToWallet={navigateHome} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.DARK_BG,
  },
});
