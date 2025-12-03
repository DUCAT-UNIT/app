/**
 * VaultCreateNavigator - Vault creation flow stack navigator
 */

import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import { COLORS } from '../theme';
import {
  VaultAmountsScreen,
  VaultConfirmScreen,
  VaultProcessingScreen,
  VaultSuccessScreen,
} from '../screens/vaultCreation';
import type { VaultCreateStackParamList } from './types';

const Stack = createStackNavigator<VaultCreateStackParamList>();

export default function VaultCreateNavigator(): React.JSX.Element {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        cardStyle: { backgroundColor: COLORS.DARK_BG },
        gestureEnabled: false, // Disable gestures during vault creation
      }}
    >
      <Stack.Screen name="VaultAmounts" component={VaultAmountsScreen} />
      <Stack.Screen name="VaultConfirm" component={VaultConfirmScreen} />
      <Stack.Screen
        name="VaultProcessing"
        component={VaultProcessingScreen}
        options={{
          gestureEnabled: false, // Prevent back navigation during processing
        }}
      />
      <Stack.Screen
        name="VaultSuccess"
        component={VaultSuccessScreen}
        options={{
          gestureEnabled: false, // Prevent back navigation on success
        }}
      />
    </Stack.Navigator>
  );
}
