/**
 * MainTabs - Bottom tab navigation for authenticated app
 * Tabs: Wallet, Vault
 */

import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import WalletPage from '../pages/WalletPage';
import { COLORS } from '../theme';

const Tab = createBottomTabNavigator();

export default function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: { display: 'none' }, // We'll use custom BottomNavigationBar component
        tabBarActiveTintColor: COLORS.BRIGHT_ORANGE,
        tabBarInactiveTintColor: COLORS.MEDIUM_GRAY,
      }}
    >
      <Tab.Screen name="WalletTab" component={WalletPage} />
    </Tab.Navigator>
  );
}
