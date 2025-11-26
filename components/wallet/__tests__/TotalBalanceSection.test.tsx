/**
 * Tests for TotalBalanceSection component
 */

import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import TotalBalanceSection from '../TotalBalanceSection';

// Mock Icon component
jest.mock('../../icons', () => {
  const _React = require('react');
  const { Text } = require('react-native');
  return {
    __esModule: true,
    default: ({ name }: { name: string }) => _React.createElement(Text, { testID: `icon-${name}` }, name),
  };
});

describe('TotalBalanceSection', () => {
  const mockProps = {
    showTotalInBTC: false,
    onToggle: jest.fn(),
    totalBTC: '0.12345678',
    totalUSD: '5,432.10',
    totalBalanceUSD: 5432.10,
    styles: {
      xverseBalanceSection: {},
      xverseBalanceLeft: {},
      xverseBalanceLabel: {},
      balanceWithIcon: {},
      balanceIcon: {},
      xverseBalanceAmount: {},
    },
    largeBalanceStyle: { fontSize: 32 },
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render without crashing', () => {
    const { getByText } = render(<TotalBalanceSection {...mockProps} />);
    expect(getByText('Total Balance USD')).toBeTruthy();
  });

  it('should display USD value when showTotalInBTC is false', () => {
    const { getByText } = render(<TotalBalanceSection {...mockProps} showTotalInBTC={false} />);
    expect(getByText('5,432.10', { exact: false })).toBeTruthy();
  });

  it('should display BTC value when showTotalInBTC is true', () => {
    const { getByText } = render(<TotalBalanceSection {...mockProps} showTotalInBTC={true} />);
    expect(getByText('0.12345678')).toBeTruthy();
  });

  it('should call onToggle when pressed', () => {
    const { getByText } = render(<TotalBalanceSection {...mockProps} />);
    fireEvent.press(getByText('5,432.10', { exact: false }));
    expect(mockProps.onToggle).toHaveBeenCalledTimes(1);
  });

  it('should render large balances >= 10M', () => {
    const largeBalanceProps = {
      ...mockProps,
      totalBalanceUSD: 10000000,
      totalUSD: '10,000,000.00',
      showTotalInBTC: false,
    };

    const { getByText } = render(<TotalBalanceSection {...largeBalanceProps} />);
    expect(getByText('10,000,000.00', { exact: false })).toBeTruthy();
  });

  it('should render balances < 10M', () => {
    const smallBalanceProps = {
      ...mockProps,
      totalBalanceUSD: 9999999,
      totalUSD: '9,999,999.00',
      showTotalInBTC: false,
    };

    const { getByText } = render(<TotalBalanceSection {...smallBalanceProps} />);
    expect(getByText('9,999,999.00', { exact: false })).toBeTruthy();
  });

  it('should render BTC icon when showTotalInBTC is true', () => {
    const { getByText } = render(<TotalBalanceSection {...mockProps} showTotalInBTC={true} />);
    // The icon mock renders the icon name as text
    expect(getByText('btc_symbol')).toBeTruthy();
  });
});
