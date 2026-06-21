import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import LiquidationEmptyStates from '../LiquidationEmptyStates';

jest.mock('../../icons', () => {
  const React = require('react');
  const { Text } = require('react-native');
  const MockIcon = ({ name }: { name: string }) => React.createElement(Text, null, name);
  return {
    __esModule: true,
    default: MockIcon,
  };
});

jest.mock('../../../hooks/useResponsive', () => ({
  useResponsive: () => ({ s: (value: number) => value }),
}));

describe('LiquidationEmptyStates', () => {
  it('does not show a wallet return action when no callback is provided', () => {
    const { queryByTestId } = render(<LiquidationEmptyStates variant="loading" />);

    expect(queryByTestId('liquidation-empty-back-btn')).toBeNull();
  });

  it('calls the wallet return action from an empty state', () => {
    const onBackToWallet = jest.fn();
    const { getByTestId } = render(
      <LiquidationEmptyStates variant="noVault" onBackToWallet={onBackToWallet} />
    );

    fireEvent.press(getByTestId('liquidation-empty-back-btn'));

    expect(onBackToWallet).toHaveBeenCalledTimes(1);
  });

  it('separates fee funding from vault collateral failures', () => {
    const { getByText } = render(<LiquidationEmptyStates variant="insufficientFunds" />);

    expect(getByText('Wallet BTC Too Low')).toBeTruthy();
  });

  it('shows a hard unavailable state for disabled liquidations', () => {
    const { getByText } = render(<LiquidationEmptyStates variant="unavailable" />);

    expect(getByText('Liquidations are not available.')).toBeTruthy();
  });
});
