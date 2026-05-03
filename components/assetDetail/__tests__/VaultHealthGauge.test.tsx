import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { VaultHealthGauge } from '../VaultHealthGauge';

jest.mock('react-native-svg', () => {
  const React = require('react');
  const { Text, View } = require('react-native');
  const SvgNode = ({ children, ...props }: { children?: React.ReactNode }) =>
    React.createElement(View, props, children);
  const SvgTextNode = ({ children, ...props }: { children?: React.ReactNode }) =>
    React.createElement(Text, props, children);
  return {
    __esModule: true,
    default: SvgNode,
    Svg: SvgNode,
    Path: SvgNode,
    G: SvgNode,
    Circle: SvgNode,
    Text: SvgTextNode,
    TSpan: SvgTextNode,
  };
});

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
  useResponsive: () => ({
    s: (value: number) => value,
    sf: (value: number) => value,
  }),
}));

const baseProps = {
  totalDebt: 50,
  totalCollateral: 0.05,
  currentPrice: 100_000,
  healthPercentage: 250,
  walletBtcBalance: 0.001,
  walletUnitBalance: 0,
};

describe('VaultHealthGauge repay action', () => {
  it('allows repay when TurboUNIT contributes to repayable balance', () => {
    const onRepayPress = jest.fn();
    const { getByTestId } = render(
      <VaultHealthGauge
        {...baseProps}
        walletRepayBalance={50}
        onRepayPress={onRepayPress}
      />,
    );

    fireEvent.press(getByTestId('vault-detail-repay-btn'));

    expect(onRepayPress).toHaveBeenCalledTimes(1);
  });
});
