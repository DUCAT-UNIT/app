import React from 'react';
import { InteractionManager } from 'react-native';
import { renderHook, waitFor } from '@testing-library/react-native';
import { EvmAssetsProvider, useEvmAssets } from '../EvmAssetsContext';
import { isEvmBridgeConfigured, isSepoliaRpcConfigured } from '../../constants/evm';
import { fetchSepoliaEthHistory, fetchSepoliaTokenHistory, getEvmBalances } from '../../services/evmBridgeService';
import {
  recoverConfirmedRedemptionTracking,
  reconcileSubmittedEvmTransactionCheckpoints,
} from '../../services/evmTransactionCheckpointService';
import { refreshPersistedVaultSettlementStatus } from '../../services/vaultSettlementService';
import { resetEvmTransactionCheckpointStore, useEvmTransactionCheckpointStore } from '../../stores/evmTransactionCheckpointStore';
import { resetUsdcFeatureFlagStore, useUsdcFeatureFlagStore } from '../../stores/usdcFeatureFlagStore';

const mockWallet = {
  segwitAddress: 'tb1qwallet',
  taprootAddress: 'tb1pwallet',
};

jest.mock('../../constants/evm', () => ({
  isEvmBridgeConfigured: jest.fn(),
  isSepoliaRpcConfigured: jest.fn(),
}));

jest.mock('../../services/evmBridgeService', () => ({
  fetchSepoliaEthHistory: jest.fn(),
  fetchSepoliaTokenHistory: jest.fn(),
  getEvmBalances: jest.fn(),
}));

jest.mock('../../services/evmTransactionCheckpointService', () => ({
  recoverConfirmedRedemptionTracking: jest.fn(),
  reconcileSubmittedEvmTransactionCheckpoints: jest.fn(),
}));

jest.mock('../../services/vaultSettlementService', () => ({
  refreshPersistedVaultSettlementStatus: jest.fn(),
}));

jest.mock('../AuthContext', () => ({
  useAuthSession: jest.fn(() => ({ isAuthenticated: true })),
}));

jest.mock('../WalletContext', () => ({
  useWallet: jest.fn(() => ({
    currentAccount: 2,
    wallet: mockWallet,
  })),
}));

jest.mock('../../hooks/usePolling', () => ({
  usePolling: jest.fn(),
}));

describe('EvmAssetsContext', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetEvmTransactionCheckpointStore();
    useUsdcFeatureFlagStore.getState().setEnabled(true);
    jest.spyOn(InteractionManager, 'runAfterInteractions').mockImplementation((task?: (() => void) | { gen: () => void }) => {
      if (typeof task === 'function') {
        task();
      } else {
        task?.gen();
      }

      return {
        then: jest.fn(),
        done: jest.fn(),
        cancel: jest.fn(),
      } as unknown as ReturnType<typeof InteractionManager.runAfterInteractions>;
    });
    (getEvmBalances as jest.Mock).mockResolvedValue({
      address: '0xabc',
      eth: '0.125',
      usdc: '42',
      wunit: '7',
    });
    (fetchSepoliaTokenHistory as jest.Mock).mockResolvedValue([]);
    (fetchSepoliaEthHistory as jest.Mock).mockResolvedValue([]);
    (refreshPersistedVaultSettlementStatus as jest.Mock).mockResolvedValue({
      status: 'idle',
      message: 'No persisted settlement',
    });
    (reconcileSubmittedEvmTransactionCheckpoints as jest.Mock).mockResolvedValue({
      checked: 0,
      pending: 0,
      confirmed: 0,
      failed: 0,
      errors: 0,
    });
    (recoverConfirmedRedemptionTracking as jest.Mock).mockResolvedValue({
      checked: 0,
      alreadyTracked: 0,
      tracked: 0,
      failed: 0,
      lastRedemption: null,
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
    resetEvmTransactionCheckpointStore();
    resetUsdcFeatureFlagStore();
  });

  it('does not fetch Sepolia balances or history while Enable USDC is off', () => {
    resetUsdcFeatureFlagStore();
    (isSepoliaRpcConfigured as jest.Mock).mockReturnValue(true);
    (isEvmBridgeConfigured as jest.Mock).mockReturnValue(true);

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <EvmAssetsProvider>{children}</EvmAssetsProvider>
    );
    const { result } = renderHook(() => useEvmAssets(), { wrapper });

    expect(result.current.isSepoliaConfigured).toBe(false);
    expect(result.current.isEvmConfigured).toBe(false);
    expect(result.current.evmBalances).toBeNull();
    expect(result.current.usdcHistory).toEqual([]);
    expect(result.current.ethHistory).toEqual([]);
    expect(getEvmBalances).not.toHaveBeenCalled();
    expect(fetchSepoliaTokenHistory).not.toHaveBeenCalled();
    expect(fetchSepoliaEthHistory).not.toHaveBeenCalled();
    expect(reconcileSubmittedEvmTransactionCheckpoints).not.toHaveBeenCalled();
    expect(refreshPersistedVaultSettlementStatus).not.toHaveBeenCalled();
  });

  it('loads Sepolia balances with only RPC configured while keeping bridge actions disabled', async () => {
    (isSepoliaRpcConfigured as jest.Mock).mockReturnValue(true);
    (isEvmBridgeConfigured as jest.Mock).mockReturnValue(false);

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <EvmAssetsProvider>{children}</EvmAssetsProvider>
    );
    const { result } = renderHook(() => useEvmAssets(), { wrapper });

    await waitFor(() => expect(getEvmBalances).toHaveBeenCalledWith(2));
    await waitFor(() => expect(fetchSepoliaTokenHistory).toHaveBeenCalledWith(2, 'USDC'));
    await waitFor(() => expect(fetchSepoliaEthHistory).toHaveBeenCalledWith(2));

    expect(result.current.isSepoliaConfigured).toBe(true);
    expect(result.current.isEvmConfigured).toBe(false);
    expect(result.current.evmBalances?.eth).toBe('0.125');
    expect(result.current.ethHistory).toEqual([]);
    expect(reconcileSubmittedEvmTransactionCheckpoints).toHaveBeenCalledTimes(1);
    expect(refreshPersistedVaultSettlementStatus).not.toHaveBeenCalled();
  });

  it('does not fetch Sepolia balances when the RPC is not configured', async () => {
    (isSepoliaRpcConfigured as jest.Mock).mockReturnValue(false);
    (isEvmBridgeConfigured as jest.Mock).mockReturnValue(true);

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <EvmAssetsProvider>{children}</EvmAssetsProvider>
    );
    const { result } = renderHook(() => useEvmAssets(), { wrapper });

    expect(result.current.isSepoliaConfigured).toBe(false);
    expect(result.current.isEvmConfigured).toBe(true);
    expect(getEvmBalances).not.toHaveBeenCalled();
    expect(fetchSepoliaTokenHistory).not.toHaveBeenCalled();
    expect(fetchSepoliaEthHistory).not.toHaveBeenCalled();
    expect(reconcileSubmittedEvmTransactionCheckpoints).not.toHaveBeenCalled();
    expect(refreshPersistedVaultSettlementStatus).not.toHaveBeenCalled();
  });

  it('refreshes persisted vault settlement status once when the bridge is configured', async () => {
    (isSepoliaRpcConfigured as jest.Mock).mockReturnValue(true);
    (isEvmBridgeConfigured as jest.Mock).mockReturnValue(true);
    (refreshPersistedVaultSettlementStatus as jest.Mock).mockResolvedValue({
      status: 'pending',
      message: 'Bridge settlement is still processing.',
    });

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <EvmAssetsProvider>{children}</EvmAssetsProvider>
    );
    renderHook(() => useEvmAssets(), { wrapper });

    await waitFor(() => expect(refreshPersistedVaultSettlementStatus).toHaveBeenCalledTimes(1));
  });

  it('refreshes balances and USDC history when startup reconciliation completes settlement', async () => {
    (isSepoliaRpcConfigured as jest.Mock).mockReturnValue(true);
    (isEvmBridgeConfigured as jest.Mock).mockReturnValue(true);
    (refreshPersistedVaultSettlementStatus as jest.Mock).mockResolvedValue({
      status: 'settled',
      message: 'Bridge settlement completed.',
    });

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <EvmAssetsProvider>{children}</EvmAssetsProvider>
    );
    renderHook(() => useEvmAssets(), { wrapper });

    await waitFor(() => expect(refreshPersistedVaultSettlementStatus).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(getEvmBalances).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(fetchSepoliaTokenHistory).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(fetchSepoliaEthHistory).toHaveBeenCalledTimes(2));
  });

  it('refreshes balances and USDC history when startup checkpoint reconciliation changes Sepolia tx state', async () => {
    (isSepoliaRpcConfigured as jest.Mock).mockReturnValue(true);
    (isEvmBridgeConfigured as jest.Mock).mockReturnValue(false);
    (reconcileSubmittedEvmTransactionCheckpoints as jest.Mock).mockResolvedValue({
      checked: 1,
      pending: 0,
      confirmed: 1,
      failed: 0,
      errors: 0,
    });

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <EvmAssetsProvider>{children}</EvmAssetsProvider>
    );
    renderHook(() => useEvmAssets(), { wrapper });

    await waitFor(() => expect(reconcileSubmittedEvmTransactionCheckpoints).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(getEvmBalances).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(fetchSepoliaTokenHistory).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(fetchSepoliaEthHistory).toHaveBeenCalledTimes(2));
    expect(refreshPersistedVaultSettlementStatus).not.toHaveBeenCalled();
  });

  it('recovers confirmed redemption tracking after startup checkpoint reconciliation', async () => {
    (isSepoliaRpcConfigured as jest.Mock).mockReturnValue(true);
    (isEvmBridgeConfigured as jest.Mock).mockReturnValue(true);
    (reconcileSubmittedEvmTransactionCheckpoints as jest.Mock).mockResolvedValue({
      checked: 1,
      pending: 0,
      confirmed: 1,
      failed: 0,
      errors: 0,
    });

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <EvmAssetsProvider>{children}</EvmAssetsProvider>
    );
    renderHook(() => useEvmAssets(), { wrapper });

    await waitFor(() => expect(reconcileSubmittedEvmTransactionCheckpoints).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(recoverConfirmedRedemptionTracking).toHaveBeenCalledTimes(1));
  });

  it('includes pending transfer checkpoints in Sepolia asset history before the indexer confirms them', async () => {
    (isSepoliaRpcConfigured as jest.Mock).mockReturnValue(true);
    (isEvmBridgeConfigured as jest.Mock).mockReturnValue(false);
    (getEvmBalances as jest.Mock).mockResolvedValue({
      address: '0x1111111111111111111111111111111111111111',
      eth: '0.125',
      usdc: '42',
      wunit: '7',
    });
    useEvmTransactionCheckpointStore.setState({
      checkpoints: [{
        id: '0xpending',
        chain: 'sepolia',
        accountIndex: 2,
        kind: 'transfer',
        status: 'submitted',
        txHash: '0xpending',
        receiptTxHash: null,
        asset: 'USDC',
        amount: '4.5',
        spender: null,
        recipient: '0x1111111111111111111111111111111111111111',
        tokenIn: null,
        tokenOut: null,
        releaseId: null,
        destinationTaprootAddress: null,
        submittedAt: 1_700_000_000_000,
        confirmedAt: null,
        updatedAt: 1_700_000_000_000,
        error: null,
      }],
    });

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <EvmAssetsProvider>{children}</EvmAssetsProvider>
    );
    const { result } = renderHook(() => useEvmAssets(), { wrapper });

    await waitFor(() => expect(result.current.usdcHistory).toHaveLength(1));
    expect(result.current.usdcHistory[0]).toMatchObject({
      txid: '0xpending',
      status: { confirmed: false },
      txData: {
        amount: 4.5,
        assetType: 'USDC',
        isSent: true,
        isReceived: true,
      },
    });
  });
});
