/**
 * WalletStackNavigator - Stack navigator for wallet-related screens
 * Contains WalletPage and AssetDetailScreen
 */

import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import WalletPage from '../pages/WalletPage';
import AssetDetailScreen from '../screens/wallet/AssetDetailScreen';
import ReceiveQRScreen from '../screens/wallet/ReceiveQRScreen';
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
          // Enable swipe to dismiss
          gestureEnabled: true,
          gestureDirection: 'horizontal',
          // Keep screen mounted for instant re-navigation
          unmountOnBlur: false,
          // Custom animation for slide from right
          animationEnabled: true,
          cardStyleInterpolator: ({ current, layouts }) => {
            return {
              cardStyle: {
                transform: [
                  {
                    translateX: current.progress.interpolate({
                      inputRange: [0, 1],
                      outputRange: [layouts.screen.width, 0],
                    }),
                  },
                ],
              },
            };
          },
        }}
      />
      <Stack.Screen
        name="ReceiveQR"
        component={ReceiveQRScreen}
        options={{
          // Enable swipe to dismiss
          gestureEnabled: true,
          gestureDirection: 'horizontal',
          // Custom animation for slide from right
          animationEnabled: true,
          cardStyleInterpolator: ({ current, layouts }) => {
            return {
              cardStyle: {
                transform: [
                  {
                    translateX: current.progress.interpolate({
                      inputRange: [0, 1],
                      outputRange: [layouts.screen.width, 0],
                    }),
                  },
                ],
              },
            };
          },
        }}
      />
    </Stack.Navigator>
  );
}