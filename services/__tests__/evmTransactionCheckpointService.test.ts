import {
  resetEvmTransactionCheckpointStore,
  useEvmTransactionCheckpointStore,
} from '../../stores/evmTransactionCheckpointStore';
import {
  recoverConfirmedRedemptionTracking,
  reconcileSubmittedEvmTransactionCheckpoints,
} from '../evmTransactionCheckpointService';
import { getRedemptionStatus, trackRedemption } from '../bridgeApiService';
import { deriveSepoliaAccount, getSepoliaProvider } from '../evmWalletService';

jest.mock('../bridgeApiService', () => ({
  getRedemptionStatus: jest.fn(),
  trackRedemption: jest.fn(),
}));

jest.mock('../evmWalletService', () => ({
  deriveSepoliaAccount: jest.fn(),
  getSepoliaProvider: jest.fn(),
}));

jest.mock('../../utils/logger', () => ({
  logger: {
    warn: jest.fn(),
  },
}));

describe('evmTransactionCheckpointService', () => {
  const mockProvider = {
    getTransactionReceipt: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    resetEvmTransactionCheckpointStore();
    (getSepoliaProvider as jest.Mock).mockReturnValue(mockProvider);
    (deriveSepoliaAccount as jest.Mock).mockResolvedValue({
      address: '0x1111111111111111111111111111111111111111',
      chainId: 11155111,
      derivationPath: "m/44'/60'/0'/0/0",
      accountIndex: 0,
    });
  });

  it('confirms, fails, and leaves pending submitted Sepolia checkpoints', async () => {
    useEvmTransactionCheckpointStore.getState().recordSubmitted({
      accountIndex: 0,
      kind: 'approval',
      txHash: '0xconfirmed',
      asset: 'USDC',
      amount: '1',
      spender: '0xspender',
      recipient: null,
      tokenIn: null,
      tokenOut: null,
      releaseId: null,
      destinationTaprootAddress: null,
    });
    useEvmTransactionCheckpointStore.getState().recordSubmitted({
      accountIndex: 0,
      kind: 'swap',
      txHash: '0xreverted',
      asset: null,
      amount: '1',
      spender: '0xpool',
      recipient: '0xwallet',
      tokenIn: 'USDC',
      tokenOut: 'wUNIT',
      releaseId: null,
      destinationTaprootAddress: null,
    });
    useEvmTransactionCheckpointStore.getState().recordSubmitted({
      accountIndex: 0,
      kind: 'transfer',
      txHash: '0xpending',
      asset: 'ETH',
      amount: '0.01',
      spender: null,
      recipient: '0xrecipient',
      tokenIn: 'ETH',
      tokenOut: null,
      releaseId: null,
      destinationTaprootAddress: null,
    });

    mockProvider.getTransactionReceipt.mockImplementation((txHash: string) => {
      if (txHash === '0xconfirmed') {
        return Promise.resolve({ hash: '0xconfirmed-receipt', status: 1 });
      }
      if (txHash === '0xreverted') {
        return Promise.resolve({ hash: '0xreverted-receipt', status: 0 });
      }
      return Promise.resolve(null);
    });

    await expect(reconcileSubmittedEvmTransactionCheckpoints()).resolves.toEqual({
      checked: 3,
      pending: 1,
      confirmed: 1,
      failed: 1,
      errors: 0,
    });

    expect(useEvmTransactionCheckpointStore.getState().checkpoints).toEqual(expect.arrayContaining([
      expect.objectContaining({ txHash: '0xreverted', status: 'failed' }),
      expect.objectContaining({ txHash: '0xconfirmed', status: 'confirmed', receiptTxHash: '0xconfirmed-receipt' }),
      expect.objectContaining({ txHash: '0xpending', status: 'submitted' }),
    ]));
  });

  it('does not mutate checkpoints when receipt lookup fails', async () => {
    useEvmTransactionCheckpointStore.getState().recordSubmitted({
      accountIndex: 0,
      kind: 'redemption',
      txHash: '0xburn',
      asset: 'wUNIT',
      amount: '1',
      spender: '0xrouter',
      recipient: null,
      tokenIn: 'wUNIT',
      tokenOut: 'UNIT',
      releaseId: 'release-1',
      destinationTaprootAddress: 'tb1pdestination',
    });
    mockProvider.getTransactionReceipt.mockRejectedValue(new Error('rpc offline'));

    await expect(reconcileSubmittedEvmTransactionCheckpoints()).resolves.toEqual({
      checked: 1,
      pending: 0,
      confirmed: 0,
      failed: 0,
      errors: 1,
    });
    expect(useEvmTransactionCheckpointStore.getState().checkpoints[0]).toMatchObject({
      txHash: '0xburn',
      status: 'submitted',
      error: null,
    });
  });

  it('reconciles ambiguous failed checkpoints back to pending when no receipt exists', async () => {
    useEvmTransactionCheckpointStore.getState().recordSubmitted({
      accountIndex: 0,
      kind: 'transfer',
      txHash: '0xsend',
      asset: 'USDC',
      amount: '5',
      spender: null,
      recipient: '0xrecipient',
      tokenIn: 'USDC',
      tokenOut: null,
      releaseId: null,
      destinationTaprootAddress: null,
    });
    useEvmTransactionCheckpointStore.getState().markFailed('0xsend', 'rpc timeout');
    mockProvider.getTransactionReceipt.mockResolvedValue(null);

    await expect(reconcileSubmittedEvmTransactionCheckpoints()).resolves.toEqual({
      checked: 1,
      pending: 1,
      confirmed: 0,
      failed: 0,
      errors: 0,
    });

    expect(useEvmTransactionCheckpointStore.getState().checkpoints[0]).toMatchObject({
      txHash: '0xsend',
      status: 'submitted',
      error: null,
    });
  });

  it('confirms failed checkpoints when the chain receipt succeeded', async () => {
    useEvmTransactionCheckpointStore.getState().recordSubmitted({
      accountIndex: 0,
      kind: 'redemption',
      txHash: '0xburn',
      asset: 'wUNIT',
      amount: '1',
      spender: '0xrouter',
      recipient: null,
      tokenIn: 'wUNIT',
      tokenOut: 'UNIT',
      releaseId: 'release-1',
      destinationTaprootAddress: 'tb1pdestination',
    });
    useEvmTransactionCheckpointStore.getState().markFailed('0xburn', 'wait failed');
    mockProvider.getTransactionReceipt.mockResolvedValue({ hash: '0xburn-receipt', status: 1 });

    await expect(reconcileSubmittedEvmTransactionCheckpoints()).resolves.toEqual({
      checked: 1,
      pending: 0,
      confirmed: 1,
      failed: 0,
      errors: 0,
    });

    expect(useEvmTransactionCheckpointStore.getState().checkpoints[0]).toMatchObject({
      txHash: '0xburn',
      status: 'confirmed',
      receiptTxHash: '0xburn-receipt',
      error: null,
    });
  });

  it('recovers bridge API tracking for confirmed redemption checkpoints', async () => {
    useEvmTransactionCheckpointStore.getState().recordSubmitted({
      accountIndex: 0,
      kind: 'redemption',
      txHash: '0xsubmitted-burn',
      asset: 'wUNIT',
      amount: '3',
      spender: '0xrouter',
      recipient: null,
      tokenIn: 'wUNIT',
      tokenOut: 'UNIT',
      releaseId: 'release-1',
      destinationTaprootAddress: 'tb1pdestination',
    });
    useEvmTransactionCheckpointStore.getState().markConfirmed('0xsubmitted-burn', '0xconfirmed-burn');
    (getRedemptionStatus as jest.Mock).mockRejectedValue(new Error('HTTP 404: Not Found'));
    (trackRedemption as jest.Mock).mockResolvedValue({
      id: 'release-1',
      status: 'pending_release',
      amount: '3',
      sourceAsset: 'wUNIT',
      destinationTaprootAddress: 'tb1pdestination',
      burnTxHash: '0xconfirmed-burn',
    });

    await expect(recoverConfirmedRedemptionTracking('release-1')).resolves.toEqual({
      checked: 1,
      alreadyTracked: 0,
      tracked: 1,
      failed: 0,
      lastRedemption: expect.objectContaining({ id: 'release-1', status: 'pending_release' }),
    });

    expect(trackRedemption).toHaveBeenCalledWith({
      id: 'release-1',
      requester: '0x1111111111111111111111111111111111111111',
      destinationTaprootAddress: 'tb1pdestination',
      amount: '3',
      sourceAsset: 'wUNIT',
      burnTxHash: '0xconfirmed-burn',
    });
  });

  it('does not repost redemption tracking when the backend already has the release', async () => {
    useEvmTransactionCheckpointStore.getState().recordSubmitted({
      accountIndex: 0,
      kind: 'redemption',
      txHash: '0xsubmitted-burn',
      asset: 'wUNIT',
      amount: '3',
      spender: '0xrouter',
      recipient: null,
      tokenIn: 'wUNIT',
      tokenOut: 'UNIT',
      releaseId: 'release-1',
      destinationTaprootAddress: 'tb1pdestination',
    });
    useEvmTransactionCheckpointStore.getState().markConfirmed('0xsubmitted-burn', '0xconfirmed-burn');
    (getRedemptionStatus as jest.Mock).mockResolvedValue({
      id: 'release-1',
      status: 'released',
      amount: '3',
      sourceAsset: 'wUNIT',
      destinationTaprootAddress: 'tb1pdestination',
      burnTxHash: '0xconfirmed-burn',
      releaseTxid: 'mutiny-release',
    });

    await expect(recoverConfirmedRedemptionTracking('release-1')).resolves.toEqual({
      checked: 1,
      alreadyTracked: 1,
      tracked: 0,
      failed: 0,
      lastRedemption: expect.objectContaining({ id: 'release-1', status: 'released' }),
    });

    expect(trackRedemption).not.toHaveBeenCalled();
  });
});
