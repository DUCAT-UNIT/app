import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import VaultCard, { type VaultCardStyles } from '../VaultCard';

jest.mock('../../icons', () => {
  const React = require('react');
  const { Text } = require('react-native');

  return {
    __esModule: true,
    default: ({ name }: { name: string }) => React.createElement(Text, null, name),
  };
});

const styles: VaultCardStyles = {
  vaultCard: { flexDirection: 'row', alignItems: 'center' },
  vaultIconContainer: {},
  vaultStatusIndicator: {},
  vaultContentWrapper: { flex: 1 },
  vaultHeader: {},
  vaultHeaderLeft: {},
  assetInfo: {},
  vaultAssetName: {},
  assetValue: {},
  vaultDetailsContainer: {},
  vaultDetailRow: {},
  vaultLabel: {},
  vaultValueContainer: {},
  assetAmountIcon: {},
  assetAmount: {},
  vaultOverlay: {},
  emptyVaultContent: {},
  emptyVaultSubtitle: {},
  createVaultButton: {},
  createVaultButtonText: {},
};

describe('VaultCard', () => {
  it('renders the empty vault call to action in layout instead of an overlay', () => {
    const onCreateVault = jest.fn();
    const { getByTestId, getByText, queryByText, queryByTestId } = render(
      <VaultCard
        hasVault={false}
        vaultHealthColor="#888"
        vaultHealthPercentage={0}
        vaultDebt={0}
        vaultCollateral={0}
        onCreateVault={onCreateVault}
        creatingVault={false}
        styles={styles}
      />
    );

    expect(queryByTestId('vault-overlay')).toBeNull();
    expect(queryByText('Overall Debt')).toBeNull();
    expect(getByText('Vault', { includeHiddenElements: true })).toBeTruthy();
    expect(getByText('No active vault', { includeHiddenElements: true })).toBeTruthy();
    expect(getByTestId('create-vault-btn')).toBeTruthy();

    fireEvent.press(getByTestId('vault-card'));

    expect(onCreateVault).toHaveBeenCalledTimes(1);
  });
});
