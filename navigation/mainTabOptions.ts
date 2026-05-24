import type { NativeBottomTabNavigationOptions } from '@react-navigation/bottom-tabs/unstable';
import { COLORS } from '../theme';

const WALLET_TAB_LABEL = 'Wallet';
const LIQUIDATIONS_TAB_LABEL = 'Liquidations';
const QUANTA_TAB_LABEL = 'Quanta';

const WALLET_TAB_ICON = { type: 'sfSymbol', name: 'house' } as const;
const LIQUIDATIONS_TAB_ICON = { type: 'sfSymbol', name: 'chart.line.downtrend.xyaxis' } as const;
const QUANTA_TAB_ICON = { type: 'sfSymbol', name: 'diamond' } as const;

export const MAIN_TAB_BAR_OPTIONS: NativeBottomTabNavigationOptions = {
  headerShown: false,
  tabBarActiveTintColor: COLORS.PRIMARY_BLUE,
  tabBarInactiveTintColor: COLORS.TEXT_SECONDARY,
  tabBarActiveIndicatorColor: COLORS.TRANSPARENT,
  tabBarActiveIndicatorEnabled: false,
  tabBarBlurEffect: 'none',
  tabBarControllerMode: 'tabBar',
  tabBarLabelVisibilityMode: 'labeled',
  tabBarLabelStyle: {
    fontSize: 11,
    fontWeight: '600',
  },
  tabBarMinimizeBehavior: 'never',
  lazy: false,
  tabBarStyle: {
    backgroundColor: COLORS.DARK_BG,
    shadowColor: COLORS.BORDER_COLOR,
  },
};

export const WALLET_TAB_OPTIONS: NativeBottomTabNavigationOptions = {
  title: WALLET_TAB_LABEL,
  tabBarLabel: WALLET_TAB_LABEL,
  tabBarIcon: WALLET_TAB_ICON,
};

export const LIQUIDATIONS_TAB_OPTIONS: NativeBottomTabNavigationOptions = {
  title: LIQUIDATIONS_TAB_LABEL,
  tabBarLabel: LIQUIDATIONS_TAB_LABEL,
  tabBarIcon: LIQUIDATIONS_TAB_ICON,
};

export const QUANTA_TAB_OPTIONS: NativeBottomTabNavigationOptions = {
  title: QUANTA_TAB_LABEL,
  tabBarLabel: QUANTA_TAB_LABEL,
  tabBarIcon: QUANTA_TAB_ICON,
};
