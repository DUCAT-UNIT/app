/**
 * SendNavigator - Full screen send flow navigation
 * Handles all send-related screens in a modal stack
 */

import React, { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import { createStackNavigator } from '@react-navigation/stack';
import { useNavigation, EventArg } from '@react-navigation/native';
import { COLORS } from '../theme';
import { useTransactionBuild } from '../contexts/TransactionBuildContext';
import { useSendFlowStore } from '../stores/sendFlowStore';
import { withErrorBoundary } from '../components/withErrorBoundary';

// Screen imports
import AssetSelectorScreenComponent from '../screens/send/AssetSelectorScreen';
import SendInputScreenComponent from '../screens/send/SendInputScreen';
import ReviewScreenComponent from '../screens/send/ReviewScreen';
import ProcessingScreenComponent from '../screens/send/ProcessingScreen';
import TurboProcessingScreenComponent from '../screens/send/TurboProcessingScreen';
import TurboClaimingScreenComponent from '../screens/send/TurboClaimingScreen';
import ConfirmationScreenComponent from '../screens/send/ConfirmationScreen';
import TurboLoadingScreenComponent from '../screens/send/TurboLoadingScreen';

import type { SendStackParamList } from './types';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyComponent = React.ComponentType<any>;

// Wrap all screens with error boundaries
// Using AnyComponent cast to avoid strict type checking with navigator
const AssetSelectorScreen: AnyComponent = withErrorBoundary(AssetSelectorScreenComponent, {
  boundaryName: 'AssetSelectorScreen',
  fallbackMessage: 'Unable to load asset selector. Please try again.',
});

const SendInputScreen: AnyComponent = withErrorBoundary(SendInputScreenComponent, {
  boundaryName: 'SendInputScreen',
  fallbackMessage: 'Unable to load send input. Please try again.',
});

const ReviewScreen: AnyComponent = withErrorBoundary(ReviewScreenComponent, {
  boundaryName: 'ReviewScreen',
  fallbackMessage: 'Unable to load transaction review. Please try again.',
});

const ProcessingScreen: AnyComponent = withErrorBoundary(ProcessingScreenComponent, {
  boundaryName: 'ProcessingScreen',
  fallbackMessage: 'Unable to process transaction. Please try again.',
});

const TurboProcessingScreen: AnyComponent = withErrorBoundary(TurboProcessingScreenComponent, {
  boundaryName: 'TurboProcessingScreen',
  fallbackMessage: 'Unable to process turbo transaction. Please try again.',
});

const TurboClaimingScreen: AnyComponent = withErrorBoundary(TurboClaimingScreenComponent, {
  boundaryName: 'TurboClaimingScreen',
  fallbackMessage: 'Unable to claim turbo transaction. Please try again.',
});

const ConfirmationScreen: AnyComponent = withErrorBoundary(ConfirmationScreenComponent, {
  boundaryName: 'ConfirmationScreen',
  fallbackMessage: 'Unable to show confirmation. Please try again.',
});

const TurboLoadingScreen: AnyComponent = withErrorBoundary(TurboLoadingScreenComponent, {
  boundaryName: 'TurboLoadingScreen',
  fallbackMessage: 'Unable to load turbo. Please try again.',
});

const SendStack = createStackNavigator<SendStackParamList>();

interface BeforeRemoveEvent {
  data: {
    action: {
      type: string;
    };
  };
}

function SendNavigatorContent(): null {
  const navigation = useNavigation();
  const { cancelIntent } = useTransactionBuild();
  const resetSendFlow = useSendFlowStore((state) => state.resetSendFlow);

  // Clean up when send flow is dismissed (e.g., swipe down or back from first screen)
  useEffect(() => {
    const unsubscribe = navigation.addListener('beforeRemove', (e: EventArg<'beforeRemove', true, BeforeRemoveEvent['data']>) => {
      // Only cancel if user is actually leaving the send flow entirely
      // (not just navigating between send screens)
      if (e.data.action.type === 'GO_BACK' || e.data.action.type === 'POP') {
        // Cancel any active intent and release UTXOs
        cancelIntent();
        // Reset send flow state (address, amount, asset type)
        resetSendFlow();
      }
    });

    return unsubscribe;
  }, [navigation, cancelIntent, resetSendFlow]);

  return null;
}

export default function SendNavigator(): React.JSX.Element {
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
          name="SendInput"
          component={SendInputScreen}
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
      {/* Snackbar is rendered at app level in AppNavigatorContent */}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
