import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import VaultSelectorTable from '../VaultSelectorTable';
import type { LiqVaultDisplay } from '../../../services/liquidation/types';

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

const makeVault = (index: number): LiqVaultDisplay => ({
  vaultId: `vault-${index}`,
  unit: 100 + index,
  btcInVault: 0.02 + index * 0.001,
  claimAmountBtc: 0.01,
  profitBtc: 0.001,
  profitPercent: 10,
  postTaxBtcInVault: 0.011,
  unitSwapBtc: 0.001,
});

describe('VaultSelectorTable', () => {
  it('renders selected vault rows in a bounded nested scroll list', () => {
    const vaults = Array.from({ length: 12 }, (_, index) => makeVault(index));
    const { getByTestId } = render(
      <VaultSelectorTable
        vaults={vaults}
        investAmount={0.12}
        btcPrice={100000}
        showBTC
        expanded
        onExpandToggle={jest.fn()}
        vaultsLoaded
        selectedCount={12}
      />
    );

    const rowList = getByTestId('liq-vault-row-list');

    expect(rowList.props.nestedScrollEnabled).toBe(true);
    expect(rowList.props.showsVerticalScrollIndicator).toBe(true);
    expect(getByTestId('liq-vault-row-vault-11')).toBeTruthy();
  });

  it('only toggles expansion from the selector header', () => {
    const onExpandToggle = jest.fn();
    const { getByTestId } = render(
      <VaultSelectorTable
        vaults={[makeVault(0), makeVault(1)]}
        investAmount={0.02}
        btcPrice={100000}
        showBTC={false}
        expanded
        onExpandToggle={onExpandToggle}
        vaultsLoaded
        selectedCount={2}
      />
    );

    expect(getByTestId('liq-vault-row-vault-0').props.onPress).toBeUndefined();

    fireEvent.press(getByTestId('liq-vault-selector'));

    expect(onExpandToggle).toHaveBeenCalledTimes(1);
  });
});
