/**
 * NavigationErrorBoundary - ErrorBoundary wrapper for transaction flow navigators
 * Provides navigation-aware reset behavior: navigates back when the user taps "Try Again"
 */

import React, { useCallback } from 'react';
import { useNavigation } from '@react-navigation/native';
import ErrorBoundary from './ErrorBoundary';
import { logger } from '../utils/logger';

interface NavigationErrorBoundaryProps {
  children: React.ReactNode;
  boundaryName: string;
  fallbackMessage?: string;
}

/**
 * Thin wrapper around ErrorBoundary that provides navigation-aware onReset.
 * When the user taps "Try Again", the error state is cleared and navigation
 * goes back to dismiss the broken flow, returning the user to a safe screen.
 */
export default function NavigationErrorBoundary({
  children,
  boundaryName,
  fallbackMessage,
}: NavigationErrorBoundaryProps): React.JSX.Element {
  const navigation = useNavigation();

  const handleReset = useCallback(() => {
    logger.warn(`[${boundaryName}] Error boundary reset — navigating back`);
    if (navigation.canGoBack()) {
      navigation.goBack();
    }
  }, [boundaryName, navigation]);

  return (
    <ErrorBoundary
      boundaryName={boundaryName}
      fallbackMessage={
        fallbackMessage || 'Something went wrong with this transaction. Please try again.'
      }
      onReset={handleReset}
    >
      {children}
    </ErrorBoundary>
  );
}
