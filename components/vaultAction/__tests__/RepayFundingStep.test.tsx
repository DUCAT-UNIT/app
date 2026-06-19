import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { RepayFundingStep } from '../RepayFundingStep';

jest.mock('@expo/vector-icons', () => {
  const React = require('react');
  const { Text } = require('react-native');

  return {
    Ionicons: ({ name }: { name: string }) => React.createElement(Text, null, name),
  };
});

jest.mock('../../common/TouchableScale', () => {
  const React = require('react');
  const { Pressable } = require('react-native');

  return {
    __esModule: true,
    default: ({ children, disabled, onPress, ...props }: any) =>
      React.createElement(
        Pressable,
        {
          ...props,
          disabled,
          onPress: disabled ? undefined : onPress,
        },
        children
      ),
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

jest.mock('react-native-safe-area-context', () => {
  const React = require('react');
  const { View } = require('react-native');

  return {
    SafeAreaView: ({ children, ...props }: { children: unknown }) =>
      React.createElement(View, props, children),
  };
});

const baseProps = {
  amountUsd: 1,
  value: 'UNIT' as const,
  balances: {
    UNIT: 5,
    TURBOUNIT: 1,
    USDC: 0,
  },
  onChange: jest.fn(),
  onBack: jest.fn(),
  onContinue: jest.fn(),
  testIDPrefix: 'vault-repay-funding',
  allowUsdc: false,
  allowTurboUnit: true,
};

describe('RepayFundingStep', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('exposes selected, enabled, and disabled funding card state ids', () => {
    const { getByTestId } = render(<RepayFundingStep {...baseProps} />);

    expect(getByTestId('vault-repay-funding-unit-card-selected')).toBeTruthy();
    expect(getByTestId('vault-repay-funding-turbounit-card-enabled')).toBeTruthy();
    expect(getByTestId('vault-repay-funding-usdc-card-disabled')).toBeTruthy();
  });

  it('does not select a disabled TurboUNIT funding card', () => {
    const onChange = jest.fn();
    const { getByTestId } = render(
      <RepayFundingStep
        {...baseProps}
        balances={{ UNIT: 5, TURBOUNIT: 0, USDC: 0 }}
        onChange={onChange}
      />
    );

    expect(getByTestId('vault-repay-funding-turbounit-card-disabled')).toBeTruthy();
    fireEvent.press(getByTestId('vault-repay-funding-turbounit-card'));

    expect(onChange).not.toHaveBeenCalledWith('TURBOUNIT');
  });
});
