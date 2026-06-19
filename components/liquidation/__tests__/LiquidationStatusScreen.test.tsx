import React from 'react';
import { render } from '@testing-library/react-native';
import LiquidationStatusScreen from '../LiquidationStatusScreen';

jest.mock('@expo/vector-icons', () => {
  const React = require('react');
  const { Text } = require('react-native');

  return {
    Ionicons: ({ name }: { name: string }) => React.createElement(Text, null, name),
  };
});

jest.mock('expo-clipboard', () => ({
  setStringAsync: jest.fn(),
}));

jest.mock('expo-haptics', () => ({
  notificationAsync: jest.fn(),
  impactAsync: jest.fn(),
  NotificationFeedbackType: { Success: 'success' },
  ImpactFeedbackStyle: { Light: 'light' },
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

jest.mock('../../../stores/notificationStore', () => ({
  useNotifications: () => ({ showToast: jest.fn() }),
}));

jest.mock('../../vaultCreation/ProcessingStepsList', () => {
  const React = require('react');
  const { Text } = require('react-native');

  return {
    ProcessingStepsList: () => React.createElement(Text, null, 'processing steps'),
  };
});

describe('LiquidationStatusScreen', () => {
  it('shows friendly stale opportunity copy instead of the raw spent UTXO error', () => {
    const { getByText, queryByText } = render(
      <LiquidationStatusScreen
        step="error"
        processingMessage=""
        txid={null}
        swapTxid={null}
        error="Validation of RepoVault failed: UTXO spent: abc is spent or not exist"
        isStaleOpportunity
        remainingVaultCount={3}
      />
    );

    expect(getByText('Opportunity Already Claimed')).toBeTruthy();
    expect(
      getByText(
        'Seems like someone got to this yield opportunity before you did. There are 3 other vaults still left to liquidate. Want to try again?'
      )
    ).toBeTruthy();
    expect(queryByText(/UTXO spent/)).toBeNull();
  });

  it('shows raw guardian Tx1 mismatch JSON as a liquidation failure', () => {
    const rawGuardianError =
      '{"code":null,"message":"Message: Repo Vault Tx1 ID in request does not match computed Repo Tx1ID Error: Custom(\\"Repo Vault Tx1ID d85cd3 in request does not match computed Repo vault Tx1ID aa885d\\")"}';

    const { getByText, queryByText } = render(
      <LiquidationStatusScreen
        step="error"
        processingMessage=""
        txid={null}
        swapTxid={null}
        error={rawGuardianError}
        remainingVaultCount={1}
      />
    );

    expect(getByText('Liquidation Failed')).toBeTruthy();
    expect(getByText(/Repo Vault Tx1 ID/)).toBeTruthy();
    expect(queryByText(/There is 1 other vault still left to liquidate/)).toBeNull();
  });
});
