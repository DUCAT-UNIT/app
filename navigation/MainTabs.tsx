/**
 * MainTabs - Bottom tab navigation for authenticated app
 */

import React, { useCallback } from 'react';
import { createNativeBottomTabNavigator } from '@react-navigation/bottom-tabs/unstable';
import { withErrorBoundary } from '../components/withErrorBoundary';
import { analytics } from '../services/analyticsService';
import { NAVIGATION_EVENTS } from '../constants/analyticsEvents';
import LiquidationsTabScreen from '../screens/liquidation/LiquidationsTabScreen';
import QuantaTabScreen from '../screens/quanta/QuantaTabScreen';
import WalletPageComponent from '../pages/WalletPage';
import { ENABLE_QUANTA_REWARDS } from '../utils/releaseFlags';
import {
  LIQUIDATIONS_TAB_OPTIONS,
  MAIN_TAB_BAR_OPTIONS,
  QUANTA_TAB_OPTIONS,
  WALLET_TAB_OPTIONS,
} from './mainTabOptions';
import type { MainTabParamList } from './types';

const Tab = createNativeBottomTabNavigator<MainTabParamList>();
const WalletHomeTabScreen = withErrorBoundary(WalletPageComponent, {
  boundaryName: 'WalletScreen',
  fallbackMessage: 'Unable to load wallet. Please try again.',
});

export default function MainTabs(): React.JSX.Element {
  const handleTabPress = useCallback(({ target }: { target?: string }) => {
    const routeName = target?.split('-')[0];
    if (routeName) {
      analytics.track(NAVIGATION_EVENTS.TAB_SWITCHED, { tab: routeName });
    }
  }, []);

  return (
    <Tab.Navigator
      key="main-tabs-native-empty-label"
      initialRouteName="WalletTab"
      backBehavior="initialRoute"
      screenOptions={MAIN_TAB_BAR_OPTIONS}
      screenListeners={{
        tabPress: handleTabPress,
      }}
    >
      <Tab.Screen name="WalletTab" component={WalletHomeTabScreen} options={WALLET_TAB_OPTIONS} />
      <Tab.Screen
        name="LiquidationsTab"
        component={LiquidationsTabScreen}
        options={LIQUIDATIONS_TAB_OPTIONS}
      />
      {ENABLE_QUANTA_REWARDS && (
        <Tab.Screen name="QuantaTab" component={QuantaTabScreen} options={QUANTA_TAB_OPTIONS} />
      )}
    </Tab.Navigator>
  );
}
