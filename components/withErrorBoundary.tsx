/**
 * Higher-Order Component (HOC) to wrap screens with ErrorBoundary
 * Provides consistent error handling across all screens with custom messages
 */

import React from 'react';
import ErrorBoundary from './ErrorBoundary';

interface WithErrorBoundaryOptions {
  boundaryName?: string;
  fallbackMessage?: string;
  onReset?: () => void;
  extraContext?: Record<string, unknown>;
}

/**
 * Wraps a component with an ErrorBoundary
 */
export const withErrorBoundary = <P extends object>(
  WrappedComponent: React.ComponentType<P>,
  options: WithErrorBoundaryOptions = {}
) => {
  const {
    boundaryName = WrappedComponent.displayName || WrappedComponent.name || 'Screen',
    fallbackMessage,
    onReset,
    extraContext,
  } = options;

  // Return a new component that wraps the original with ErrorBoundary
  const ComponentWithErrorBoundary = (props: P) => (
    <ErrorBoundary
      boundaryName={boundaryName}
      fallbackMessage={fallbackMessage}
      onReset={onReset}
      extraContext={extraContext}
    >
      <WrappedComponent {...props} />
    </ErrorBoundary>
  );

  // Preserve a useful component name in React DevTools and error reports.
  ComponentWithErrorBoundary.displayName = `withErrorBoundary(${boundaryName})`;

  return ComponentWithErrorBoundary;
};
