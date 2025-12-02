/**
 * AuthStack - Navigation for onboarding/authentication flow
 * Handles: Wallet creation, import, PIN setup, lock screen
 */

import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import { withErrorBoundary } from '../components/withErrorBoundary';
import OnboardingPageComponent from '../pages/OnboardingPage';
import { useOnboardingFlow } from '../contexts/AuthContext';
import { useNavigationHandlers } from '../contexts/NavigationHandlersContext';
import { useBalance, useTransactionHistory } from '../contexts/WalletDataContext';
import { useNotifications } from '../stores/notificationStore';
import { useKeyboard } from '../hooks/useKeyboard';
import styles from '../styles';

import type { AuthStackParamList } from './types';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyComponent = React.ComponentType<any>;

// Wrap onboarding with error boundary
const OnboardingPage: AnyComponent = withErrorBoundary(OnboardingPageComponent, {
  boundaryName: 'OnboardingScreen',
  fallbackMessage: 'Unable to load onboarding. Please restart the app.',
});

const Stack = createStackNavigator<AuthStackParamList>();

export default function AuthStack(): React.JSX.Element {
  // Consume contexts
  const { seedConfirmed, setSeedConfirmed, resetWalletAndState } = useOnboardingFlow();
  const { fetchBalance } = useBalance();
  const { fetchTransactionHistory } = useTransactionHistory();
  const { showToast } = useNotifications();
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
        animation: 'none',
      }}
    >
      <Stack.Screen name="Onboarding">
        {(props: unknown) => (
          <OnboardingPage
            {...(props as object)}
            seedConfirmed={seedConfirmed}
            setSeedConfirmed={setSeedConfirmed}
            showToast={showToast}
            fetchBalance={fetchBalance}
            fetchTransactionHistory={fetchTransactionHistory}
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
