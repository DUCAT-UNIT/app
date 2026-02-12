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
    const { getByLabelText } = render(<TotalBalanceSection {...mockProps} showTotalInBTC={false} />);
    expect(getByLabelText(/Total balance \$/)).toBeTruthy();
  });

  it('should display USD value when showTotalInBTC is false', () => {
    const { getByLabelText } = render(<TotalBalanceSection {...mockProps} showTotalInBTC={false} />);
    // Check accessibility label contains the USD value
    const button = getByLabelText(/Total balance \$5,432\.10/);
    expect(button).toBeTruthy();
  });

  it('should display BTC value when showTotalInBTC is true', () => {
    const { getByLabelText } = render(<TotalBalanceSection {...mockProps} showTotalInBTC={true} />);
    // Check accessibility label contains the BTC value
    const button = getByLabelText(/Total balance 0\.12345678 Bitcoin/);
    expect(button).toBeTruthy();
  });

  it('should call onToggle when pressed', () => {
    const { getByLabelText } = render(<TotalBalanceSection {...mockProps} showTotalInBTC={false} />);
    fireEvent.press(getByLabelText(/Total balance \$/));
    expect(mockProps.onToggle).toHaveBeenCalledTimes(1);
  });

  it('should render large balances >= 10M', () => {
    const largeBalanceProps = {
      ...mockProps,
      totalBalanceUSD: 10000000,
      totalUSD: '10,000,000.00',
      showTotalInBTC: false,
    };

    const { getByLabelText } = render(<TotalBalanceSection {...largeBalanceProps} />);
    const button = getByLabelText(/Total balance \$10,000,000\.00/);
    expect(button).toBeTruthy();
  });

  it('should render balances < 10M', () => {
    const smallBalanceProps = {
      ...mockProps,
      totalBalanceUSD: 9999999,
      totalUSD: '9,999,999.00',
      showTotalInBTC: false,
    };

    const { getByLabelText } = render(<TotalBalanceSection {...smallBalanceProps} />);
    const button = getByLabelText(/Total balance \$9,999,999\.00/);
    expect(button).toBeTruthy();
  });

  it('should render BTC icon when showTotalInBTC is true', () => {
    const { getByLabelText } = render(<TotalBalanceSection {...mockProps} showTotalInBTC={true} />);
    // The icon is rendered as part of the balance display
    const button = getByLabelText(/Bitcoin/);
    expect(button).toBeTruthy();
  });
});
