import React from 'react';
import { act, create } from 'react-test-renderer';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { VaultProvider, useVaultData } from '../VaultContext';
import { useVaultDataFetch } from '../../hooks/useVaultDataFetch';
import { usePendingVaultTransactionStore } from '../../stores/pendingVaultTransactionStore';
import { useNotificationStore } from '../../stores/notificationStore';
import { useSendFlowStore } from '../../stores/sendFlowStore';
import { sendLocalNotification } from '../../services/pushNotificationService';
import { getNotificationsEnabled } from '../../services/settingsService';
import { analytics } from '../../services/analyticsService';
import { isE2E } from '../../utils/e2e';

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
}));

jest.mock('../../hooks/useVaultDataFetch', () => ({
  useVaultDataFetch: jest.fn(),
}));

jest.mock('../WalletContext', () => ({
  useWallet: jest.fn(() => ({
    wallet: { taprootAddress: 'tb1pvault' },
  })),
}));

jest.mock('../AuthContext', () => ({
  useAuthSession: jest.fn(() => ({
    isAuthenticated: true,
  })),
}));

const mockPendingVaultStore = {
  pendingTransaction: null as null | {
    txid: string;
    vaultTxid?: string;
    action: string;
  },
  clearPendingTransaction: jest.fn(),
};

jest.mock('../../stores/pendingVaultTransactionStore', () => {
  const usePendingVaultTransactionStore = jest.fn((selector) => selector(mockPendingVaultStore)) as jest.Mock & {
    getState: jest.Mock;
  };
  usePendingVaultTransactionStore.getState = jest.fn(() => mockPendingVaultStore);
  return { usePendingVaultTransactionStore };
});

const mockNotificationStore = {
  snackbar: null as null | { type: string },
  showSnackbar: jest.fn(),
};

jest.mock('../../stores/notificationStore', () => ({
  useNotificationStore: {
    getState: jest.fn(() => mockNotificationStore),
  },
}));

const mockSendFlowStore = {
  intentStep: 'idle',
};

jest.mock('../../stores/sendFlowStore', () => ({
  useSendFlowStore: {
    getState: jest.fn(() => mockSendFlowStore),
  },
}));

jest.mock('../../services/pushNotificationService', () => ({
  sendLocalNotification: jest.fn(),
}));

jest.mock('../../services/settingsService', () => ({
  getNotificationsEnabled: jest.fn(),
}));

jest.mock('../../services/analyticsService', () => ({
  analytics: {
    track: jest.fn(),
  },
}));

jest.mock('../../utils/e2e', () => ({
  isE2E: jest.fn(),
}));

jest.mock('../../utils/logger', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

const mockUseVaultDataFetch = useVaultDataFetch as jest.MockedFunction<typeof useVaultDataFetch>;
const mockUsePendingVaultTransactionStore = usePendingVaultTransactionStore as unknown as jest.Mock & {
  getState: jest.Mock;
};
const mockUseNotificationStore = useNotificationStore as unknown as { getState: jest.Mock };
const mockUseSendFlowStore = useSendFlowStore as unknown as { getState: jest.Mock };
const mockSendLocalNotification = sendLocalNotification as jest.MockedFunction<typeof sendLocalNotification>;
const mockGetNotificationsEnabled = getNotificationsEnabled as jest.MockedFunction<typeof getNotificationsEnabled>;
const mockAnalyticsTrack = analytics.track as jest.Mock;
const mockIsE2E = isE2E as jest.MockedFunction<typeof isE2E>;
const mockAsyncStorageGetItem = AsyncStorage.getItem as jest.MockedFunction<typeof AsyncStorage.getItem>;
const mockAsyncStorageSetItem = AsyncStorage.setItem as jest.MockedFunction<typeof AsyncStorage.setItem>;

function makeVault(overrides: Partial<ReturnType<typeof useVaultDataFetch>> = {}): ReturnType<typeof useVaultDataFetch> {
  return {
    vaultData: null,
    vaultTransactions: [],
    vaultSummary: null,
    isLoading: false,
    isRefreshing: false,
    error: null,
    fetchVaultData: jest.fn(),
    refreshVaultData: jest.fn(),
    clearVaultData: jest.fn(),
    ...overrides,
  } as ReturnType<typeof useVaultDataFetch>;
}

function Consumer({ onValue }: { onValue: (value: ReturnType<typeof useVaultData>) => void }) {
  onValue(useVaultData());
  return null;
}

async function flushEffects() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

describe('VaultContext', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Date, 'now').mockReturnValue(1_700_000_000_000);
    mockPendingVaultStore.pendingTransaction = null;
    mockPendingVaultStore.clearPendingTransaction = jest.fn();
    mockNotificationStore.snackbar = null;
    mockNotificationStore.showSnackbar = jest.fn();
    mockSendFlowStore.intentStep = 'idle';
    mockUsePendingVaultTransactionStore.mockImplementation((selector) => selector(mockPendingVaultStore));
    mockUsePendingVaultTransactionStore.getState = jest.fn(() => mockPendingVaultStore);
    mockUseNotificationStore.getState = jest.fn(() => mockNotificationStore);
    mockUseSendFlowStore.getState = jest.fn(() => mockSendFlowStore);
    mockUseVaultDataFetch.mockReturnValue(makeVault());
    mockIsE2E.mockReturnValue(false);
    mockGetNotificationsEnabled.mockResolvedValue(true);
    mockAsyncStorageGetItem.mockResolvedValue(null);
    mockAsyncStorageSetItem.mockResolvedValue(undefined);
    mockSendLocalNotification.mockResolvedValue(undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('provides the fetched vault state to consumers', () => {
    const vault = makeVault({
      vaultTransactions: [{ transaction_id: 'tx-1' }] as never,
    });
    mockUseVaultDataFetch.mockReturnValue(vault);
    const onValue = jest.fn();

    act(() => {
      create(
        <VaultProvider>
          <Consumer onValue={onValue} />
        </VaultProvider>,
      );
    });

    expect(onValue).toHaveBeenCalledWith(vault);
  });

  it('clears confirmed pending vault transactions and shows an idle snackbar', () => {
    mockPendingVaultStore.pendingTransaction = {
      txid: 'issue-txid',
      vaultTxid: 'vault-txid',
      action: 'open',
    };
    mockUseVaultDataFetch.mockReturnValue(
      makeVault({
        vaultTransactions: [{ transaction_id: 'vault-txid' }] as never,
      }),
    );

    act(() => {
      create(
        <VaultProvider>
          <Consumer onValue={jest.fn()} />
        </VaultProvider>,
      );
    });

    expect(mockPendingVaultStore.clearPendingTransaction).toHaveBeenCalled();
    expect(mockNotificationStore.showSnackbar).toHaveBeenCalledWith({
      type: 'success',
      action: 'open',
      txid: 'vault-txid',
    });
  });

  it('does not show a confirmation snackbar when another flow owns the UI', () => {
    mockPendingVaultStore.pendingTransaction = {
      txid: 'issue-txid',
      action: 'borrow',
    };
    mockNotificationStore.snackbar = { type: 'info' };
    mockSendFlowStore.intentStep = 'review';
    mockUseVaultDataFetch.mockReturnValue(
      makeVault({
        vaultTransactions: [{ transaction_id: 'issue-txid' }] as never,
      }),
    );

    act(() => {
      create(
        <VaultProvider>
          <Consumer onValue={jest.fn()} />
        </VaultProvider>,
      );
    });

    expect(mockPendingVaultStore.clearPendingTransaction).toHaveBeenCalled();
    expect(mockNotificationStore.showSnackbar).not.toHaveBeenCalled();
  });

  it('sends throttled warning health notifications when vaults cross under 200%', async () => {
    mockAsyncStorageGetItem.mockImplementation(async (key) => (
      key === 'vault_health_last_band' ? 'safe' : null
    ));
    mockUseVaultDataFetch.mockReturnValue(
      makeVault({
        vaultData: {
          vaultInfo: {
            collateral_ratio: 1.8,
            unit_borrowed: 100,
          },
        } as never,
      }),
    );

    act(() => {
      create(
        <VaultProvider>
          <Consumer onValue={jest.fn()} />
        </VaultProvider>,
      );
    });
    await flushEffects();

    expect(mockSendLocalNotification).toHaveBeenCalledWith({
      title: 'Vault Health Alert',
      body: 'Your vault health is 180% - consider adding collateral.',
      data: { type: 'vault_health' },
    });
    expect(mockAsyncStorageSetItem).toHaveBeenCalledWith(
      'vault_health_warning_last_alert',
      '1700000000000',
    );
    expect(mockAnalyticsTrack).toHaveBeenCalledWith('vault_health_warning', {
      health_percent: 180,
      level: 'warning',
    });
  });

  it('records first observed warning health without sending a notification', async () => {
    mockUseVaultDataFetch.mockReturnValue(
      makeVault({
        vaultData: {
          vaultInfo: {
            collateral_ratio: 1.8,
            unit_borrowed: 100,
          },
        } as never,
      }),
    );

    act(() => {
      create(
        <VaultProvider>
          <Consumer onValue={jest.fn()} />
        </VaultProvider>,
      );
    });
    await flushEffects();

    expect(mockSendLocalNotification).not.toHaveBeenCalled();
    expect(mockAsyncStorageSetItem).toHaveBeenCalledWith(
      'vault_health_last_band',
      'warning',
    );
    expect(mockAnalyticsTrack).not.toHaveBeenCalled();
  });

  it('sends critical health notifications when collateral ratio is already a percentage', async () => {
    mockAsyncStorageGetItem.mockImplementation(async (key) => (
      key === 'vault_health_last_band' ? 'safe' : null
    ));
    mockUseVaultDataFetch.mockReturnValue(
      makeVault({
        vaultData: {
          vaultInfo: {
            collateral_ratio: 160,
            unit_borrowed: 100,
          },
        } as never,
      }),
    );

    act(() => {
      create(
        <VaultProvider>
          <Consumer onValue={jest.fn()} />
        </VaultProvider>,
      );
    });
    await flushEffects();

    expect(mockSendLocalNotification).toHaveBeenCalledWith({
      title: 'Vault at Risk!',
      body: 'Your vault health is 160% - dangerously close to liquidation.',
      data: { type: 'vault_health' },
    });
    expect(mockAsyncStorageSetItem).toHaveBeenCalledWith(
      'vault_health_critical_last_alert',
      '1700000000000',
    );
    expect(mockAnalyticsTrack).toHaveBeenCalledWith('vault_health_warning', {
      health_percent: 160,
      level: 'critical',
    });
  });

  it('records first observed critical health without sending a notification', async () => {
    mockUseVaultDataFetch.mockReturnValue(
      makeVault({
        vaultData: {
          vaultInfo: {
            collateral_ratio: 160,
            unit_borrowed: 100,
          },
        } as never,
      }),
    );

    act(() => {
      create(
        <VaultProvider>
          <Consumer onValue={jest.fn()} />
        </VaultProvider>,
      );
    });
    await flushEffects();

    expect(mockSendLocalNotification).not.toHaveBeenCalled();
    expect(mockAsyncStorageSetItem).toHaveBeenCalledWith(
      'vault_health_last_band',
      'critical',
    );
    expect(mockAnalyticsTrack).not.toHaveBeenCalled();
  });

  it('does not send health notifications for vaults without debt', async () => {
    mockUseVaultDataFetch.mockReturnValue(
      makeVault({
        vaultData: {
          totalDebt: 0,
          vaultInfo: {
            collateral_ratio: 1.6,
            unit_borrowed: 0,
          },
        } as never,
      }),
    );

    act(() => {
      create(
        <VaultProvider>
          <Consumer onValue={jest.fn()} />
        </VaultProvider>,
      );
    });
    await flushEffects();

    expect(mockGetNotificationsEnabled).not.toHaveBeenCalled();
    expect(mockSendLocalNotification).not.toHaveBeenCalled();
  });

  it('does not send health notifications in E2E mode', async () => {
    mockIsE2E.mockReturnValue(true);
    mockUseVaultDataFetch.mockReturnValue(
      makeVault({
        vaultData: {
          vaultInfo: {
            collateral_ratio: 1.6,
            unit_borrowed: 100,
          },
        } as never,
      }),
    );

    act(() => {
      create(
        <VaultProvider>
          <Consumer onValue={jest.fn()} />
        </VaultProvider>,
      );
    });
    await flushEffects();

    expect(mockGetNotificationsEnabled).not.toHaveBeenCalled();
    expect(mockSendLocalNotification).not.toHaveBeenCalled();
  });
});
