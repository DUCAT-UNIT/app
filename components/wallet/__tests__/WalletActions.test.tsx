import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import WalletActions from '../WalletActions';

jest.mock('@expo/vector-icons', () => {
  const React = require('react');
  const { Text } = require('react-native');

  return {
    Ionicons: ({ name }: { name: string }) => React.createElement(Text, null, name),
  };
});

jest.mock('../../../hooks/useResponsive', () => ({
  useResponsive: () => ({
    s: (value: number) => value,
    sf: (value: number) => value,
  }),
}));

const baseProps = {
  isPendingVaultTx: false,
  isLowHealth: false,
  hasNoDebt: false,
  hasVault: true,
  hasVaultCollateral: true,
  onRepayPress: jest.fn(),
  onBorrowPress: jest.fn(),
  onWithdrawPress: jest.fn(),
  onDepositPress: jest.fn(),
  onSendPress: jest.fn(),
  onReceivePress: jest.fn(),
};

describe('WalletActions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('allows borrowing from a collateralized vault with no debt', () => {
    const onBorrowPress = jest.fn();
    const { getByTestId } = render(
      <WalletActions {...baseProps} hasNoDebt onBorrowPress={onBorrowPress} />
    );

    fireEvent.press(getByTestId('wallet-borrow-btn'));

    expect(onBorrowPress).toHaveBeenCalledTimes(1);
    expect(getByTestId('wallet-borrow-btn').props.accessibilityState).toEqual({
      disabled: false,
    });
  });

  it('keeps borrowing disabled when there is no vault collateral', () => {
    const { getByTestId } = render(<WalletActions {...baseProps} hasVaultCollateral={false} />);

    expect(getByTestId('wallet-borrow-btn-disabled').props.accessibilityState).toEqual({
      disabled: true,
    });
  });

  it('routes send and receive through separate wallet buttons', () => {
    const onSendPress = jest.fn();
    const onReceivePress = jest.fn();
    const { getByTestId } = render(
      <WalletActions {...baseProps} onSendPress={onSendPress} onReceivePress={onReceivePress} />
    );

    fireEvent.press(getByTestId('wallet-send-btn'));
    fireEvent.press(getByTestId('wallet-receive-btn'));

    expect(onSendPress).toHaveBeenCalledTimes(1);
    expect(onReceivePress).toHaveBeenCalledTimes(1);
  });

  it('routes withdraw and deposit through vault buttons', () => {
    const onWithdrawPress = jest.fn();
    const onDepositPress = jest.fn();
    const { getByTestId } = render(
      <WalletActions
        {...baseProps}
        onWithdrawPress={onWithdrawPress}
        onDepositPress={onDepositPress}
      />
    );

    fireEvent.press(getByTestId('wallet-withdraw-btn'));
    fireEvent.press(getByTestId('wallet-deposit-btn'));

    expect(onWithdrawPress).toHaveBeenCalledTimes(1);
    expect(onDepositPress).toHaveBeenCalledTimes(1);
  });
});
