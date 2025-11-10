/**
 * RootNavigator - Top-level navigation structure
 * Switches between Auth flow and Main app based on authentication state
 */

import React from 'react';
import { View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import AuthStack from './AuthStack';
import MainTabs from './MainTabs';
import PinSetupScreen from '../components/PinSetupScreen';
import MutinynetBanner from '../components/MutinynetBanner';
import { COLORS } from '../utils/colors';
import { useAuth } from '../contexts/AuthContext';

const Stack = createStackNavigator();

export default function RootNavigator({
  // Auth state
  isAuthenticated,
  wallet,
  seedConfirmed,
  settingUpPin,
  showPinEntry,

  // Auth flow props
  setSeedConfirmed,
  showToast,
  fetchBalance,
  resetWalletAndState,
  handlePinSetupCompleteWrapper,
  handlePinChangeCompleteWrapper,
  handleCancelPinChange,
  handleLockScreenAuthenticatedWrapper,

  // Main app props
  resetInactivityTimer,
  handleOpenVault,
  vaultCredentials,
  autoCreateVaultTrigger,
  amountInputRef,
  setShowAccountPicker,
  settingsHandlers,
  biometricEnabled,
  activeTab,
  setActiveTab,
  keyboardHeight,

  styles,
}) {
  const { changingPin, isBiometricSupported } = useAuth();

  // Determine if we should show onboarding/auth flow
  // Exclude settingUpPin when changing PIN (it will be shown as overlay)
  const shouldShowAuth = !wallet ||
    (wallet && !seedConfirmed) ||
    (settingUpPin && !changingPin) ||
    showPinEntry ||
    (!isAuthenticated && wallet && seedConfirmed);

  console.log('[RootNavigator] Render decision:', {
    wallet: !!wallet,
    seedConfirmed,
    settingUpPin,
    changingPin,
    showPinEntry,
    isAuthenticated,
    shouldShowAuth
  });

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
          <Stack.Screen name="Auth">
            {(props) => (
              <AuthStack
                {...props}
                seedConfirmed={seedConfirmed}
                setSeedConfirmed={setSeedConfirmed}
                showToast={showToast}
                fetchBalance={fetchBalance}
                resetWalletAndState={resetWalletAndState}
                handlePinSetupCompleteWrapper={handlePinSetupCompleteWrapper}
                handlePinChangeCompleteWrapper={handlePinChangeCompleteWrapper}
                handleCancelPinChange={handleCancelPinChange}
                handleLockScreenAuthenticatedWrapper={handleLockScreenAuthenticatedWrapper}
                styles={styles}
              />
            )}
          </Stack.Screen>
        ) : (
          <Stack.Screen name="Main">
            {(props) => (
              <MainTabs
                {...props}
                styles={styles}
                resetInactivityTimer={resetInactivityTimer}
                handleOpenVault={handleOpenVault}
                vaultCredentials={vaultCredentials}
                autoCreateVaultTrigger={autoCreateVaultTrigger}
                amountInputRef={amountInputRef}
                setShowAccountPicker={setShowAccountPicker}
                settingsHandlers={settingsHandlers}
                biometricEnabled={biometricEnabled}
                activeTab={activeTab}
                setActiveTab={setActiveTab}
                keyboardHeight={keyboardHeight}
              />
            )}
          </Stack.Screen>
        )}
      </Stack.Navigator>

      {/* PIN Change Overlay - shown on top of main app */}
      {settingUpPin && changingPin && (
        <View
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: COLORS.DARK_BG,
            zIndex: 1000,
          }}
        >
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
