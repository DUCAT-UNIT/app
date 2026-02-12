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
    const { getByLabelText } = render(<WalletHeader {...mockProps} />);
    expect(getByLabelText('Account 1 wallet')).toBeTruthy();
  });

  it('should display correct account number', () => {
    const { getByLabelText } = render(<WalletHeader {...mockProps} accountNumber={3} />);
    expect(getByLabelText('Account 3 wallet')).toBeTruthy();
  });

  it('should call onHistoryPress when history button is pressed', () => {
    const { getByLabelText } = render(<WalletHeader {...mockProps} />);
    fireEvent.press(getByLabelText('Transaction history'));
    expect(mockProps.onHistoryPress).toHaveBeenCalledTimes(1);
  });

  it('should call onSettingsPress when settings button is pressed', () => {
    const { getByLabelText } = render(<WalletHeader {...mockProps} />);
    fireEvent.press(getByLabelText('Settings'));
    expect(mockProps.onSettingsPress).toHaveBeenCalledTimes(1);
  });

  it('should render with different account numbers', () => {
    const { getByLabelText: getByLabel1 } = render(<WalletHeader {...mockProps} accountNumber={1} />);
    const { getByLabelText: getByLabel2 } = render(<WalletHeader {...mockProps} accountNumber={5} />);

    expect(getByLabel1('Account 1 wallet')).toBeTruthy();
    expect(getByLabel2('Account 5 wallet')).toBeTruthy();
  });
});
