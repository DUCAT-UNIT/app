/**
 * Tests for ErrorBoundary component
 */

import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { Text } from 'react-native';
import { logger } from '../../utils/logger';
import ErrorBoundary from '../ErrorBoundary';

/**
 * Global type extension for __DEV__ flag
 */
interface GlobalWithDev {
  __DEV__: boolean | undefined;
}

// Mock logger
jest.mock('../../utils/logger', () => ({
  logger: {
    error: jest.fn(),
  },
}));

// Mock COLORS theme
jest.mock('../../theme', () => ({
  COLORS: {
    BACKGROUND_PRIMARY: '#000000',
    VERY_LIGHT_GRAY: '#ffffff',
    SECONDARY_TEXT: '#888888',
    PRIMARY_BLUE: '#0066ff',
    CARD_BG: '#111111',
    DANGER_RED: '#ff0000',
  },
}));

// Component that throws an error
const ThrowError = ({ shouldThrow }: { shouldThrow: boolean }) => {
  if (shouldThrow) {
    throw new Error('Test error');
  }
  return <Text>Child component</Text>;
};

describe('ErrorBoundary', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Suppress console.error in tests
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    (console.error as jest.Mock).mockRestore();
  });

  it('should render children normally when there is no error', () => {
    const { getByText } = render(
      <ErrorBoundary>
        <Text>Child component</Text>
      </ErrorBoundary>
    );
    expect(getByText('Child component')).toBeTruthy();
  });

  it('should catch errors and display fallback UI', () => {
    const { getByText } = render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );

    expect(getByText('Something went wrong')).toBeTruthy();
    expect(getByText(/The app encountered an unexpected error/)).toBeTruthy();
    expect(getByText('Try Again')).toBeTruthy();
  });

  it('should display custom fallback message', () => {
    const customMessage = 'Custom error message for this screen';
    const { getByText } = render(
      <ErrorBoundary fallbackMessage={customMessage}>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );

    expect(getByText(customMessage)).toBeTruthy();
  });

  it('should log error to logger with component stack', () => {
    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );

    expect(logger.error).toHaveBeenCalledTimes(1);
    expect(logger.error).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({
        componentStack: expect.any(String),
        boundary: 'ErrorBoundary',
      })
    );
  });

  it('should include extra context in logger error', () => {
    const extraContext = { screen: 'WalletScreen', userId: '12345' };
    render(
      <ErrorBoundary extraContext={extraContext}>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );

    expect(logger.error).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({
        screen: 'WalletScreen',
        userId: '12345',
      })
    );
  });

  it('should call onReset callback when Try Again is pressed', () => {
    const mockOnReset = jest.fn();
    const { getByText } = render(
      <ErrorBoundary onReset={mockOnReset}>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );

    // Error UI should be visible
    expect(getByText('Something went wrong')).toBeTruthy();

    // Press Try Again button
    fireEvent.press(getByText('Try Again'));

    // onReset callback should be called
    expect(mockOnReset).toHaveBeenCalledTimes(1);
  });

  it('should display error emoji', () => {
    const { getByText } = render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );

    expect(getByText('⚠️')).toBeTruthy();
  });

  it('should use custom boundary name in logger', () => {
    const boundaryName = 'CustomBoundary';
    render(
      <ErrorBoundary boundaryName={boundaryName}>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );

    expect(logger.error).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({
        boundary: boundaryName,
      })
    );
  });

  it('should handle multiple errors sequentially', () => {
    const { rerender, getByText } = render(
      <ErrorBoundary>
        <ThrowError shouldThrow={false} />
      </ErrorBoundary>
    );

    // No error initially
    expect(getByText('Child component')).toBeTruthy();

    // Trigger first error
    rerender(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );

    expect(getByText('Something went wrong')).toBeTruthy();
    expect(logger.error).toHaveBeenCalledTimes(1);

    // Reset
    fireEvent.press(getByText('Try Again'));

    // Trigger second error (by re-rendering with error again)
    rerender(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );

    expect(logger.error).toHaveBeenCalledTimes(2);
  });

  it('should not display error details in production', () => {
    // Test runs in non-DEV mode by default due to jest setup
    const globalWithDev = global as unknown as GlobalWithDev;
    const originalDev = globalWithDev.__DEV__;
    globalWithDev.__DEV__ = false;

    const { queryByText } = render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );

    // Error details should not be visible
    expect(queryByText('Error Details (Dev Only):')).toBeFalsy();

    globalWithDev.__DEV__ = originalDev;
  });

  it('should display error details in development', () => {
    const globalWithDev = global as unknown as GlobalWithDev;
    const originalDev = globalWithDev.__DEV__;
    globalWithDev.__DEV__ = true;

    const { getByText } = render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );

    // Error details should be visible
    expect(getByText('Error Details (Dev Only):')).toBeTruthy();
    expect(getByText(/Test error/)).toBeTruthy();

    globalWithDev.__DEV__ = originalDev;
  });
});
