/**
 * WalletStackNavigator - Stack navigator for wallet-related screens
 * Contains WalletPage and AssetDetailScreen
 */

import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import WalletPage from '../pages/WalletPage';
import AssetDetailScreen from '../screens/wallet/AssetDetailScreen';
import ReceiveQRScreen from '../screens/wallet/ReceiveQRScreen';
import CashuReceiveScreen from '../screens/cashu/CashuReceiveScreen';
import CashuSendScreen from '../screens/cashu/CashuSendScreen';
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
          // Enable swipe to dismiss with improved gesture handling
          gestureEnabled: true,
          gestureDirection: 'horizontal',
          gestureResponseDistance: 50, // Smaller distance for easier dismiss
          gestureVelocityImpact: 0.3, // More responsive to swipe velocity
          // Keep screen mounted for instant re-navigation
          unmountOnBlur: false,
          // Custom animation for slide from right
          animationEnabled: true,
          transitionSpec: {
            open: {
              animation: 'spring',
              config: {
                stiffness: 1000,
                damping: 500,
                mass: 3,
                overshootClamping: true,
                restDisplacementThreshold: 0.01,
                restSpeedThreshold: 0.01,
              },
            },
            close: {
              animation: 'spring',
              config: {
                stiffness: 1000,
                damping: 500,
                mass: 3,
                overshootClamping: true,
                restDisplacementThreshold: 0.01,
                restSpeedThreshold: 0.01,
              },
            },
          },
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
          // Enable swipe to dismiss with improved gesture handling
          gestureEnabled: true,
          gestureDirection: 'horizontal',
          gestureResponseDistance: 50, // Smaller distance for easier dismiss
          gestureVelocityImpact: 0.3, // More responsive to swipe velocity
          // Custom animation for slide from right
          animationEnabled: true,
          transitionSpec: {
            open: {
              animation: 'spring',
              config: {
                stiffness: 1000,
                damping: 500,
                mass: 3,
                overshootClamping: true,
                restDisplacementThreshold: 0.01,
                restSpeedThreshold: 0.01,
              },
            },
            close: {
              animation: 'spring',
              config: {
                stiffness: 1000,
                damping: 500,
                mass: 3,
                overshootClamping: true,
                restDisplacementThreshold: 0.01,
                restSpeedThreshold: 0.01,
              },
            },
          },
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
        name="CashuReceive"
        component={CashuReceiveScreen}
        options={{
          gestureEnabled: true,
          gestureDirection: 'horizontal',
        }}
      />
      <Stack.Screen
        name="CashuSend"
        component={CashuSendScreen}
        options={{
          gestureEnabled: true,
          gestureDirection: 'horizontal',
        }}
      />
    </Stack.Navigator>
  );
}