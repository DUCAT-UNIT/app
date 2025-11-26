/**
 * Tests for WalletHeader component
 */

import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import WalletHeader from '../WalletHeader';

// Mock Icon component
jest.mock('../../icons', () => {
  const _React = require('react');
  const { Text } = require('react-native');
  return {
    __esModule: true,
    default: ({ name }: { name: string }) => _React.createElement(Text, { testID: `icon-${name}` }, name),
  };
});

describe('WalletHeader', () => {
  const mockProps = {
    accountNumber: 1,
    onHistoryPress: jest.fn(),
    onQRScanPress: jest.fn(),
    onSettingsPress: jest.fn(),
    styles: {
      xverseHeader: {},
      xverseHeaderLeft: {},
      xverseAccountName: {},
      xverseHeaderRight: {},
      headerIconButton: {},
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render without crashing', () => {
    const { getByText } = render(<WalletHeader {...mockProps} />);
    expect(getByText('Account 1')).toBeTruthy();
  });

  it('should display correct account number', () => {
    const { getByText } = render(<WalletHeader {...mockProps} accountNumber={3} />);
    expect(getByText('Account 3')).toBeTruthy();
  });

  it('should call onHistoryPress when history button is pressed', () => {
    const { getByText } = render(<WalletHeader {...mockProps} />);
    // The icon mock renders the icon name as text
    fireEvent.press(getByText('transaction_history'));
    expect(mockProps.onHistoryPress).toHaveBeenCalledTimes(1);
  });

  it('should call onSettingsPress when settings button is pressed', () => {
    const { getByText } = render(<WalletHeader {...mockProps} />);
    // The icon mock renders the icon name as text
    fireEvent.press(getByText('settings'));
    expect(mockProps.onSettingsPress).toHaveBeenCalledTimes(1);
  });

  it('should render with different account numbers', () => {
    const { getByText: getByText1 } = render(<WalletHeader {...mockProps} accountNumber={1} />);
    const { getByText: getByText2 } = render(<WalletHeader {...mockProps} accountNumber={5} />);

    expect(getByText1('Account 1')).toBeTruthy();
    expect(getByText2('Account 5')).toBeTruthy();
  });
});
