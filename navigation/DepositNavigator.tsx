/**
 * DepositNavigator - Navigation stack for deposit flow
 */

import React from 'react';
import { createStackNavigator, CardStyleInterpolators } from '@react-navigation/stack';
import { withErrorBoundary } from '../components/withErrorBoundary';
import {
  DepositInputScreen as DepositInputScreenComponent,
  DepositConfirmScreen as DepositConfirmScreenComponent,
  DepositProcessingScreen as DepositProcessingScreenComponent,
  DepositSuccessScreen as DepositSuccessScreenComponent,
} from '../screens/deposit';
import { COLORS } from '../theme';
import type { DepositStackParamList } from './types';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyComponent = React.ComponentType<any>;

const DepositInputScreen: AnyComponent = withErrorBoundary(DepositInputScreenComponent, { boundaryName: 'DepositInput', fallbackMessage: 'Unable to load deposit input. Please try again.' });
const DepositConfirmScreen: AnyComponent = withErrorBoundary(DepositConfirmScreenComponent, { boundaryName: 'DepositConfirm', fallbackMessage: 'Unable to load deposit confirmation. Please try again.' });
const DepositProcessingScreen: AnyComponent = withErrorBoundary(DepositProcessingScreenComponent, { boundaryName: 'DepositProcessing', fallbackMessage: 'Unable to load deposit processing. Please try again.' });
const DepositSuccessScreen: AnyComponent = withErrorBoundary(DepositSuccessScreenComponent, { boundaryName: 'DepositSuccess', fallbackMessage: 'Unable to load deposit success. Please try again.' });

const Stack = createStackNavigator<DepositStackParamList>();

export default function DepositNavigator(): React.JSX.Element {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        cardStyle: { backgroundColor: COLORS.DARK_BG },
        gestureEnabled: false,
        cardStyleInterpolator: CardStyleInterpolators.forNoAnimation,
        transitionSpec: {
          open: { animation: 'timing', config: { duration: 0 } },
          close: { animation: 'timing', config: { duration: 0 } },
        },
      }}
    >
      <Stack.Screen name="DepositInput" component={DepositInputScreen} />
      <Stack.Screen name="DepositConfirm" component={DepositConfirmScreen} />
      <Stack.Screen name="DepositProcessing" component={DepositProcessingScreen} />
      <Stack.Screen name="DepositSuccess" component={DepositSuccessScreen} />
    </Stack.Navigator>
  );
}
