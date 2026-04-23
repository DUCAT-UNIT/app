/**
 * VaultCreateNavigator - Vault creation flow stack navigator
 */

import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import { COLORS } from '../theme';
import { withErrorBoundary } from '../components/withErrorBoundary';
import {
  VaultAmountsScreen as VaultAmountsScreenComponent,
  VaultPayoutScreen as VaultPayoutScreenComponent,
  VaultConfirmScreen as VaultConfirmScreenComponent,
  VaultProcessingScreen as VaultProcessingScreenComponent,
  VaultSuccessScreen as VaultSuccessScreenComponent,
} from '../screens/vaultCreation';
import type { VaultCreateStackParamList } from './types';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyComponent = React.ComponentType<any>;

const VaultAmountsScreen: AnyComponent = withErrorBoundary(VaultAmountsScreenComponent, { boundaryName: 'VaultAmounts', fallbackMessage: 'Unable to load vault amounts. Please try again.' });
const VaultPayoutScreen: AnyComponent = withErrorBoundary(VaultPayoutScreenComponent, { boundaryName: 'VaultPayout', fallbackMessage: 'Unable to load vault payout selection. Please try again.' });
const VaultConfirmScreen: AnyComponent = withErrorBoundary(VaultConfirmScreenComponent, { boundaryName: 'VaultConfirm', fallbackMessage: 'Unable to load vault confirmation. Please try again.' });
const VaultProcessingScreen: AnyComponent = withErrorBoundary(VaultProcessingScreenComponent, { boundaryName: 'VaultProcessing', fallbackMessage: 'Unable to load vault processing. Please try again.' });
const VaultSuccessScreen: AnyComponent = withErrorBoundary(VaultSuccessScreenComponent, { boundaryName: 'VaultSuccess', fallbackMessage: 'Unable to load vault success. Please try again.' });

const Stack = createStackNavigator<VaultCreateStackParamList>();

export default function VaultCreateNavigator(): React.JSX.Element {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        cardStyle: { backgroundColor: COLORS.DARK_BG },
        gestureEnabled: false,
      }}
    >
      <Stack.Screen name="VaultAmounts" component={VaultAmountsScreen} />
      <Stack.Screen name="VaultPayout" component={VaultPayoutScreen} />
      <Stack.Screen name="VaultConfirm" component={VaultConfirmScreen} />
      <Stack.Screen name="VaultProcessing" component={VaultProcessingScreen} options={{ gestureEnabled: false }} />
      <Stack.Screen name="VaultSuccess" component={VaultSuccessScreen} options={{ gestureEnabled: false }} />
    </Stack.Navigator>
  );
}
