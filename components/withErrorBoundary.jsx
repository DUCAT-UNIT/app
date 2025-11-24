/**
 * Higher-Order Component (HOC) to wrap screens with ErrorBoundary
 * Provides consistent error handling across all screens with custom messages
 */

import React from 'react';
import ErrorBoundary from './ErrorBoundary';

/**
 * Wraps a component with an ErrorBoundary
 * @param {React.Component} WrappedComponent - Component to wrap
 * @param {Object} options - Configuration options
 * @param {string} options.boundaryName - Name for identifying boundary in logs
 * @param {string} options.fallbackMessage - Custom error message
 * @param {Function} options.onReset - Optional reset callback
 * @param {Object} options.extraContext - Additional context for Sentry
 */
export const withErrorBoundary = (WrappedComponent, options = {}) => {
  const {
    boundaryName = WrappedComponent.displayName || WrappedComponent.name || 'Screen',
    fallbackMessage,
    onReset,
    extraContext,
  } = options;

  // Return a new component that wraps the original with ErrorBoundary
  const ComponentWithErrorBoundary = (props) => (
    <ErrorBoundary
      boundaryName={boundaryName}
      fallbackMessage={fallbackMessage}
      onReset={onReset}
      extraContext={extraContext}
    >
      <WrappedComponent {...props} />
    </ErrorBoundary>
  );

  // Set display name for debugging
  ComponentWithErrorBoundary.displayName = `withErrorBoundary(${boundaryName})`;

  return ComponentWithErrorBoundary;
};

export default withErrorBoundary;
