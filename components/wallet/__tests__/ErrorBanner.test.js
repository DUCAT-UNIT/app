/**
 * Tests for ErrorBanner component
 */

import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import ErrorBanner from '../ErrorBanner';

// Mock Icon component
jest.mock('../../icons', () => {
  const _React = require('react');
  const { Text } = require('react-native');
  return {
    __esModule: true,
    default: ({ name }) => _React.createElement(Text, { testID: `icon-${name}` }, name),
  };
});

describe('ErrorBanner', () => {
  const mockOnRetry = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render null when errorMessage is null', () => {
    const { queryByText } = render(<ErrorBanner errorMessage={null} onRetry={mockOnRetry} />);
    // Should not render any error message or warning icon
    expect(queryByText('warning')).toBeNull();
  });

  it('should render null when errorMessage is undefined', () => {
    const { queryByText } = render(<ErrorBanner errorMessage={undefined} onRetry={mockOnRetry} />);
    // Should not render any error message or warning icon
    expect(queryByText('warning')).toBeNull();
  });

  it('should render error banner when errorMessage is provided', () => {
    const { getByText } = render(
      <ErrorBanner errorMessage="Failed to fetch balance" onRetry={mockOnRetry} />
    );
    expect(getByText('Failed to fetch balance')).toBeTruthy();
  });

  it('should display the error message', () => {
    const errorMessage = 'Network connection failed';
    const { getByText } = render(<ErrorBanner errorMessage={errorMessage} onRetry={mockOnRetry} />);
    expect(getByText(errorMessage)).toBeTruthy();
  });

  it('should call onRetry when banner is pressed', () => {
    const { getByText } = render(
      <ErrorBanner errorMessage="Test error" onRetry={mockOnRetry} />
    );

    fireEvent.press(getByText('Test error'));
    expect(mockOnRetry).toHaveBeenCalledTimes(1);
  });

  it('should render warning icon', () => {
    const { getByText } = render(
      <ErrorBanner errorMessage="Test error" onRetry={mockOnRetry} />
    );
    // The icon mock renders the icon name as text
    expect(getByText('warning')).toBeTruthy();
  });
});
