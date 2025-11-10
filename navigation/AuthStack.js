/**
 * AuthStack - Navigation for onboarding/authentication flow
 * Handles: Wallet creation, import, PIN setup, lock screen
 */

import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import OnboardingPage from '../pages/OnboardingPage';

const Stack = createStackNavigator();

export default function AuthStack({
  seedConfirmed,
  setSeedConfirmed,
  showToast,
  fetchBalance,
  resetWalletAndState,
  handlePinSetupCompleteWrapper,
  handlePinChangeCompleteWrapper,
  handleCancelPinChange,
  handleLockScreenAuthenticatedWrapper,
  styles,
}) {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        cardStyle: { backgroundColor: '#0a0a0a' },
        animationEnabled: true,
      }}
    >
      <Stack.Screen name="Onboarding">
        {(props) => (
          <OnboardingPage
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
    </Stack.Navigator>
  );
}
