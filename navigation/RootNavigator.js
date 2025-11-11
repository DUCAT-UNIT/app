/**
 * RootNavigator - Top-level navigation structure
 * Switches between Auth flow and Main app based on authentication state
 */

import React from 'react';
import { View, StyleSheet } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import AuthStack from './AuthStack';
import MainTabs from './MainTabs';
import PinSetupScreen from '../components/PinSetupScreen';
import MutinynetBanner from '../components/MutinynetBanner';
import { COLORS } from '../utils/colors';
import { useAuth } from '../contexts/AuthContext';
import { useWallet } from '../contexts/WalletContext';
import { useBalance } from '../contexts/BalanceContext';
import { useOnboardingFlow } from '../contexts/OnboardingFlowContext';
import { useNavigationHandlers } from '../contexts/NavigationHandlersContext';
import { useToastContext } from '../contexts/ToastContext';

const Stack = createStackNavigator();

export default function RootNavigator() {
  // Consume contexts
  const { isAuthenticated, changingPin, settingUpPin, showPinEntry, isBiometricSupported } =
    useAuth();
  const { wallet } = useWallet();
  const { fetchBalance } = useBalance();
  const { seedConfirmed } = useOnboardingFlow();
  const { showToast } = useToastContext();

  // Get handlers from context
  const { handlePinSetupCompleteWrapper, handlePinChangeCompleteWrapper, handleCancelPinChange } =
    useNavigationHandlers();

  // Determine if we should show onboarding/auth flow
  // Exclude settingUpPin when changing PIN (it will be shown as overlay)
  const shouldShowAuth =
    !wallet ||
    (wallet && !seedConfirmed) ||
    (settingUpPin && !changingPin) ||
    showPinEntry ||
    (!isAuthenticated && wallet && seedConfirmed);

  return (
    <NavigationContainer>
      <Stack.Navigator
        screenOptions={{
          headerShown: false,
          cardStyle: { backgroundColor: COLORS.DARK_BG },
          animationEnabled: false, // Disable animation for root-level switches
        }}
      >
        {shouldShowAuth ? (
          <Stack.Screen name="Auth" component={AuthStack} />
        ) : (
          <Stack.Screen name="Main" component={MainTabs} />
        )}
      </Stack.Navigator>

      {/* PIN Change Overlay - shown on top of main app */}
      {settingUpPin && changingPin && (
        <View style={localStyles.pinOverlay}>
          <MutinynetBanner />
          <PinSetupScreen
            changingPin={changingPin}
            isBiometricSupported={isBiometricSupported}
            onPinSetupComplete={handlePinSetupCompleteWrapper}
            onPinChangeComplete={handlePinChangeCompleteWrapper}
            onCancel={handleCancelPinChange}
            fetchBalance={fetchBalance}
            showToast={showToast}
          />
        </View>
      )}
    </NavigationContainer>
  );
}

const localStyles = StyleSheet.create({
  pinOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: COLORS.DARK_BG,
    zIndex: 1000,
  },
});
