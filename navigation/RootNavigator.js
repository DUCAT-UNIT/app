/**
 * RootNavigator - Top-level navigation structure
 * Switches between Auth flow and Main app based on authentication state
 */

import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import AuthStack from './AuthStack';
import MainTabs from './MainTabs';
import { COLORS } from '../utils/colors';

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
  // Determine if we should show onboarding/auth flow
  const shouldShowAuth = !wallet ||
    (wallet && !seedConfirmed) ||
    settingUpPin ||
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
    </NavigationContainer>
  );
}
