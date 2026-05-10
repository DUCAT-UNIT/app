import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import WalletActions from '../WalletActions';

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
  hasVaultCollateral: true,
  onRepayPress: jest.fn(),
  onBorrowPress: jest.fn(),
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

    expect(getByTestId('wallet-borrow-btn').props.accessibilityState).toEqual({
      disabled: true,
    });
  });
});
