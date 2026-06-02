import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import VaultInputScreen from '../VaultInputScreen';

const mockHandleClose = jest.fn();
const mockHandleContinue = jest.fn();

jest.mock('@expo/vector-icons', () => {
  const React = require('react');
  const { Text } = require('react-native');

  return {
    Ionicons: ({ name }: { name: string }) => React.createElement(Text, null, name),
  };
});

jest.mock('react-native-safe-area-context', () => {
  const React = require('react');
  const { View } = require('react-native');

  return {
    SafeAreaView: ({ children, ...props }: { children: unknown }) =>
      React.createElement(View, props, children),
    useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
  };
});

jest.mock('../../../components/common/FeeRateSelectorCompact', () => {
  const React = require('react');
  const { View } = require('react-native');

  return {
    FeeRateDropdown: () => React.createElement(View, { testID: 'fee-rate-dropdown' }),
  };
});

jest.mock('../../../components/common/TouchableScale', () => {
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

jest.mock('../../../components/vaultAction', () => {
  const React = require('react');
  const { View } = require('react-native');

  return {
    AmountSlider: () => React.createElement(View, { testID: 'amount-slider' }),
    VaultActionGauge: () => React.createElement(View, { testID: 'vault-action-gauge' }),
    VaultChangesCard: () => React.createElement(View, { testID: 'vault-changes-card' }),
  };
});

jest.mock('../../../components/vaultAction/UnitAmountSlider', () => {
  const React = require('react');
  const { View } = require('react-native');

  return {
    UnitAmountSlider: () => React.createElement(View, { testID: 'unit-amount-slider' }),
  };
});

jest.mock('../hooks', () => ({
  useVaultInputScreen: () => ({
    effectiveBtcLocked: 0.1,
    effectiveUnitBorrowed: 10,
    isInitializing: false,
    isContinuing: false,
    btcPrice: 100000,
    amountConfig: {
      isUnitAmount: false,
      value: 0.01,
      maxValue: 0.1,
      setValue: jest.fn(),
      label: 'BTC to Deposit',
      displayUnitLabel: 'BTC',
      hideAvailable: false,
    },
    currentHealth: 250,
    currentLiqPrice: 60000,
    preview: {
      newCollateral: 0.11,
      newDebt: 10,
      newHealth: 300,
      newLiqPrice: 55000,
    },
    hasChanges: true,
    selectedFeeRate: 1,
    setSelectedFeeRate: jest.fn(),
    estimatedFeeSats: 325,
    validation: { canContinue: true, errors: [], warnings: [] },
    emptyState: null,
    handleClose: mockHandleClose,
    handleContinue: mockHandleContinue,
    handleLiveValueChange: jest.fn(),
    sliderColor: '#59aa8a',
  }),
}));

const config = {
  operationType: 'deposit',
  title: 'Deposit',
  changesActionType: 'collateral',
};

const store = {
  currentUnitBorrowed: 10,
  currentBtcLocked: 0.1,
  bitcoinPrice: 100000,
  selectedFeeRate: 1,
  currentStep: 'input',
  processingStep: 0,
  loading: false,
  error: 'HTTP 400: undefined',
  vaultTxid: null,
  healthFactor: 250,
  newHealthFactor: 300,
  liquidationPrice: 60000,
  newLiquidationPrice: 55000,
  healthStatus: 'healthy',
  newHealthStatus: 'healthy',
  setSelectedFeeRate: jest.fn(),
  setCurrentStep: jest.fn(),
  setProcessingStep: jest.fn(),
  reset: jest.fn(),
};

describe('VaultInputScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('keeps a footer cancel action available when the vault operation has errored', () => {
    const { getByTestId, getByLabelText } = render(
      <VaultInputScreen
        navigation={{} as never}
        config={config as never}
        store={store as never}
        loadVaultData={jest.fn()}
      />
    );

    expect(getByLabelText('Error: HTTP 400: undefined')).toBeTruthy();
    expect(getByTestId('vault-deposit-continue-btn')).toBeTruthy();

    fireEvent.press(getByTestId('vault-deposit-cancel-btn'));

    expect(mockHandleClose).toHaveBeenCalledTimes(1);
    expect(mockHandleContinue).not.toHaveBeenCalled();
  });
});
