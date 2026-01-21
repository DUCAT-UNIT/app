/**
 * WalletStackNavigator - Stack navigator for wallet-related screens
 * Contains WalletPage and AssetDetailScreen
 */

import React from 'react';
import { createStackNavigator, StackNavigationOptions, StackCardStyleInterpolator } from '@react-navigation/stack';
import { withErrorBoundary } from '../components/withErrorBoundary';
import WalletPageComponent from '../pages/WalletPage';
import AssetDetailScreenComponent from '../screens/wallet/AssetDetailScreen';
import VaultDetailScreenComponent from '../screens/wallet/VaultDetailScreen';
import ReceiveQRScreenComponent from '../screens/wallet/ReceiveQRScreen';
import CashuReceiveScreenComponent from '../screens/cashu/CashuReceiveScreen';
import RecoverMintScreenComponent from '../screens/wallet/RecoverMintScreen';
import CashuSettingsScreenComponent from '../screens/settings/CashuSettingsScreen';
import AboutScreenComponent from '../screens/settings/AboutScreen';
import PreferencesScreenComponent from '../screens/settings/PreferencesScreen';
import SecurityScreenComponent from '../screens/settings/SecurityScreen';
import AdvancedScreenComponent from '../screens/settings/AdvancedScreen';
import FeeRateDemoComponent from '../screens/dev/FeeRateDemo';
import { COLORS } from '../theme';

import type { WalletStackParamList } from './types';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyComponent = React.ComponentType<any>;

// Wrap all screens with error boundaries
// Using AnyComponent cast to avoid strict type checking with navigator
const WalletPage: AnyComponent = withErrorBoundary(WalletPageComponent, {
  boundaryName: 'WalletScreen',
  fallbackMessage: 'Unable to load wallet. Please try again.',
});

const AssetDetailScreen: AnyComponent = withErrorBoundary(AssetDetailScreenComponent, {
  boundaryName: 'AssetDetailScreen',
  fallbackMessage: 'Unable to load asset details. Please try again.',
});

const VaultDetailScreen: AnyComponent = withErrorBoundary(VaultDetailScreenComponent, {
  boundaryName: 'VaultDetailScreen',
  fallbackMessage: 'Unable to load vault details. Please try again.',
});

const ReceiveQRScreen: AnyComponent = withErrorBoundary(ReceiveQRScreenComponent, {
  boundaryName: 'ReceiveQRScreen',
  fallbackMessage: 'Unable to show receive QR code. Please try again.',
});

const CashuReceiveScreen: AnyComponent = withErrorBoundary(CashuReceiveScreenComponent, {
  boundaryName: 'CashuReceiveScreen',
  fallbackMessage: 'Unable to receive ecash. Please try again.',
});

const RecoverMintScreen: AnyComponent = withErrorBoundary(RecoverMintScreenComponent, {
  boundaryName: 'RecoverMintScreen',
  fallbackMessage: 'Unable to recover from mint. Please try again.',
});

const CashuSettingsScreen: AnyComponent = withErrorBoundary(CashuSettingsScreenComponent, {
  boundaryName: 'CashuSettingsScreen',
  fallbackMessage: 'Unable to load Cashu settings. Please try again.',
});

const AboutScreen: AnyComponent = withErrorBoundary(AboutScreenComponent, {
  boundaryName: 'AboutScreen',
  fallbackMessage: 'Unable to load about screen. Please try again.',
});

const PreferencesScreen: AnyComponent = withErrorBoundary(PreferencesScreenComponent, {
  boundaryName: 'PreferencesScreen',
  fallbackMessage: 'Unable to load preferences. Please try again.',
});

const SecurityScreen: AnyComponent = withErrorBoundary(SecurityScreenComponent, {
  boundaryName: 'SecurityScreen',
  fallbackMessage: 'Unable to load security settings. Please try again.',
});

const AdvancedScreen: AnyComponent = withErrorBoundary(AdvancedScreenComponent, {
  boundaryName: 'AdvancedScreen',
  fallbackMessage: 'Unable to load advanced settings. Please try again.',
});

const FeeRateDemo: AnyComponent = withErrorBoundary(FeeRateDemoComponent, {
  boundaryName: 'FeeRateDemo',
  fallbackMessage: 'Unable to load fee rate demo. Please try again.',
});

const Stack = createStackNavigator<WalletStackParamList>();

// Custom card style interpolator for slide from right animation
const slideFromRight: StackCardStyleInterpolator = ({ current, layouts }) => {
  return {
    cardStyle: {
      backgroundColor: COLORS.DARK_BG,
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
};

// Shared animation config for settings screens
const settingsScreenOptions: StackNavigationOptions = {
  gestureEnabled: true,
  gestureDirection: 'horizontal',
  gestureResponseDistance: 50,
  gestureVelocityImpact: 0.3,
  detachPreviousScreen: false, // Keep previous screen mounted to prevent white flash
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
  cardStyleInterpolator: slideFromRight,
};

// Shared animation config for detail screens (slide from right)
const detailScreenOptions: StackNavigationOptions = {
  gestureEnabled: true,
  gestureDirection: 'horizontal',
  gestureResponseDistance: 50,
  gestureVelocityImpact: 0.3,
  detachPreviousScreen: false, // Keep previous screen mounted to prevent white flash
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
  cardStyleInterpolator: slideFromRight,
};

export default function WalletStackNavigator(): React.JSX.Element {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        cardStyle: { backgroundColor: COLORS.DARK_BG },
        cardOverlayEnabled: false,
        animation: 'fade',
        // Optimize transition performance
        cardStyleInterpolator: ({ current }) => ({
          cardStyle: {
            backgroundColor: COLORS.DARK_BG,
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
        options={detailScreenOptions}
      />
      <Stack.Screen
        name="VaultDetail"
        component={VaultDetailScreen}
        options={detailScreenOptions}
      />
      <Stack.Screen
        name="ReceiveQR"
        component={ReceiveQRScreen}
        options={detailScreenOptions}
      />
      <Stack.Screen
        name="CashuReceive"
        component={CashuReceiveScreen}
        options={detailScreenOptions}
      />
      <Stack.Screen
        name="RecoverMint"
        component={RecoverMintScreen}
        options={detailScreenOptions}
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
      <Stack.Screen
        name="FeeRateDemo"
        component={FeeRateDemo}
        options={settingsScreenOptions}
      />
    </Stack.Navigator>
  );
}
