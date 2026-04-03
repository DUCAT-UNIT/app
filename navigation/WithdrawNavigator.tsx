/**
 * WithdrawNavigator - Navigation stack for withdraw flow
 */

import React from 'react';
import { createStackNavigator, CardStyleInterpolators } from '@react-navigation/stack';
import { withErrorBoundary } from '../components/withErrorBoundary';
import {
  WithdrawInputScreen as WithdrawInputScreenComponent,
  WithdrawConfirmScreen as WithdrawConfirmScreenComponent,
  WithdrawProcessingScreen as WithdrawProcessingScreenComponent,
  WithdrawSuccessScreen as WithdrawSuccessScreenComponent,
} from '../screens/withdraw';
import { COLORS } from '../theme';
import type { WithdrawStackParamList } from './types';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyComponent = React.ComponentType<any>;

const WithdrawInputScreen: AnyComponent = withErrorBoundary(WithdrawInputScreenComponent, { boundaryName: 'WithdrawInput', fallbackMessage: 'Unable to load withdraw input. Please try again.' });
const WithdrawConfirmScreen: AnyComponent = withErrorBoundary(WithdrawConfirmScreenComponent, { boundaryName: 'WithdrawConfirm', fallbackMessage: 'Unable to load withdraw confirmation. Please try again.' });
const WithdrawProcessingScreen: AnyComponent = withErrorBoundary(WithdrawProcessingScreenComponent, { boundaryName: 'WithdrawProcessing', fallbackMessage: 'Unable to load withdraw processing. Please try again.' });
const WithdrawSuccessScreen: AnyComponent = withErrorBoundary(WithdrawSuccessScreenComponent, { boundaryName: 'WithdrawSuccess', fallbackMessage: 'Unable to load withdraw success. Please try again.' });

const Stack = createStackNavigator<WithdrawStackParamList>();

export default function WithdrawNavigator(): React.JSX.Element {
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
      <Stack.Screen name="WithdrawInput" component={WithdrawInputScreen} />
      <Stack.Screen name="WithdrawConfirm" component={WithdrawConfirmScreen} />
      <Stack.Screen name="WithdrawProcessing" component={WithdrawProcessingScreen} />
      <Stack.Screen name="WithdrawSuccess" component={WithdrawSuccessScreen} />
    </Stack.Navigator>
  );
}
