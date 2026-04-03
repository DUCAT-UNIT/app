/**
 * MainTabs - Bottom tab navigation for authenticated app
 *
 * Single-tab bottom navigator used for future multi-tab expansion (e.g. Vault tab).
 * Tab bar is hidden for now — the app uses a custom BottomNavigationBar component instead.
 */

import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import WalletStackNavigator from './WalletStackNavigator';
import { COLORS } from '../theme';

import type { MainTabParamList } from './types';

const Tab = createBottomTabNavigator<MainTabParamList>();

export default function MainTabs(): React.JSX.Element {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: { display: 'none' }, // We'll use custom BottomNavigationBar component
        tabBarActiveTintColor: COLORS.BITCOIN_ORANGE,
        tabBarInactiveTintColor: COLORS.MEDIUM_GRAY,
        sceneStyle: { backgroundColor: COLORS.DARK_BG },
      }}
    >
      <Tab.Screen name="WalletTab" component={WalletStackNavigator} />
    </Tab.Navigator>
  );
}
