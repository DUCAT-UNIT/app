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
import RecoverMintScreen from '../screens/wallet/RecoverMintScreen';
import TurboHistoryScreen from '../screens/settings/TurboHistoryScreen';
import TurboQRCodeScreen from '../screens/settings/TurboQRCodeScreen';
import CashuSettingsScreen from '../screens/settings/CashuSettingsScreen';
import AboutScreen from '../screens/settings/AboutScreen';
import PreferencesScreen from '../screens/settings/PreferencesScreen';
import SecurityScreen from '../screens/settings/SecurityScreen';
import AdvancedScreen from '../screens/settings/AdvancedScreen';
import { COLORS } from '../theme';

const Stack = createStackNavigator();

// Shared animation config for settings screens
const settingsScreenOptions = {
  gestureEnabled: true,
  gestureDirection: 'horizontal',
  gestureResponseDistance: 50,
  gestureVelocityImpact: 0.3,
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
};

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
      <Stack.Screen
        name="RecoverMint"
        component={RecoverMintScreen}
        options={{
          gestureEnabled: true,
          gestureDirection: 'horizontal',
        }}
      />
      <Stack.Screen
        name="TurboHistory"
        component={TurboHistoryScreen}
        options={{
          gestureEnabled: true,
          gestureDirection: 'horizontal',
        }}
      />
      <Stack.Screen
        name="TurboQRCode"
        component={TurboQRCodeScreen}
        options={{
          gestureEnabled: true,
          gestureDirection: 'horizontal',
        }}
      />
      <Stack.Screen
        name="Preferences"
        component={PreferencesScreen}
        options={settingsScreenOptions}
      />
      <Stack.Screen
        name="Security"
        component={SecurityScreen}
        options={settingsScreenOptions}
      />
      <Stack.Screen
        name="Advanced"
        component={AdvancedScreen}
        options={settingsScreenOptions}
      />
      <Stack.Screen
        name="CashuSettings"
        component={CashuSettingsScreen}
        options={settingsScreenOptions}
      />
      <Stack.Screen
        name="About"
        component={AboutScreen}
        options={settingsScreenOptions}
      />
    </Stack.Navigator>
  );
}