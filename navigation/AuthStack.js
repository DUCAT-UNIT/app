/**
 * AuthStack - Navigation for onboarding/authentication flow
 * Handles: Wallet creation, import, PIN setup, lock screen
 */

import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import OnboardingPage from '../pages/OnboardingPage';
import { useOnboardingFlow } from '../contexts/OnboardingFlowContext';
import { useNavigationHandlers } from '../contexts/NavigationHandlersContext';
import { useBalance } from '../contexts/BalanceContext';
import { useToastContext } from '../contexts/ToastContext';
import { useKeyboard } from '../hooks/useKeyboard';
import styles from '../styles';

const Stack = createStackNavigator();

export default function AuthStack() {
  // Consume contexts
  const { seedConfirmed, setSeedConfirmed, resetWalletAndState } = useOnboardingFlow();
  const { fetchBalance } = useBalance();
  const { showToast } = useToastContext();
  const { keyboardHeight } = useKeyboard();

  // Get handlers from context
  const {
    handlePinSetupCompleteWrapper,
    handlePinChangeCompleteWrapper,
    handleCancelPinChange,
    handleLockScreenAuthenticatedWrapper,
  } = useNavigationHandlers();
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        cardStyle: { backgroundColor: '#0a0a0a' },
        animationEnabled: false,
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
            keyboardHeight={keyboardHeight}
            styles={styles}
          />
        )}
      </Stack.Screen>
    </Stack.Navigator>
  );
}
