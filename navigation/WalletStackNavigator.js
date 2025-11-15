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
        // Performance optimizations
        detachPreviousScreen: false, // Keep previous screen mounted for instant back navigation
        freezeOnBlur: true, // Freeze inactive screens to prevent unnecessary renders
        // Optimize transition performance
        cardStyleInterpolator: ({ current }) => ({
          cardStyle: {
            opacity: current.progress,
          },
        }),
      }}
    >
      <Stack.Screen
        name="WalletHome"
        component={WalletPage}
      />
      <Stack.Screen
        name="AssetDetail"
        component={AssetDetailScreen}
        options={{
          // Immediate navigation - no delay
          animationEnabled: false,
          // Keep screen mounted for instant re-navigation
          unmountOnBlur: false,
        }}
      />
    </Stack.Navigator>
  );
}