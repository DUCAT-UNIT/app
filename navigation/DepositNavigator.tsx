/**
 * DepositNavigator - Navigation stack for deposit flow
 * Modal presentation with 4-step flow: Input -> Confirm -> Processing -> Success
 */

import React from 'react';
import { createStackNavigator, CardStyleInterpolators } from '@react-navigation/stack';
import {
  DepositInputScreen,
  DepositConfirmScreen,
  DepositProcessingScreen,
  DepositSuccessScreen,
} from '../screens/deposit';
import { COLORS } from '../theme';
import type { DepositStackParamList } from './types';

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
