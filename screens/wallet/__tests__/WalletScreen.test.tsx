import React from 'react';
import { render } from '@testing-library/react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useAirdrop } from '../../../contexts/AirdropContext';
import { useCashu } from '../../../contexts/CashuContext';
import { useSettingsHandlers } from '../../../contexts/NavigationHandlersContext';
import { useWallet } from '../../../contexts/WalletContext';
import { useBalance, useEvmAssets, useVaultData } from '../../../contexts/WalletDataContext';
import { useAssetCardStyles } from '../../../hooks/useAssetCardStyles';
import { useFormattedBalances } from '../../../hooks/useFormattedBalances';
import { useResponsive } from '../../../hooks/useResponsive';
import { useTotalBalanceStyles } from '../../../hooks/useTotalBalanceStyles';
import { useVaultCardStyles } from '../../../hooks/useVaultCardStyles';
import { useWalletCalculations } from '../../../hooks/useWalletCalculations';
import { useDisplayPreferences } from '../../../stores/displayPreferencesStore';
import { usePendingTxs } from '../../../stores/pendingTransactionsStore';
import { usePrice } from '../../../stores/priceStore';
import WalletScreen from '../WalletScreen';

jest.mock('@react-navigation/native', () => ({
  useFocusEffect: jest.fn(),
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

jest.mock('../../../components/liquidation/LiquidationScreen', () => {
  const React = require('react');
  const { Text } = require('react-native');
  const MockLiquidationScreen = () => React.createElement(Text, null, 'Liquidations');
  return {
    __esModule: true,
    default: MockLiquidationScreen,
  };
});

jest.mock('../../../components/wallet/AssetCard', () => {
  const React = require('react');
  const { Text } = require('react-native');
  const MockAssetCard = ({ assetName, testID }: { assetName: string; testID?: string }) =>
    React.createElement(Text, { testID }, assetName);
  return {
    __esModule: true,
    default: MockAssetCard,
  };
});

jest.mock('../../../components/wallet/ErrorBanner', () => {
  const MockErrorBanner = () => null;
  return {
    __esModule: true,
    default: MockErrorBanner,
  };
});

jest.mock('../../../components/wallet/TotalBalanceSection', () => {
  const React = require('react');
  const { Text } = require('react-native');
  const MockTotalBalanceSection = () => React.createElement(Text, null, 'Total');
  return {
    __esModule: true,
    default: MockTotalBalanceSection,
  };
});

jest.mock('../../../components/wallet/VaultCard', () => {
  const React = require('react');
  const { Text } = require('react-native');
  const MockVaultCard = () => React.createElement(Text, null, 'Vault');
  return {
    __esModule: true,
    default: MockVaultCard,
  };
});

jest.mock('../../../components/wallet/WalletActions', () => {
  const React = require('react');
  const { Text } = require('react-native');
  const MockWalletActions = () => React.createElement(Text, null, 'Actions');
  return {
    __esModule: true,
    default: MockWalletActions,
  };
});

jest.mock('../../../components/wallet/WalletHeader', () => {
  const React = require('react');
  const { Text } = require('react-native');
  const MockWalletHeader = () => React.createElement(Text, null, 'Header');
  return {
    __esModule: true,
    default: MockWalletHeader,
  };
});

jest.mock('../../../contexts/CashuContext', () => ({
  useCashu: jest.fn(),
}));

jest.mock('../../../contexts/AirdropContext', () => ({
  useAirdrop: jest.fn(),
}));

jest.mock('../../../contexts/NavigationHandlersContext', () => ({
  useSettingsHandlers: jest.fn(),
}));

jest.mock('../../../contexts/WalletContext', () => ({
  useWallet: jest.fn(),
}));

jest.mock('../../../contexts/WalletDataContext', () => ({
  useBalance: jest.fn(),
  useEvmAssets: jest.fn(),
  useVaultData: jest.fn(),
}));

jest.mock('../../../hooks/useAssetCardStyles', () => ({
  useAssetCardStyles: jest.fn(),
}));

jest.mock('../../../hooks/useFormattedBalances', () => ({
  useFormattedBalances: jest.fn(),
}));

jest.mock('../../../hooks/useResponsive', () => ({
  useResponsive: jest.fn(),
}));

jest.mock('../../../hooks/useTotalBalanceStyles', () => ({
  useTotalBalanceStyles: jest.fn(),
}));

jest.mock('../../../hooks/useVaultCardStyles', () => ({
  useVaultCardStyles: jest.fn(),
}));

jest.mock('../../../hooks/useWalletCalculations', () => ({
  useWalletCalculations: jest.fn(),
}));

jest.mock('../../../stores/displayPreferencesStore', () => ({
  useDisplayPreferences: jest.fn(),
}));

jest.mock('../../../stores/pendingTransactionsStore', () => ({
  usePendingTxs: jest.fn(),
}));

jest.mock('../../../stores/priceStore', () => ({
  usePrice: jest.fn(),
}));

jest.mock('../../../utils/runesHelper', () => ({
  getRunesAmount: jest.fn(() => 0),
}));

const baseProps = {
  styles: {
    walletContainer: {},
    balanceDivider: {},
    assetsScrollContainer: {},
    assetsScrollContent: {},
    switchingOverlay: {},
    switchingText: {},
  },
  onSendPress: jest.fn(),
  onReceivePress: jest.fn(),
  onHistoryPress: jest.fn(),
  onQRScanPress: jest.fn(),
  onSettingsPress: jest.fn(),
  onCreateVaultPress: jest.fn(),
  onVaultPress: jest.fn(),
  onRepayPress: jest.fn(),
  onBorrowPress: jest.fn(),
  onWithdrawPress: jest.fn(),
  onDepositPress: jest.fn(),
  onAssetPress: jest.fn(),
  showZeroAssets: false,
};

describe('WalletScreen Sepolia asset cards', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useFocusEffect as jest.Mock).mockImplementation((callback: () => void) => callback());
    (useWallet as jest.Mock).mockReturnValue({
      wallet: { taprootAddress: 'tb1pwallet' },
      currentAccount: 0,
    });
    (useBalance as jest.Mock).mockReturnValue({
      segwitBalance: 0,
      taprootBalance: 0,
      runesBalance: [],
      balanceError: null,
      setBalanceError: jest.fn(),
      fetchBalance: jest.fn(),
    });
    (useEvmAssets as jest.Mock).mockReturnValue({
      evmBalances: null,
      loadingEvmBalances: false,
      isSepoliaConfigured: false,
      refreshEvmBalances: jest.fn(),
    });
    (usePrice as jest.Mock).mockReturnValue({ btcPrice: 100_000, ethPrice: 3_000 });
    (useVaultData as jest.Mock).mockReturnValue({ vaultData: null });
    (useCashu as jest.Mock).mockReturnValue({ balance: 0, refresh: jest.fn() });
    (useAirdrop as jest.Mock).mockReturnValue({
      airdropPending: false,
      showAirdropModal: false,
      openAirdropModal: jest.fn(),
    });
    (useSettingsHandlers as jest.Mock).mockReturnValue({
      settingsHandlers: {
        usdcFeaturesEnabled: false,
      },
    });
    (useDisplayPreferences as jest.Mock).mockReturnValue({
      showTotalInBTC: false,
      setShowTotalInBTC: jest.fn(),
    });
    (usePendingTxs as jest.Mock).mockReturnValue({});
    (useWalletCalculations as jest.Mock).mockReturnValue({
      totalBalanceBTC: 0,
      totalBalanceUSD: 0,
      vaultHealthColor: '#fff',
      vaultHealthPercentage: 0,
      vaultDebt: 0,
      vaultCollateral: 0,
      hasVault: false,
    });
    (useResponsive as jest.Mock).mockReturnValue({
      s: (value: number) => value,
    });
    (useAssetCardStyles as jest.Mock).mockReturnValue({});
    (useVaultCardStyles as jest.Mock).mockReturnValue({});
    (useTotalBalanceStyles as jest.Mock).mockReturnValue({
      styles: {},
      largeBalanceStyle: {},
    });
    (useFormattedBalances as jest.Mock).mockReturnValue({
      totalBTC: '0',
      totalUSD: '$0.00',
      segwitBTC: '0',
      segwitUSD: '0.00',
    });
  });

  it('hides Sepolia ETH and USDC while the developer flag is disabled', () => {
    const { queryByTestId } = render(
      <WalletScreen {...(baseProps as unknown as React.ComponentProps<typeof WalletScreen>)} />
    );

    expect(queryByTestId('asset-card-eth')).toBeNull();
    expect(queryByTestId('asset-card-usdc')).toBeNull();
  });

  it('shows Sepolia ETH and USDC when the developer flag is enabled', () => {
    (useSettingsHandlers as jest.Mock).mockReturnValue({
      settingsHandlers: {
        usdcFeaturesEnabled: true,
      },
    });

    const { getByTestId } = render(
      <WalletScreen {...(baseProps as unknown as React.ComponentProps<typeof WalletScreen>)} />
    );

    expect(getByTestId('asset-card-eth')).toBeTruthy();
    expect(getByTestId('asset-card-usdc')).toBeTruthy();
  });
});
