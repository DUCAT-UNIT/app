import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import LiquidationFlowScreen from '../LiquidationFlowScreen';
import LiquidationsTabScreen from '../LiquidationsTabScreen';

const mockNavigate = jest.fn();

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({
    navigate: mockNavigate,
  }),
}));

jest.mock('../../../components/icons', () => {
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

describe('disabled liquidation screens', () => {
  beforeEach(() => {
    mockNavigate.mockClear();
  });

  it('shows liquidations unavailable on the tab screen', () => {
    const { getByText } = render(<LiquidationsTabScreen />);

    expect(getByText('Liquidations are not available.')).toBeTruthy();
  });

  it('shows liquidations unavailable on the direct flow screen', () => {
    const { getByText } = render(<LiquidationFlowScreen />);

    expect(getByText('Liquidations are not available.')).toBeTruthy();
  });

  it('returns to the wallet from the disabled tab screen', () => {
    const { getByTestId } = render(<LiquidationsTabScreen />);

    fireEvent.press(getByTestId('liquidation-empty-back-btn'));

    expect(mockNavigate).toHaveBeenCalledWith({ name: 'WalletTab', params: undefined });
  });
});
