/**
 * RepayNavigator - Navigation stack for repay flow
 * Modal presentation with 4-step flow: Input -> Confirm -> Processing -> Success
 */

import React from 'react';
import { createStackNavigator, CardStyleInterpolators } from '@react-navigation/stack';
import {
  RepayInputScreen,
  RepayConfirmScreen,
  RepayProcessingScreen,
  RepaySuccessScreen,
} from '../screens/repay';
import { COLORS } from '../theme';
import type { RepayStackParamList } from './types';

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
      <Stack.Screen name="RepayConfirm" component={RepayConfirmScreen} />
      <Stack.Screen name="RepayProcessing" component={RepayProcessingScreen} />
      <Stack.Screen name="RepaySuccess" component={RepaySuccessScreen} />
    </Stack.Navigator>
  );
}
