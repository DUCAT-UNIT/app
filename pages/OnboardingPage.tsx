/**
 * OnboardingPage - Handles wallet creation, import, and authentication flows
 */

import { StatusBar } from 'expo-status-bar';
import React from 'react';
import { StyleSheet, View } from 'react-native';

// Components
import MutinynetBanner from '../components/MutinynetBanner';
import PasskeyPinInput from '../components/PasskeyPinInput';
import LockScreen from '../screens/auth/LockScreen';
import PinSetupScreen from '../screens/auth/PinSetupScreen';
import WelcomeScreen from '../screens/auth/WelcomeScreen';

// Hooks
import {
  useOnboardingStateMachine,
  type OnboardingScreen,
} from '../hooks/useOnboardingStateMachine';

// Utils
import { COLORS } from '../theme';

interface OnboardingPageProps {
  seedConfirmed: boolean;
  setSeedConfirmed: (confirmed: boolean) => void;
  fetchBalance: () => Promise<unknown>;
  fetchTransactionHistory: () => Promise<void>;
  resetWalletAndState: () => Promise<void>;
  handlePinSetupCompleteWrapper: (pin: string, enableBiometric: boolean) => Promise<void>;
  handlePinChangeCompleteWrapper: (pin: string, enableBiometric: boolean) => Promise<void>;
  handleCancelPinChange: () => void;
  handleLockScreenAuthenticatedWrapper: () => void;
  keyboardHeight: number;
}

export default function OnboardingPage(props: OnboardingPageProps) {
  const { screen, ...state } = useOnboardingStateMachine(props);

  return (
    <View style={screen === 'welcome' ? localStyles.welcomeContainer : localStyles.container}
      testID={screen === 'welcome' ? 'onboarding-page' : undefined}
    >
      <MutinynetBanner />
      {renderScreen(screen, state)}
      <StatusBar style="light" />
    </View>
  );
}

function renderScreen(
  screen: OnboardingScreen,
  state: Omit<ReturnType<typeof useOnboardingStateMachine>, 'screen'>,
): React.ReactElement {
  switch (screen) {
    case 'passkey_pin_create': {
      const currentPin = state.confirmingPin ? state.passkeyPinConfirm : state.passkeyPin;
      const setCurrentPin = state.confirmingPin ? state.setPasskeyPinConfirm : state.setPasskeyPin;
      return (
        <PasskeyPinInput
          title={state.confirmingPin ? 'Confirm your PIN' : 'Create a 6-digit PIN'}
          subtitle={state.confirmingPin ? 'Enter your PIN again to confirm' : 'This PIN secures your wallet'}
          pin={currentPin} setPin={setCurrentPin} onPinComplete={state.handlePinEntry}
          onCancel={() => {
            state.setShowPinInput(false);
            state.setPasskeyPin('');
            state.resetPasskeyCreation();
          }}
        />
      );
    }

    case 'passkey_pin_restore':
      return (
        <PasskeyPinInput
          title="Enter your PIN" subtitle="Enter the PIN you created with your passkey wallet"
          pin={state.restorePin} setPin={state.setRestorePin}
          onPinComplete={state.restoreWalletWithPasskey}
          onCancel={() => {
            state.setRestorePin('');
            state.resetPasskeyRestore();
            state.setRestoringWithPasskey(true);
          }}
        />
      );

    case 'pin_setup':
      return (
        <PinSetupScreen
          changingPin={state.changingPin} isBiometricSupported={state.isBiometricSupported}
          onPinSetupComplete={state.handlePinSetupComplete}
          onPinChangeComplete={state.handlePinChangeComplete}
          onCancel={state.handleCancelPinChange} fetchBalance={state.fetchBalance}
        />
      );

    case 'locked':
      return (
        <LockScreen
          onAuthenticated={state.handleLockScreenAuthenticatedWrapper}
          showFaceIdButton={state.isBiometricSupported}
          onFaceIdPress={state.handleBiometricAuth}
        />
      );

    case 'welcome':
      return (
        <WelcomeScreen
          importingWallet={state.importingWallet}
          importSeedPhrase={state.importSeedPhrase}
          seedInputRefs={state.seedInputRefs}
          isImporting={state.isImporting}
          restoringWithPasskey={state.restoringWithPasskey}
          setImportingWallet={state.setImportingWallet}
          setImportSeedPhrase={state.setImportSeedPhrase}
          setRestoringWithPasskey={state.setRestoringWithPasskey}
          createWalletWithPasskey={state.startPasskeyCreation}
          importWallet={state.importWallet}
          restoreWithPasskey={state.startPasskeyRestore}
          keyboardHeight={state.keyboardHeight}
        />
      );
  }
}

const localStyles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.DARK_BG, paddingHorizontal: 0 },
  welcomeContainer: { flex: 1, backgroundColor: COLORS.DARK_BG },
});
