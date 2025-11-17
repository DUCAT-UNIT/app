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

// Screen imports
import AssetSelectorScreen from '../screens/send/AssetSelectorScreen';
import AddressInputScreen from '../screens/send/AddressInputScreen';
import AmountInputScreen from '../screens/send/AmountInputScreen';
import ReviewScreen from '../screens/send/ReviewScreen';
import ProcessingScreen from '../screens/send/ProcessingScreen';
import ConfirmationScreen from '../screens/send/ConfirmationScreen';

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
