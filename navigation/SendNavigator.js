/**
 * SendNavigator - Full screen send flow navigation
 * Handles all send-related screens in a modal stack
 */

import React from 'react';
import { View, StyleSheet } from 'react-native';
import { createStackNavigator } from '@react-navigation/stack';
import { COLORS } from '../theme';
import { useToastContext } from '../contexts/UIContext';
import ToastContainer from '../components/ToastContainer';

// Screen imports
import AssetSelectorScreen from '../screens/send/AssetSelectorScreen';
import AddressInputScreen from '../screens/send/AddressInputScreen';
import AmountInputScreen from '../screens/send/AmountInputScreen';
import ReviewScreen from '../screens/send/ReviewScreen';
import ProcessingScreen from '../screens/send/ProcessingScreen';
import ConfirmationScreen from '../screens/send/ConfirmationScreen';

const SendStack = createStackNavigator();

export default function SendNavigator() {
  const { toasts } = useToastContext();

  return (
    <View style={styles.container}>
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
