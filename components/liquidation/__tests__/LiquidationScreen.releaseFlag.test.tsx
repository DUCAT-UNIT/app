import React from 'react';
import { render } from '@testing-library/react-native';
import LiquidationScreen, { type LiquidationScreenProps } from '../LiquidationScreen';

const mockUseLiquidationVaults = jest.fn();
const mockUseLiquidationExecution = jest.fn();

jest.mock('../../../utils/releaseFlags', () => ({
  ENABLE_LIQUIDATIONS: false,
  LIQUIDATIONS_UNAVAILABLE_MESSAGE: 'Liquidations are not available.',
}));

jest.mock('../../../hooks/liquidation/useLiquidationVaults', () => ({
  useLiquidationVaults: mockUseLiquidationVaults,
}));

jest.mock('../../../hooks/liquidation/useLiquidationExecution', () => ({
  useLiquidationExecution: mockUseLiquidationExecution,
}));

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

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));

jest.mock('../CurrencyToggle', () => () => null);
jest.mock('../LiquidationInputScreen', () => () => null);
jest.mock('../LiquidationReviewScreen', () => () => null);
jest.mock('../LiquidationStatusScreen', () => () => null);
jest.mock('../../MutinynetBanner', () => () => null);
jest.mock('../../common/OperationRecoveryCard', () => () => null);

const baseProps: LiquidationScreenProps = {
  btcPrice: null,
  segwitBalance: 0,
  taprootBalance: 0,
  vaultCollateral: 0,
  vaultDebt: 0,
  hasVault: false,
  wallet: null,
  vaultData: null,
  currentAccount: 0,
  visible: true,
  onClose: jest.fn(),
  onToggle: jest.fn(),
};

describe('LiquidationScreen release flag', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('shows unavailable copy and does not mount liquidation hooks', () => {
    const { getByText } = render(<LiquidationScreen {...baseProps} />);

    expect(getByText('Liquidations are not available.')).toBeTruthy();
    expect(mockUseLiquidationVaults).not.toHaveBeenCalled();
    expect(mockUseLiquidationExecution).not.toHaveBeenCalled();
  });
});
