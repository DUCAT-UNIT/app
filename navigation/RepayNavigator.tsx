/**
 * RepayNavigator - Navigation stack for repay flow
 */

import React from 'react';
import { createStackNavigator, CardStyleInterpolators } from '@react-navigation/stack';
import { withErrorBoundary } from '../components/withErrorBoundary';
import {
  RepayInputScreen as RepayInputScreenComponent,
  RepayFundingScreen as RepayFundingScreenComponent,
  RepayConfirmScreen as RepayConfirmScreenComponent,
  RepayProcessingScreen as RepayProcessingScreenComponent,
  RepaySuccessScreen as RepaySuccessScreenComponent,
} from '../screens/repay';
import { COLORS } from '../theme';
import type { RepayStackParamList } from './types';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyComponent = React.ComponentType<any>;

const RepayInputScreen: AnyComponent = withErrorBoundary(RepayInputScreenComponent, { boundaryName: 'RepayInput', fallbackMessage: 'Unable to load repay input. Please try again.' });
const RepayFundingScreen: AnyComponent = withErrorBoundary(RepayFundingScreenComponent, { boundaryName: 'RepayFunding', fallbackMessage: 'Unable to load repay funding selection. Please try again.' });
const RepayConfirmScreen: AnyComponent = withErrorBoundary(RepayConfirmScreenComponent, { boundaryName: 'RepayConfirm', fallbackMessage: 'Unable to load repay confirmation. Please try again.' });
const RepayProcessingScreen: AnyComponent = withErrorBoundary(RepayProcessingScreenComponent, { boundaryName: 'RepayProcessing', fallbackMessage: 'Unable to load repay processing. Please try again.' });
const RepaySuccessScreen: AnyComponent = withErrorBoundary(RepaySuccessScreenComponent, { boundaryName: 'RepaySuccess', fallbackMessage: 'Unable to load repay success. Please try again.' });

const Stack = createStackNavigator<RepayStackParamList>();

export default function RepayNavigator(): React.JSX.Element {
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
      <Stack.Screen name="RepayInput" component={RepayInputScreen} />
      <Stack.Screen name="RepayFunding" component={RepayFundingScreen} />
      <Stack.Screen name="RepayConfirm" component={RepayConfirmScreen} />
      <Stack.Screen name="RepayProcessing" component={RepayProcessingScreen} />
      <Stack.Screen name="RepaySuccess" component={RepaySuccessScreen} />
    </Stack.Navigator>
  );
}
