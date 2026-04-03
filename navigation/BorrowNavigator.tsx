/**
 * BorrowNavigator - Borrow flow stack navigator
 */

import React from 'react';
import { createStackNavigator, CardStyleInterpolators } from '@react-navigation/stack';
import { COLORS } from '../theme';
import NavigationErrorBoundary from '../components/NavigationErrorBoundary';
import {
  BorrowInputScreen,
  BorrowConfirmScreen,
  BorrowProcessingScreen,
  BorrowSuccessScreen,
} from '../screens/borrow';
import type { BorrowStackParamList } from './types';

const Stack = createStackNavigator<BorrowStackParamList>();

export default function BorrowNavigator(): React.JSX.Element {
  return (
    <NavigationErrorBoundary
      boundaryName="BorrowNavigator"
      fallbackMessage="Something went wrong with the borrow flow. Please try again."
    >
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
        <Stack.Screen name="BorrowInput" component={BorrowInputScreen} />
        <Stack.Screen name="BorrowConfirm" component={BorrowConfirmScreen} />
        <Stack.Screen
          name="BorrowProcessing"
          component={BorrowProcessingScreen}
          options={{
            gestureEnabled: false, // Prevent back navigation during processing
          }}
        />
        <Stack.Screen
          name="BorrowSuccess"
          component={BorrowSuccessScreen}
          options={{
            gestureEnabled: false, // Prevent back navigation on success
          }}
        />
      </Stack.Navigator>
    </NavigationErrorBoundary>
  );
}
