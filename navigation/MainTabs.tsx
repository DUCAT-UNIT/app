/**
 * MainTabs - Bottom tab navigation for authenticated app
 */

import React, { useCallback } from 'react';
import {
  createNativeBottomTabNavigator,
  type NativeBottomTabNavigationOptions,
} from '@react-navigation/bottom-tabs/unstable';
import { withErrorBoundary } from '../components/withErrorBoundary';
import { analytics } from '../services/analyticsService';
import { NAVIGATION_EVENTS } from '../constants/analyticsEvents';
import LiquidationsTabScreen from '../screens/liquidation/LiquidationsTabScreen';
import QuantaTabScreen from '../screens/quanta/QuantaTabScreen';
import WalletPageComponent from '../pages/WalletPage';
import { COLORS } from '../theme';
import { ENABLE_QUANTA_REWARDS } from '../utils/releaseFlags';
import type { MainTabParamList } from './types';

const Tab = createNativeBottomTabNavigator<MainTabParamList>();
const HIDDEN_TAB_LABEL = '';
const WalletHomeTabScreen = withErrorBoundary(WalletPageComponent, {
  boundaryName: 'WalletScreen',
  fallbackMessage: 'Unable to load wallet. Please try again.',
});

const WALLET_TAB_ICON = { type: 'sfSymbol', name: 'house' } as const;
const LIQUIDATIONS_TAB_ICON = { type: 'sfSymbol', name: 'chart.line.downtrend.xyaxis' } as const;
const QUANTA_TAB_ICON = { type: 'sfSymbol', name: 'diamond' } as const;

const TAB_BAR_OPTIONS: NativeBottomTabNavigationOptions = {
  headerShown: false,
  tabBarActiveTintColor: COLORS.BLACK,
  tabBarInactiveTintColor: COLORS.TEXT_SECONDARY,
  tabBarActiveIndicatorColor: COLORS.TRANSPARENT,
  tabBarActiveIndicatorEnabled: false,
  tabBarBlurEffect: 'systemChromeMaterialDark',
  tabBarControllerMode: 'tabBar',
  tabBarLabelVisibilityMode: 'unlabeled',
  tabBarMinimizeBehavior: 'never',
  lazy: false,
  tabBarStyle: {
    backgroundColor: 'rgba(17, 16, 21, 0.82)',
    shadowColor: COLORS.BORDER_COLOR,
  },
};

export default function MainTabs(): React.JSX.Element {
  const handleTabPress = useCallback(({ target }: { target?: string }) => {
    const routeName = target?.split('-')[0];
    if (routeName) {
      analytics.track(NAVIGATION_EVENTS.TAB_SWITCHED, { tab: routeName });
    }
  }, []);

  const walletTabOptions = React.useMemo<NativeBottomTabNavigationOptions>(
    () => ({
      title: HIDDEN_TAB_LABEL,
      tabBarLabel: HIDDEN_TAB_LABEL,
      tabBarIcon: WALLET_TAB_ICON,
    }),
    []
  );

  const liquidationTabOptions = React.useMemo<NativeBottomTabNavigationOptions>(
    () => ({
      title: HIDDEN_TAB_LABEL,
      tabBarLabel: HIDDEN_TAB_LABEL,
      tabBarIcon: LIQUIDATIONS_TAB_ICON,
    }),
    []
  );

  const quantaTabOptions = React.useMemo<NativeBottomTabNavigationOptions>(
    () => ({
      title: HIDDEN_TAB_LABEL,
      tabBarLabel: HIDDEN_TAB_LABEL,
      tabBarIcon: QUANTA_TAB_ICON,
    }),
    []
  );

  return (
    <Tab.Navigator
      key="main-tabs-native-empty-label"
      initialRouteName="WalletTab"
      backBehavior="initialRoute"
      screenOptions={TAB_BAR_OPTIONS}
      screenListeners={{
        tabPress: handleTabPress,
      }}
    >
      <Tab.Screen name="WalletTab" component={WalletHomeTabScreen} options={walletTabOptions} />
      <Tab.Screen
        name="LiquidationsTab"
        component={LiquidationsTabScreen}
        options={liquidationTabOptions}
      />
      {ENABLE_QUANTA_REWARDS && (
        <Tab.Screen name="QuantaTab" component={QuantaTabScreen} options={quantaTabOptions} />
      )}
    </Tab.Navigator>
  );
}
