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
import SendNavigator from './SendNavigator';
import PinSetupScreen from '../screens/auth/PinSetupScreen';
import PasskeyMigrationModal from '../components/PasskeyMigrationModal';
import MutinynetBanner from '../components/MutinynetBanner';
import { COLORS } from '../theme';
import { useAuth } from '../contexts/AuthContext';
import { useBalance } from '../contexts/WalletDataContext';
import { useNavigationHandlers } from '../contexts/NavigationHandlersContext';
import { useToastContext } from '../contexts/UIContext';
import { useNavigationState } from '../hooks/useNavigationState';

const Stack = createStackNavigator();

export default function RootNavigator() {
  // Determine navigation state
  const { shouldShowAuth, shouldShowPinOverlay } = useNavigationState();

  // Get auth-specific data needed for PIN overlay
  const { isBiometricSupported } = useAuth();
  const { fetchBalance } = useBalance();
  const { showToast } = useToastContext();

  // Get handlers from context
  const {
    handlePinSetupCompleteWrapper,
    handlePinChangeCompleteWrapper,
    handleCancelPinChange,
    showPasskeyMigrationModal,
    passkeyMigrationData,
    hidePasskeyMigrationPrompt,
  } = useNavigationHandlers();

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
          <>
            <Stack.Screen name="Main" component={MainTabs} />
            <Stack.Screen
              name="SendFlow"
              component={SendNavigator}
              options={{
                presentation: 'modal',
                animationEnabled: true,
              }}
            />
          </>
        )}
      </Stack.Navigator>

      {/* PIN Change Overlay - shown on top of main app */}
      {shouldShowPinOverlay && (
        <View style={localStyles.pinOverlay}>
          <MutinynetBanner />
          <PinSetupScreen
            changingPin={true}
            isBiometricSupported={isBiometricSupported}
            onPinSetupComplete={handlePinSetupCompleteWrapper}
            onPinChangeComplete={handlePinChangeCompleteWrapper}
            onCancel={handleCancelPinChange}
            fetchBalance={fetchBalance}
            showToast={showToast}
          />
        </View>
      )}

      {/* Passkey Migration Modal - shown after wallet import */}
      {showPasskeyMigrationModal && passkeyMigrationData && (
        <PasskeyMigrationModal
          visible={showPasskeyMigrationModal}
          onClose={hidePasskeyMigrationPrompt}
          mnemonic={passkeyMigrationData.mnemonic}
          currentPin={passkeyMigrationData.pin}
          showToast={showToast}
        />
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
