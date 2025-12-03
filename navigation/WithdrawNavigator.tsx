/**
 * WithdrawNavigator - Navigation stack for withdraw flow
 * Modal presentation with 4-step flow: Input -> Confirm -> Processing -> Success
 */

import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import {
  WithdrawInputScreen,
  WithdrawConfirmScreen,
  WithdrawProcessingScreen,
  WithdrawSuccessScreen,
} from '../screens/withdraw';
import { COLORS } from '../theme';
import type { WithdrawStackParamList } from './types';

const Stack = createStackNavigator<WithdrawStackParamList>();

export default function WithdrawNavigator(): React.JSX.Element {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        cardStyle: { backgroundColor: COLORS.DARK_BG },
        gestureEnabled: false,
      }}
    >
      <Stack.Screen name="WithdrawInput" component={WithdrawInputScreen} />
      <Stack.Screen name="WithdrawConfirm" component={WithdrawConfirmScreen} />
      <Stack.Screen name="WithdrawProcessing" component={WithdrawProcessingScreen} />
      <Stack.Screen name="WithdrawSuccess" component={WithdrawSuccessScreen} />
    </Stack.Navigator>
  );
}
