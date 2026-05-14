import type { NativeBottomTabNavigationOptions } from '@react-navigation/bottom-tabs/unstable';
import { COLORS } from '../theme';

const HIDDEN_TAB_LABEL = '';

const WALLET_TAB_ICON = { type: 'sfSymbol', name: 'house' } as const;
const LIQUIDATIONS_TAB_ICON = { type: 'sfSymbol', name: 'chart.line.downtrend.xyaxis' } as const;
const QUANTA_TAB_ICON = { type: 'sfSymbol', name: 'diamond' } as const;

export const MAIN_TAB_BAR_OPTIONS: NativeBottomTabNavigationOptions = {
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

export const WALLET_TAB_OPTIONS: NativeBottomTabNavigationOptions = {
  title: HIDDEN_TAB_LABEL,
  tabBarLabel: HIDDEN_TAB_LABEL,
  tabBarIcon: WALLET_TAB_ICON,
};

export const LIQUIDATIONS_TAB_OPTIONS: NativeBottomTabNavigationOptions = {
  title: HIDDEN_TAB_LABEL,
  tabBarLabel: HIDDEN_TAB_LABEL,
  tabBarIcon: LIQUIDATIONS_TAB_ICON,
};

export const QUANTA_TAB_OPTIONS: NativeBottomTabNavigationOptions = {
  title: HIDDEN_TAB_LABEL,
  tabBarLabel: HIDDEN_TAB_LABEL,
  tabBarIcon: QUANTA_TAB_ICON,
};
