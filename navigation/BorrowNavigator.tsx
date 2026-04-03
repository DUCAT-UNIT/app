/**
 * BorrowNavigator - Borrow flow stack navigator
 */

import React from 'react';
import { createStackNavigator, CardStyleInterpolators } from '@react-navigation/stack';
import { COLORS } from '../theme';
import { withErrorBoundary } from '../components/withErrorBoundary';
import {
  BorrowInputScreen as BorrowInputScreenComponent,
  BorrowConfirmScreen as BorrowConfirmScreenComponent,
  BorrowProcessingScreen as BorrowProcessingScreenComponent,
  BorrowSuccessScreen as BorrowSuccessScreenComponent,
} from '../screens/borrow';
import type { BorrowStackParamList } from './types';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyComponent = React.ComponentType<any>;

const BorrowInputScreen: AnyComponent = withErrorBoundary(BorrowInputScreenComponent, { boundaryName: 'BorrowInput', fallbackMessage: 'Unable to load borrow input. Please try again.' });
const BorrowConfirmScreen: AnyComponent = withErrorBoundary(BorrowConfirmScreenComponent, { boundaryName: 'BorrowConfirm', fallbackMessage: 'Unable to load borrow confirmation. Please try again.' });
const BorrowProcessingScreen: AnyComponent = withErrorBoundary(BorrowProcessingScreenComponent, { boundaryName: 'BorrowProcessing', fallbackMessage: 'Unable to load borrow processing. Please try again.' });
const BorrowSuccessScreen: AnyComponent = withErrorBoundary(BorrowSuccessScreenComponent, { boundaryName: 'BorrowSuccess', fallbackMessage: 'Unable to load borrow success. Please try again.' });

const Stack = createStackNavigator<BorrowStackParamList>();

export default function BorrowNavigator(): React.JSX.Element {
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
      <Stack.Screen name="BorrowInput" component={BorrowInputScreen} />
      <Stack.Screen name="BorrowConfirm" component={BorrowConfirmScreen} />
      <Stack.Screen name="BorrowProcessing" component={BorrowProcessingScreen} options={{ gestureEnabled: false }} />
      <Stack.Screen name="BorrowSuccess" component={BorrowSuccessScreen} options={{ gestureEnabled: false }} />
    </Stack.Navigator>
  );
}
