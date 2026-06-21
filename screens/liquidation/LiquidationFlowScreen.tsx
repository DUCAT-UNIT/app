/**
 * LiquidationFlowScreen
 * Static unavailable state for the release-level liquidation kill switch.
 */

import { useNavigation } from '@react-navigation/native';
import React from 'react';
import { StyleSheet, View } from 'react-native';
import LiquidationEmptyStates from '../../components/liquidation/LiquidationEmptyStates';
import type { RootNavigatorParamList } from '../../navigation/types';
import { COLORS } from '../../theme';

type RootNavigation = {
  navigate: <T extends keyof RootNavigatorParamList>(
    screen: T,
    params?: RootNavigatorParamList[T]
  ) => void;
};

export default function LiquidationFlowScreen(): React.ReactElement {
  const navigation = useNavigation<RootNavigation>();

  const navigateHome = React.useCallback(() => {
    navigation.navigate('Main', { screen: 'WalletTab', params: undefined });
  }, [navigation]);

  return (
    <View style={styles.container} testID="liquidation-flow-screen">
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
