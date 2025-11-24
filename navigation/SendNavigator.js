/**
 * SendNavigator - Full screen send flow navigation
 * Handles all send-related screens in a modal stack
 */

import React, { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import { createStackNavigator } from '@react-navigation/stack';
import { useNavigation } from '@react-navigation/native';
import { COLORS } from '../theme';
import { useNotifications } from "../contexts/NotificationContext";
import { useTransactionBuild } from '../contexts/TransactionBuildContext';
import ToastContainer from '../components/ToastContainer';
import { withErrorBoundary } from '../components/withErrorBoundary';

// Screen imports
import AssetSelectorScreenComponent from '../screens/send/AssetSelectorScreen';
import AddressInputScreenComponent from '../screens/send/AddressInputScreen';
import AmountInputScreenComponent from '../screens/send/AmountInputScreen';
import ReviewScreenComponent from '../screens/send/ReviewScreen';
import ProcessingScreenComponent from '../screens/send/ProcessingScreen';
import TurboProcessingScreenComponent from '../screens/send/TurboProcessingScreen';
import TurboClaimingScreenComponent from '../screens/send/TurboClaimingScreen';
import ConfirmationScreenComponent from '../screens/send/ConfirmationScreen';
import TurboLoadingScreenComponent from '../screens/send/TurboLoadingScreen';

// Wrap all screens with error boundaries
const AssetSelectorScreen = withErrorBoundary(AssetSelectorScreenComponent, {
  boundaryName: 'AssetSelectorScreen',
  fallbackMessage: 'Unable to load asset selector. Please try again.',
});

const AddressInputScreen = withErrorBoundary(AddressInputScreenComponent, {
  boundaryName: 'AddressInputScreen',
  fallbackMessage: 'Unable to load address input. Please try again.',
});

const AmountInputScreen = withErrorBoundary(AmountInputScreenComponent, {
  boundaryName: 'AmountInputScreen',
  fallbackMessage: 'Unable to load amount input. Please try again.',
});

const ReviewScreen = withErrorBoundary(ReviewScreenComponent, {
  boundaryName: 'ReviewScreen',
  fallbackMessage: 'Unable to load transaction review. Please try again.',
});

const ProcessingScreen = withErrorBoundary(ProcessingScreenComponent, {
  boundaryName: 'ProcessingScreen',
  fallbackMessage: 'Unable to process transaction. Please try again.',
});

const TurboProcessingScreen = withErrorBoundary(TurboProcessingScreenComponent, {
  boundaryName: 'TurboProcessingScreen',
  fallbackMessage: 'Unable to process turbo transaction. Please try again.',
});

const TurboClaimingScreen = withErrorBoundary(TurboClaimingScreenComponent, {
  boundaryName: 'TurboClaimingScreen',
  fallbackMessage: 'Unable to claim turbo transaction. Please try again.',
});

const ConfirmationScreen = withErrorBoundary(ConfirmationScreenComponent, {
  boundaryName: 'ConfirmationScreen',
  fallbackMessage: 'Unable to show confirmation. Please try again.',
});

const TurboLoadingScreen = withErrorBoundary(TurboLoadingScreenComponent, {
  boundaryName: 'TurboLoadingScreen',
  fallbackMessage: 'Unable to load turbo. Please try again.',
});

const SendStack = createStackNavigator();

function SendNavigatorContent() {
  const navigation = useNavigation();
  const { cancelIntent } = useTransactionBuild();

  // Clean up when send flow is dismissed (e.g., swipe down or back from first screen)
  useEffect(() => {
    const unsubscribe = navigation.addListener('beforeRemove', (e) => {
      // Only cancel if user is actually leaving the send flow entirely
      // (not just navigating between send screens)
      if (e.data.action.type === 'GO_BACK' || e.data.action.type === 'POP') {
        // Cancel any active intent and release UTXOs
        cancelIntent();
      }
    });

    return unsubscribe;
  }, [navigation, cancelIntent]);

  return null;
}

export default function SendNavigator() {
  const { toasts } = useNotifications();

  return (
    <View style={styles.container}>
      <SendNavigatorContent />
      <SendStack.Navigator
      screenOptions={{
        headerShown: false, // Custom headers per screen
        cardStyle: { backgroundColor: COLORS.DARK_BG },
        presentation: 'card',
        gestureEnabled: true,
        gestureDirection: 'horizontal',
      }}
    >
      <SendStack.Screen
        name="AssetSelector"
        component={AssetSelectorScreen}
      />
      <SendStack.Screen
        name="AddressInput"
        component={AddressInputScreen}
      />
      <SendStack.Screen
        name="AmountInput"
        component={AmountInputScreen}
      />
      <SendStack.Screen
        name="TurboLoading"
        component={TurboLoadingScreen}
        options={{
          gestureEnabled: false, // Prevent back during loading
        }}
      />
      <SendStack.Screen
        name="Review"
        component={ReviewScreen}
      />
      <SendStack.Screen
        name="Processing"
        component={ProcessingScreen}
        options={{
          gestureEnabled: false, // Prevent back during processing
        }}
      />
      <SendStack.Screen
        name="TurboProcessing"
        component={TurboProcessingScreen}
        options={{
          gestureEnabled: false, // Prevent back during processing
        }}
      />
      <SendStack.Screen
        name="TurboClaiming"
        component={TurboClaimingScreen}
        options={{
          gestureEnabled: false, // Prevent back during claiming
        }}
      />
      <SendStack.Screen
        name="Confirmation"
        component={ConfirmationScreen}
        options={{
          gestureEnabled: false, // Prevent back after confirmation
        }}
      />
    </SendStack.Navigator>
    <ToastContainer toasts={toasts} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
