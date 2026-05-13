/**
 * WalletStackNavigator - Stack navigator for wallet-related screens
 * Contains WalletPage and AssetDetailScreen
 */

import React from 'react';
import {
  createStackNavigator,
  StackNavigationOptions,
  StackCardStyleInterpolator,
} from '@react-navigation/stack';
import { withErrorBoundary } from '../components/withErrorBoundary';
import WalletPageComponent from '../pages/WalletPage';
import AssetDetailScreenComponent from '../screens/wallet/AssetDetailScreen';
import VaultDetailScreenComponent from '../screens/wallet/VaultDetailScreen';
import ReceiveQRScreenComponent from '../screens/wallet/ReceiveQRScreen';
import CashuReceiveScreenComponent from '../screens/cashu/CashuReceiveScreen';
import RecoverMintScreenComponent from '../screens/wallet/RecoverMintScreen';
import BridgeScreenComponent from '../screens/bridge/BridgeScreen';
import SwapScreenComponent from '../screens/bridge/SwapScreen';
import SwapSummaryScreenComponent from '../screens/bridge/SwapSummaryScreen';
import RedeemScreenComponent from '../screens/bridge/RedeemScreen';
import SepoliaSendScreenComponent from '../screens/bridge/SepoliaSendScreen';
import SettingsHomeScreenComponent from '../screens/settings/SettingsHomeScreen';
import CashuSettingsScreenComponent from '../screens/settings/CashuSettingsScreen';
import QuantaLinkScreenComponent from '../screens/settings/QuantaLinkScreen';
import AboutScreenComponent from '../screens/settings/AboutScreen';
import TermsOfServiceScreenComponent from '../screens/settings/TermsOfServiceScreen';
import PrivacyPolicyScreenComponent from '../screens/settings/PrivacyPolicyScreen';
import PreferencesScreenComponent from '../screens/settings/PreferencesScreen';
import SecurityScreenComponent from '../screens/settings/SecurityScreen';
import AdvancedScreenComponent from '../screens/settings/AdvancedScreen';
import { useSettingsHandlers } from '../contexts/NavigationHandlersContext';
import { COLORS } from '../theme';
import { ENABLE_QUANTA_REWARDS } from '../utils/releaseFlags';

import type { RootNavigatorParamList, WalletStackParamList } from './types';

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

const BridgeScreen: AnyComponent = withErrorBoundary(BridgeScreenComponent, {
  boundaryName: 'BridgeScreen',
  fallbackMessage: 'Unable to load the USDC bridge screen. Please try again.',
});

const SwapScreen: AnyComponent = withErrorBoundary(SwapScreenComponent, {
  boundaryName: 'SwapScreen',
  fallbackMessage: 'Unable to load the USDC swap screen. Please try again.',
});

const SwapSummaryScreen: AnyComponent = withErrorBoundary(SwapSummaryScreenComponent, {
  boundaryName: 'SwapSummaryScreen',
  fallbackMessage: 'Unable to load the swap summary screen. Please try again.',
});

const RedeemScreen: AnyComponent = withErrorBoundary(RedeemScreenComponent, {
  boundaryName: 'RedeemScreen',
  fallbackMessage: 'Unable to load the redemption screen. Please try again.',
});

const SepoliaSendScreen: AnyComponent = withErrorBoundary(SepoliaSendScreenComponent, {
  boundaryName: 'SepoliaSendScreen',
  fallbackMessage: 'Unable to load the USDC send screen. Please try again.',
});

const SettingsHomeScreen: AnyComponent = withErrorBoundary(SettingsHomeScreenComponent, {
  boundaryName: 'SettingsHomeScreen',
  fallbackMessage: 'Unable to load settings. Please try again.',
});

const CashuSettingsScreen: AnyComponent = withErrorBoundary(CashuSettingsScreenComponent, {
  boundaryName: 'CashuSettingsScreen',
  fallbackMessage: 'Unable to load Cashu settings. Please try again.',
});

const QuantaLinkScreen: AnyComponent = withErrorBoundary(QuantaLinkScreenComponent, {
  boundaryName: 'QuantaLinkScreen',
  fallbackMessage: 'Unable to load Quanta linking. Please try again.',
});

const AboutScreen: AnyComponent = withErrorBoundary(AboutScreenComponent, {
  boundaryName: 'AboutScreen',
  fallbackMessage: 'Unable to load about screen. Please try again.',
});

const TermsOfServiceScreen: AnyComponent = withErrorBoundary(TermsOfServiceScreenComponent, {
  boundaryName: 'TermsOfServiceScreen',
  fallbackMessage: 'Unable to load terms of service. Please try again.',
});

const PrivacyPolicyScreen: AnyComponent = withErrorBoundary(PrivacyPolicyScreenComponent, {
  boundaryName: 'PrivacyPolicyScreen',
  fallbackMessage: 'Unable to load privacy policy. Please try again.',
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

type FeatureGateNavigation = {
  canGoBack?: () => boolean;
  goBack: () => void;
  navigate: (screen: string) => void;
};

function leaveGatedScreen(navigation: FeatureGateNavigation): void {
  if (navigation.canGoBack?.()) {
    navigation.goBack();
    return;
  }

  navigation.navigate('WalletHome');
}

function withUsdcFeatureGate(Component: AnyComponent): AnyComponent {
  return function UsdcFeatureGate(props: {
    navigation: FeatureGateNavigation;
  }): React.ReactElement | null {
    const { settingsHandlers } = useSettingsHandlers();

    React.useEffect(() => {
      if (!settingsHandlers.usdcFeaturesEnabled) {
        leaveGatedScreen(props.navigation);
      }
    }, [props.navigation, settingsHandlers.usdcFeaturesEnabled]);

    if (!settingsHandlers.usdcFeaturesEnabled) {
      return null;
    }

    return <Component {...props} />;
  };
}

const GatedBridgeScreen = withUsdcFeatureGate(BridgeScreen);
const GatedSwapScreen = withUsdcFeatureGate(SwapScreen);
const GatedSwapSummaryScreen = withUsdcFeatureGate(SwapSummaryScreen);
const GatedRedeemScreen = withUsdcFeatureGate(RedeemScreen);
const GatedSepoliaSendScreen = withUsdcFeatureGate(SepoliaSendScreen);

function withQuantaFeatureGate(Component: AnyComponent): AnyComponent {
  return function QuantaFeatureGate(props: {
    navigation: FeatureGateNavigation;
  }): React.ReactElement | null {
    React.useEffect(() => {
      if (!ENABLE_QUANTA_REWARDS) {
        leaveGatedScreen(props.navigation);
      }
    }, [props.navigation]);

    if (!ENABLE_QUANTA_REWARDS) {
      return null;
    }

    return <Component {...props} />;
  };
}

const GatedQuantaLinkScreen = withQuantaFeatureGate(QuantaLinkScreen);

const Stack = createStackNavigator<WalletStackParamList>();

type WalletStackNavigatorProps = {
  onActiveRouteNameChange?: (routeName: keyof WalletStackParamList) => void;
  redirectHomeToMain?: boolean;
};

type WalletStackState = {
  index?: number;
  routes?: Array<{ name?: string }>;
};

function getActiveWalletRouteName(state?: WalletStackState): keyof WalletStackParamList {
  if (!state?.routes?.length) {
    return 'WalletHome';
  }

  const index = typeof state.index === 'number' ? state.index : 0;
  const routeName = state.routes[index]?.name ?? 'WalletHome';
  return routeName as keyof WalletStackParamList;
}

type WalletHomeRedirectNavigation = {
  getParent?: () =>
    | {
        canGoBack?: () => boolean;
        goBack?: () => void;
        navigate?: <T extends keyof RootNavigatorParamList>(
          screen: T,
          params?: RootNavigatorParamList[T]
        ) => void;
      }
    | undefined;
};

function WalletHomeRedirect({ navigation }: { navigation: WalletHomeRedirectNavigation }): null {
  React.useEffect(() => {
    const parent = navigation.getParent?.();
    if (parent?.goBack && parent.canGoBack?.()) {
      parent.goBack();
      return;
    }

    parent?.navigate?.('Main', { screen: 'WalletTab', params: undefined });
  }, [navigation]);

  return null;
}

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

export default function WalletStackNavigator({
  onActiveRouteNameChange,
  redirectHomeToMain = false,
}: WalletStackNavigatorProps): React.JSX.Element {
  React.useEffect(() => {
    onActiveRouteNameChange?.('WalletHome');
  }, [onActiveRouteNameChange]);

  return (
    <Stack.Navigator
      screenListeners={{
        state: (event) => {
          onActiveRouteNameChange?.(getActiveWalletRouteName(event.data.state as WalletStackState));
        },
      }}
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
        component={redirectHomeToMain ? WalletHomeRedirect : WalletPage}
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
      <Stack.Screen name="ReceiveQR" component={ReceiveQRScreen} options={detailScreenOptions} />
      <Stack.Screen name="UnitBridge" component={GatedBridgeScreen} options={detailScreenOptions} />
      <Stack.Screen name="SepoliaSwap" component={GatedSwapScreen} options={detailScreenOptions} />
      <Stack.Screen
        name="SepoliaSwapSummary"
        component={GatedSwapSummaryScreen}
        options={detailScreenOptions}
      />
      <Stack.Screen
        name="SepoliaRedeem"
        component={GatedRedeemScreen}
        options={detailScreenOptions}
      />
      <Stack.Screen
        name="SepoliaSend"
        component={GatedSepoliaSendScreen}
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
        name="SettingsHome"
        component={SettingsHomeScreen}
        options={settingsScreenOptions}
      />
      <Stack.Screen
        name="Preferences"
        component={PreferencesScreen}
        options={settingsScreenOptions}
      />
      <Stack.Screen name="Security" component={SecurityScreen} options={settingsScreenOptions} />
      <Stack.Screen name="Advanced" component={AdvancedScreen} options={settingsScreenOptions} />
      <Stack.Screen
        name="CashuSettings"
        component={CashuSettingsScreen}
        options={settingsScreenOptions}
      />
      <Stack.Screen
        name="QuantaLink"
        component={GatedQuantaLinkScreen}
        options={settingsScreenOptions}
      />
      <Stack.Screen name="About" component={AboutScreen} options={settingsScreenOptions} />
      <Stack.Screen
        name="TermsOfService"
        component={TermsOfServiceScreen}
        options={settingsScreenOptions}
      />
      <Stack.Screen
        name="PrivacyPolicy"
        component={PrivacyPolicyScreen}
        options={settingsScreenOptions}
      />
    </Stack.Navigator>
  );
}
