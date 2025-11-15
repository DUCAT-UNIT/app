/**
 * WalletStackNavigator - Stack navigator for wallet-related screens
 * Contains WalletPage and AssetDetailScreen
 */

import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import WalletPage from '../pages/WalletPage';
import AssetDetailScreen from '../screens/wallet/AssetDetailScreen';
import { COLORS } from '../theme';

const Stack = createStackNavigator();

export default function WalletStackNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        cardStyle: { backgroundColor: COLORS.DARK_BG },
        animationEnabled: true,
      }}
    >
      <Stack.Screen name="WalletHome" component={WalletPage} />
      <Stack.Screen
        name="AssetDetail"
        component={AssetDetailScreen}
        options={{
          presentation: 'card',
          gestureEnabled: true,
        }}
      />
    </Stack.Navigator>
  );
}