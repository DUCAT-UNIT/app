import { parseEther } from 'ethers';

describe('evmBridgeService native ETH transfers', () => {
  const recipient = '0x1111111111111111111111111111111111111111';
  let mockWallet: {
    address: string;
    estimateGas: jest.Mock;
    sendTransaction: jest.Mock;
  };
  let mockProvider: {
    getFeeData: jest.Mock;
    getBalance: jest.Mock;
  };

  beforeEach(() => {
    jest.resetModules();
    mockWallet = {
      address: '0x2222222222222222222222222222222222222222',
      estimateGas: jest.fn().mockResolvedValue(21_000n),
      sendTransaction: jest.fn().mockResolvedValue({
        hash: '0xsent',
        wait: jest.fn().mockResolvedValue({ hash: '0xconfirmed' }),
      }),
    };
    mockProvider = {
      getFeeData: jest.fn().mockResolvedValue({ gasPrice: 1_000_000_000n }),
      getBalance: jest.fn().mockResolvedValue(parseEther('0.1')),
    };

    jest.doMock('../../constants/evm', () => ({
      EVM_CONFIG: {
        confirmations: 1,
        rpcUrl: 'https://sepolia.example',
        bridgeApiBaseUrl: '',
        wunitAddress: '',
        bridgeRouterAddress: '',
        stablePoolAddress: '',
        usdcAddress: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238',
        swapSlippageBps: 100,
        explorerBaseUrl: 'https://sepolia.etherscan.io',
      },
      EVM_DECIMALS: 6,
    }));
    jest.doMock('../evmWalletService', () => ({
      getSepoliaProvider: jest.fn(() => mockProvider),
      withSepoliaSigner: jest.fn((_accountIndex: number, callback: (wallet: typeof mockWallet, provider: typeof mockProvider) => unknown) => callback(mockWallet, mockProvider)),
    }));
    jest.doMock('../bridgeApiService', () => ({
      trackRedemption: jest.fn(),
    }));
    jest.doMock('../../utils/logger', () => ({
      logger: {
        debug: jest.fn(),
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
      },
    }));
  });

  it('estimates native ETH transfers without constructing an ERC-20 contract', async () => {
    const { estimateSepoliaTokenTransfer } = require('../evmBridgeService');

    const estimate = await estimateSepoliaTokenTransfer(0, 'ETH', recipient, '0.01');

    expect(mockWallet.estimateGas).toHaveBeenCalledWith({
      to: recipient,
      value: parseEther('0.01'),
    });
    expect(estimate).toEqual({
      gasUnits: '21000',
      totalFeeEth: '0.000021',
      gasPriceGwei: '1.0',
      walletAddress: mockWallet.address,
      assetBalance: '0.1',
      ethBalance: '0.1',
      requiredAssetAmount: '0.01',
      requiredEth: '0.010021',
      hasEnoughAsset: true,
      hasEnoughEth: true,
      canExecute: true,
      blockingReasons: [],
    });
  });

  it('sends native ETH, records a checkpoint, and returns after broadcast', async () => {
    const { sendSepoliaToken } = require('../evmBridgeService');

    const result = await sendSepoliaToken(0, 'ETH', recipient, '0.01');

    expect(mockWallet.sendTransaction).toHaveBeenCalledWith({
      to: recipient,
      value: parseEther('0.01'),
    });
    const sentTx = await mockWallet.sendTransaction.mock.results[0].value;
    expect(sentTx.wait).not.toHaveBeenCalled();
    expect(result).toEqual({
      txHash: '0xsent',
      amount: '0.01',
      token: 'ETH',
      recipient,
    });
    const { useEvmTransactionCheckpointStore } = require('../../stores/evmTransactionCheckpointStore');
    expect(useEvmTransactionCheckpointStore.getState().checkpoints[0]).toEqual(expect.objectContaining({
      accountIndex: 0,
      kind: 'transfer',
      status: 'submitted',
      txHash: '0xsent',
      asset: 'ETH',
      amount: '0.01',
      recipient,
    }));
  });

  it('rejects native ETH sends that cannot cover amount plus gas', async () => {
    const { sendSepoliaToken } = require('../evmBridgeService');
    mockProvider.getBalance.mockResolvedValue(parseEther('0.01001'));

    await expect(sendSepoliaToken(0, 'ETH', recipient, '0.01'))
      .rejects
      .toThrow('Not enough Sepolia ETH');
    expect(mockWallet.sendTransaction).not.toHaveBeenCalled();
  });

  it('rejects invalid ETH amounts before estimating gas', async () => {
    const { estimateSepoliaTokenTransfer } = require('../evmBridgeService');

    await expect(estimateSepoliaTokenTransfer(0, 'ETH', recipient, '0'))
      .rejects
      .toThrow('Enter a ETH amount greater than zero');
    expect(mockWallet.estimateGas).not.toHaveBeenCalled();
  });
});

describe('evmBridgeService Sepolia error classification', () => {
  beforeEach(() => {
    jest.resetModules();
  });

  it('classifies common Sepolia execution failures into actionable retry states', async () => {
    const { classifyEvmExecutionError } = require('../evmBridgeService');

    expect(classifyEvmExecutionError(Object.assign(new Error('User rejected the request'), { code: 'ACTION_REJECTED' })))
      .toEqual(expect.objectContaining({
        kind: 'user_rejected',
        retryable: true,
      }));
    expect(classifyEvmExecutionError(new Error('replacement transaction underpriced')))
      .toEqual(expect.objectContaining({
        kind: 'replacement_transaction',
        retryable: true,
      }));
    expect(classifyEvmExecutionError(Object.assign(new Error('execution reverted'), { code: 'CALL_EXCEPTION' })))
      .toEqual(expect.objectContaining({
        kind: 'reverted',
        retryable: false,
      }));
    expect(classifyEvmExecutionError(new Error('Not enough Sepolia ETH for gas.')))
      .toEqual(expect.objectContaining({
        kind: 'insufficient_funds',
        retryable: false,
      }));
    expect(classifyEvmExecutionError(new Error('fetch failed: 503')))
      .toEqual(expect.objectContaining({
        kind: 'rpc_unavailable',
        retryable: true,
      }));
  });
});

describe('evmBridgeService Sepolia execution preflights', () => {
  const usdcAddress = '0x0000000000000000000000000000000000000001';
  const wunitAddress = '0x0000000000000000000000000000000000000002';
  const stablePoolAddress = '0x0000000000000000000000000000000000000003';
  const bridgeRouterAddress = '0x0000000000000000000000000000000000000004';
  const recipient = '0x1111111111111111111111111111111111111111';
  const taprootDestination = 'tb1p7p74tg67aaw94vz2kewzeyuq80x0a65wpgegnat98f5hkcnpfjsqntv2em';
  let mockProvider: {
    getFeeData: jest.Mock;
    getBalance: jest.Mock;
  };
  let mockWallet: {
    address: string;
  };
  let mockUsdc: {
    balanceOf: jest.Mock;
    allowance: jest.Mock;
    approve: jest.Mock & { estimateGas: jest.Mock };
    transfer: jest.Mock & { estimateGas: jest.Mock };
  };
  let mockWunit: {
    balanceOf: jest.Mock;
    allowance: jest.Mock;
    approve: jest.Mock & { estimateGas: jest.Mock };
    transfer: jest.Mock & { estimateGas: jest.Mock };
  };
  let mockPool: {
    quoteSwap: jest.Mock;
    swap: jest.Mock & { estimateGas: jest.Mock };
  };
  let mockRouter: {
    requestRedemption: jest.Mock & { estimateGas: jest.Mock };
  };

  function mockContractMethod(gas: bigint): jest.Mock & { estimateGas: jest.Mock } {
    const method = jest.fn() as jest.Mock & { estimateGas: jest.Mock };
    method.estimateGas = jest.fn().mockResolvedValue(gas);
    return method;
  }

  function configurePreflightMocks({
    ethBalance = parseEther('1'),
    usdcBalance = 100_000_000n,
    wunitBalance = 100_000_000n,
    usdcAllowance = 100_000_000n,
    stablePoolWunitAllowance = 100_000_000n,
    routerWunitAllowance = 100_000_000n,
  }: {
    ethBalance?: bigint;
    usdcBalance?: bigint;
    wunitBalance?: bigint;
    usdcAllowance?: bigint;
    stablePoolWunitAllowance?: bigint;
    routerWunitAllowance?: bigint;
  } = {}): void {
    mockProvider = {
      getFeeData: jest.fn().mockResolvedValue({ gasPrice: 1_000_000_000n }),
      getBalance: jest.fn().mockResolvedValue(ethBalance),
    };
    mockWallet = {
      address: '0x2222222222222222222222222222222222222222',
    };
    mockUsdc = {
      balanceOf: jest.fn().mockResolvedValue(usdcBalance),
      allowance: jest.fn().mockResolvedValue(usdcAllowance),
      approve: mockContractMethod(55_000n),
      transfer: mockContractMethod(65_000n),
    };
    mockWunit = {
      balanceOf: jest.fn().mockResolvedValue(wunitBalance),
      allowance: jest.fn((_owner: string, spender: string) =>
        Promise.resolve(spender === bridgeRouterAddress ? routerWunitAllowance : stablePoolWunitAllowance)
      ),
      approve: mockContractMethod(55_000n),
      transfer: mockContractMethod(65_000n),
    };
    mockPool = {
      quoteSwap: jest.fn((_tokenIn: number, amountIn: bigint) => Promise.resolve((amountIn * 99n) / 100n)),
      swap: mockContractMethod(240_000n),
    };
    mockRouter = {
      requestRedemption: mockContractMethod(220_000n),
    };

    jest.doMock('../../constants/evm', () => ({
      EVM_CONFIG: {
        confirmations: 1,
        rpcUrl: 'https://sepolia.example',
        bridgeApiBaseUrl: 'https://bridge.example',
        wunitAddress,
        bridgeRouterAddress,
        stablePoolAddress,
        usdcAddress,
        swapSlippageBps: 100,
        explorerBaseUrl: 'https://sepolia.etherscan.io',
      },
      EVM_DECIMALS: 6,
    }));
    jest.doMock('../evmWalletService', () => ({
      getSepoliaProvider: jest.fn(() => mockProvider),
      withSepoliaSigner: jest.fn((_accountIndex: number, callback: (wallet: typeof mockWallet, provider: typeof mockProvider) => unknown) => callback(mockWallet, mockProvider)),
    }));
    jest.doMock('../bridgeApiService', () => ({
      trackRedemption: jest.fn(),
    }));
    jest.doMock('ethers', () => {
      const actual = jest.requireActual('ethers');
      return {
        ...actual,
        Contract: jest.fn((address: string) => {
          if (address === stablePoolAddress) return mockPool;
          if (address === usdcAddress) return mockUsdc;
          if (address === wunitAddress) return mockWunit;
          if (address === bridgeRouterAddress) return mockRouter;
          throw new Error(`Unexpected contract address ${address}`);
        }),
      };
    });
    jest.doMock('../../utils/logger', () => ({
      logger: {
        debug: jest.fn(),
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
      },
    }));
  }

  beforeEach(() => {
    jest.resetModules();
  });

  it('returns ERC-20 transfer balance and gas blocking reasons before send', async () => {
    configurePreflightMocks({
      ethBalance: parseEther('0.00001'),
      usdcBalance: 5_000_000n,
    });
    const { estimateSepoliaTokenTransfer } = require('../evmBridgeService');

    const estimate = await estimateSepoliaTokenTransfer(0, 'USDC', recipient, '10');

    expect(estimate).toEqual(expect.objectContaining({
      gasUnits: '65000',
      totalFeeEth: '0.000065',
      gasPriceGwei: '1.0',
      walletAddress: mockWallet.address,
      assetBalance: '5.0',
      ethBalance: '0.00001',
      requiredAssetAmount: '10.0',
      requiredEth: '0.000065',
      hasEnoughAsset: false,
      hasEnoughEth: false,
      canExecute: false,
    }));
    expect(estimate.blockingReasons).toEqual([
      'Not enough USDC. Need 10.0, available 5.0.',
      'Not enough Sepolia ETH for gas. Need 0.000065 ETH, available 0.00001 ETH.',
    ]);
  });

  it('returns USDC-to-UNIT swap source, gas, and approval preflight state', async () => {
    configurePreflightMocks({
      ethBalance: parseEther('0.0001'),
      usdcBalance: 5_000_000n,
      wunitBalance: 0n,
      usdcAllowance: 0n,
      routerWunitAllowance: 0n,
    });
    const { estimateUsdcToUnitSwapExecution } = require('../evmBridgeService');

    const estimate = await estimateUsdcToUnitSwapExecution(0, '10', taprootDestination);

    expect(estimate).toEqual(expect.objectContaining({
      totalGasUnits: '570000',
      totalFeeEth: '0.00057',
      requiresUsdcApproval: true,
      requiresWunitApproval: true,
      walletAddress: mockWallet.address,
      usdcBalance: '5.0',
      wunitBalance: '0.0',
      requiredUsdcAmount: '10.0',
      expectedWunitAmount: '9.9',
      hasEnoughUsdc: false,
      hasEnoughEth: false,
      canExecute: false,
    }));
    expect(estimate.blockingReasons).toEqual([
      'Not enough USDC. Need 10.0, available 5.0.',
      'Not enough Sepolia ETH for approvals, swap, and redemption gas. Need 0.00057 ETH, available 0.0001 ETH.',
    ]);
    expect(mockPool.swap.estimateGas).not.toHaveBeenCalled();
  });

  it('returns direct wUNIT redemption source preflight state before burn', async () => {
    configurePreflightMocks({
      wunitBalance: 2_000_000n,
      routerWunitAllowance: 10_000_000n,
    });
    const { estimateRedemptionExecution } = require('../evmBridgeService');

    const estimate = await estimateRedemptionExecution(0, '3', taprootDestination, 'wUNIT');

    expect(estimate).toEqual(expect.objectContaining({
      totalGasUnits: '220000',
      totalFeeEth: '0.00022',
      requiresUsdcApproval: false,
      requiresWunitApproval: false,
      sourceAsset: 'wUNIT',
      requiredSourceAmount: '3',
      sourceBalance: '2.0',
      hasEnoughSource: false,
      hasEnoughEth: true,
      canExecute: false,
    }));
    expect(estimate.blockingReasons).toEqual([
      'Not enough wUNIT. Need 3.0, available 2.0.',
    ]);
    expect(mockRouter.requestRedemption.estimateGas).not.toHaveBeenCalled();
  });

  it('rejects non-Taproot Mutinynet redemption destinations before gas estimation', async () => {
    configurePreflightMocks();
    const { estimateRedemptionExecution } = require('../evmBridgeService');

    await expect(estimateRedemptionExecution(
      0,
      '3',
      'tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx',
      'wUNIT',
    ))
      .rejects
      .toThrow('Redemption destination must be a Mutinynet Taproot address');
    expect(mockRouter.requestRedemption.estimateGas).not.toHaveBeenCalled();
  });

  it('rejects USDC-to-UNIT execution before approvals or swaps when preflight is blocked', async () => {
    configurePreflightMocks({
      ethBalance: parseEther('0.0001'),
      usdcBalance: 5_000_000n,
      wunitBalance: 0n,
      usdcAllowance: 0n,
      routerWunitAllowance: 0n,
    });
    const { executeUsdcToUnitSwap } = require('../evmBridgeService');

    await expect(executeUsdcToUnitSwap(0, '10', taprootDestination))
      .rejects
      .toThrow('Not enough USDC. Need 10.0, available 5.0.');
    expect(mockUsdc.approve).not.toHaveBeenCalled();
    expect(mockPool.swap).not.toHaveBeenCalled();
    expect(mockRouter.requestRedemption).not.toHaveBeenCalled();
  });

  it('rejects stale USDC-to-UNIT quotes before approvals or swaps', async () => {
    configurePreflightMocks({
      ethBalance: parseEther('1'),
      usdcBalance: 100_000_000n,
      wunitBalance: 100_000_000n,
      usdcAllowance: 100_000_000n,
      routerWunitAllowance: 100_000_000n,
    });
    const { executeUsdcToUnitSwap } = require('../evmBridgeService');

    await expect(executeUsdcToUnitSwap(0, '10', taprootDestination, '9.95'))
      .rejects
      .toThrow('Swap quote changed. Expected at least 9.95 wUNIT, current quote returns 9.9 wUNIT.');

    expect(mockUsdc.approve).not.toHaveBeenCalled();
    expect(mockPool.swap).not.toHaveBeenCalled();
    expect(mockRouter.requestRedemption).not.toHaveBeenCalled();
  });

  it('sends ERC-20 Sepolia tokens after checking token and gas balances', async () => {
    configurePreflightMocks({
      ethBalance: parseEther('1'),
      usdcBalance: 10_000_000n,
    });
    const wait = jest.fn().mockResolvedValue({ hash: '0xconfirmed-transfer' });
    mockUsdc.transfer.mockResolvedValue({
      hash: '0xsubmitted-transfer',
      wait,
    });
    const { sendSepoliaToken } = require('../evmBridgeService');

    const result = await sendSepoliaToken(0, 'USDC', recipient, '2');

    expect(mockUsdc.balanceOf).toHaveBeenCalledWith(mockWallet.address);
    expect(mockUsdc.transfer.estimateGas).toHaveBeenCalledWith(recipient, 2_000_000n);
    expect(mockUsdc.transfer).toHaveBeenCalledWith(recipient, 2_000_000n);
    expect(wait).not.toHaveBeenCalled();
    expect(result).toEqual({
      txHash: '0xsubmitted-transfer',
      amount: '2.0',
      token: 'USDC',
      recipient,
    });
    const { useEvmTransactionCheckpointStore } = require('../../stores/evmTransactionCheckpointStore');
    expect(useEvmTransactionCheckpointStore.getState().checkpoints[0]).toEqual(expect.objectContaining({
      accountIndex: 0,
      kind: 'transfer',
      status: 'submitted',
      txHash: '0xsubmitted-transfer',
      asset: 'USDC',
      amount: '2.0',
      recipient,
    }));
  });

  it('executes direct wUNIT redemption and tracks the bridge API payload', async () => {
    configurePreflightMocks({
      ethBalance: parseEther('1'),
      wunitBalance: 10_000_000n,
      routerWunitAllowance: 10_000_000n,
    });
    const wait = jest.fn().mockResolvedValue({ hash: '0xconfirmed-burn' });
    mockRouter.requestRedemption.mockResolvedValue({
      hash: '0xsubmitted-burn',
      wait,
    });
    const { requestRedemption } = require('../evmBridgeService');
    const { trackRedemption } = require('../bridgeApiService');
    const { useEvmTransactionCheckpointStore } = require('../../stores/evmTransactionCheckpointStore');

    const result = await requestRedemption(0, '3', taprootDestination, 'wUNIT');

    expect(mockWunit.approve).not.toHaveBeenCalled();
    expect(mockRouter.requestRedemption).toHaveBeenCalledWith(
      expect.stringMatching(/^0x[0-9a-f]{64}$/),
      3_000_000n,
      taprootDestination,
    );
    expect(wait).toHaveBeenCalledWith(1);
    expect(trackRedemption).toHaveBeenCalledWith(expect.objectContaining({
      id: result.releaseId,
      requester: mockWallet.address,
      destinationTaprootAddress: taprootDestination,
      amount: '3.0',
      sourceAsset: 'wUNIT',
      burnTxHash: '0xconfirmed-burn',
    }));
    expect(result).toEqual({
      releaseId: expect.stringMatching(/^0x[0-9a-f]{64}$/),
      burnTxHash: '0xconfirmed-burn',
      redeemedAmount: '3.0',
      sourceAsset: 'wUNIT',
      preparationSwap: undefined,
      trackRedemptionError: undefined,
    });
    expect(useEvmTransactionCheckpointStore.getState().checkpoints[0]).toMatchObject({
      kind: 'redemption',
      status: 'confirmed',
      txHash: '0xsubmitted-burn',
      receiptTxHash: '0xconfirmed-burn',
      asset: 'wUNIT',
      amount: '3.0',
      releaseId: result.releaseId,
      destinationTaprootAddress: taprootDestination,
    });
  });

  it('persists submitted redemption hashes when confirmation wait fails', async () => {
    configurePreflightMocks({
      ethBalance: parseEther('1'),
      wunitBalance: 10_000_000n,
      routerWunitAllowance: 10_000_000n,
    });
    const wait = jest.fn().mockRejectedValue(new Error('receipt timeout'));
    mockRouter.requestRedemption.mockResolvedValue({
      hash: '0xsubmitted-burn',
      wait,
    });
    const { requestRedemption } = require('../evmBridgeService');
    const { useEvmTransactionCheckpointStore } = require('../../stores/evmTransactionCheckpointStore');

    await expect(requestRedemption(0, '3', taprootDestination, 'wUNIT'))
      .rejects
      .toThrow('receipt timeout');

    expect(useEvmTransactionCheckpointStore.getState().checkpoints[0]).toMatchObject({
      kind: 'redemption',
      status: 'failed',
      txHash: '0xsubmitted-burn',
      error: 'receipt timeout',
      amount: '3.0',
      destinationTaprootAddress: taprootDestination,
    });
  });

  it('returns confirmed burn details when bridge API redemption tracking fails', async () => {
    configurePreflightMocks({
      ethBalance: parseEther('1'),
      wunitBalance: 10_000_000n,
      routerWunitAllowance: 10_000_000n,
    });
    const wait = jest.fn().mockResolvedValue({ hash: '0xconfirmed-burn' });
    mockRouter.requestRedemption.mockResolvedValue({
      hash: '0xsubmitted-burn',
      wait,
    });
    const { requestRedemption } = require('../evmBridgeService');
    const { trackRedemption } = require('../bridgeApiService');
    trackRedemption.mockRejectedValue(new Error('bridge api offline'));

    const result = await requestRedemption(0, '3', taprootDestination, 'wUNIT');

    expect(trackRedemption).toHaveBeenCalledWith(expect.objectContaining({
      id: result.releaseId,
      burnTxHash: '0xconfirmed-burn',
    }));
    expect(result).toEqual({
      releaseId: expect.stringMatching(/^0x[0-9a-f]{64}$/),
      burnTxHash: '0xconfirmed-burn',
      redeemedAmount: '3.0',
      sourceAsset: 'wUNIT',
      preparationSwap: undefined,
      trackRedemptionError: 'bridge api offline',
    });
  });
});

describe('evmBridgeService UNIT/USDC pool dashboard', () => {
  const usdcAddress = '0x0000000000000000000000000000000000000001';
  const wunitAddress = '0x0000000000000000000000000000000000000002';
  const stablePoolAddress = '0x0000000000000000000000000000000000000003';
  const bridgeRouterAddress = '0x0000000000000000000000000000000000000004';
  let mockPool: {
    getBalances: jest.Mock;
    quoteSwap: jest.Mock;
  };
  let mockUsdc: {
    balanceOf: jest.Mock;
    allowance: jest.Mock;
  };
  let mockWunit: {
    balanceOf: jest.Mock;
    allowance: jest.Mock;
  };
  let mockProvider: {
    getBalance: jest.Mock;
  };
  let mockWallet: {
    address: string;
  };

  function mockConfiguredPool({
    bridgeApiBaseUrl = 'https://bridge.example',
  }: {
    bridgeApiBaseUrl?: string;
  } = {}): void {
    mockPool = {
      getBalances: jest.fn().mockResolvedValue([
        1_000_000_000n,
        2_000_000_000n,
      ]),
      quoteSwap: jest.fn((_tokenIn: number, amountIn: bigint) =>
        Promise.resolve(_tokenIn === 0 ? amountIn * 999n / 1000n : amountIn * 998n / 1000n)
      ),
    };
    mockUsdc = {
      balanceOf: jest.fn().mockResolvedValue(500_000_000n),
      allowance: jest.fn().mockResolvedValue(100_000_000n),
    };
    mockWunit = {
      balanceOf: jest.fn().mockResolvedValue(2_000_000n),
      allowance: jest.fn((_owner: string, spender: string) =>
        Promise.resolve(spender === bridgeRouterAddress ? 3_000_000n : 2_000_000n)
      ),
    };
    mockProvider = {
      getBalance: jest.fn().mockResolvedValue(parseEther('0.25')),
    };
    mockWallet = {
      address: '0x9999999999999999999999999999999999999999',
    };

    jest.doMock('../../constants/evm', () => ({
      EVM_CONFIG: {
        confirmations: 1,
        rpcUrl: 'https://sepolia.example',
        bridgeApiBaseUrl,
        wunitAddress,
        bridgeRouterAddress,
        stablePoolAddress,
        usdcAddress,
        swapSlippageBps: 100,
        explorerBaseUrl: 'https://sepolia.etherscan.io',
      },
      EVM_DECIMALS: 6,
    }));
    jest.doMock('../evmWalletService', () => ({
      getSepoliaProvider: jest.fn(() => mockProvider),
      withSepoliaSigner: jest.fn((_accountIndex: number, callback: (wallet: typeof mockWallet, provider: typeof mockProvider) => unknown) => callback(mockWallet, mockProvider)),
    }));
    jest.doMock('../bridgeApiService', () => ({
      trackRedemption: jest.fn(),
    }));
    jest.doMock('ethers', () => {
      const actual = jest.requireActual('ethers');
      return {
        ...actual,
        Contract: jest.fn((address: string) => {
          if (address === stablePoolAddress) return mockPool;
          if (address === usdcAddress) return mockUsdc;
          if (address === wunitAddress) return mockWunit;
          throw new Error(`Unexpected contract address ${address}`);
        }),
      };
    });
    jest.doMock('../../utils/logger', () => ({
      logger: {
        debug: jest.fn(),
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
      },
    }));
  }

  beforeEach(() => {
    jest.resetModules();
  });

  it('reports unconfigured state without touching Sepolia when pool config is missing', async () => {
    jest.doMock('../../constants/evm', () => ({
      EVM_CONFIG: {
        confirmations: 1,
        rpcUrl: '',
        bridgeApiBaseUrl: '',
        wunitAddress: '',
        bridgeRouterAddress: '',
        stablePoolAddress: '',
        usdcAddress: '',
        swapSlippageBps: 100,
        explorerBaseUrl: 'https://sepolia.etherscan.io',
      },
      EVM_DECIMALS: 6,
    }));
    jest.doMock('../bridgeApiService', () => ({
      trackRedemption: jest.fn(),
    }));

    const { getUnitUsdcPoolDashboard } = require('../evmBridgeService');

    await expect(getUnitUsdcPoolDashboard(0)).resolves.toEqual(
      expect.objectContaining({
        status: 'unconfigured',
        reserves: null,
        quoteSamples: [],
        readiness: expect.objectContaining({
          poolContracts: false,
          bridgeContracts: false,
        }),
      })
    );
  });

  it('reports unconfigured state for malformed Sepolia pool addresses', async () => {
    const getSepoliaProvider = jest.fn();
    jest.doMock('../../constants/evm', () => ({
      EVM_CONFIG: {
        confirmations: 1,
        rpcUrl: 'https://sepolia.example',
        bridgeApiBaseUrl: 'https://bridge.example',
        wunitAddress: 'not-an-address',
        bridgeRouterAddress,
        stablePoolAddress,
        usdcAddress,
        swapSlippageBps: 100,
        explorerBaseUrl: 'https://sepolia.etherscan.io',
      },
      EVM_DECIMALS: 6,
    }));
    jest.doMock('../evmWalletService', () => ({
      getSepoliaProvider,
      withSepoliaSigner: jest.fn(),
    }));
    jest.doMock('../bridgeApiService', () => ({
      trackRedemption: jest.fn(),
    }));

    const { getUnitUsdcPoolDashboard } = require('../evmBridgeService');
    const dashboard = await getUnitUsdcPoolDashboard(0);

    expect(dashboard).toEqual(expect.objectContaining({
      status: 'unconfigured',
      readiness: expect.objectContaining({
        sepoliaRpc: true,
        bridgeApi: true,
        usdc: true,
        wunit: false,
        poolContracts: false,
        bridgeContracts: false,
      }),
    }));
    expect(getSepoliaProvider).not.toHaveBeenCalled();
  });

  it('loads reserves, quote impact, readiness, and wallet allowances', async () => {
    mockConfiguredPool();

    const { getUnitUsdcPoolDashboard } = require('../evmBridgeService');
    const dashboard = await getUnitUsdcPoolDashboard(2);

    expect(dashboard).toEqual(expect.objectContaining({
      status: 'ready',
      reserves: {
        wunit: '1000.0',
        usdc: '2000.0',
      },
      impliedUnitPriceUsdc: '2',
      imbalanceBps: 3333,
      maxInputAmount: '1000.0',
      error: null,
      readiness: expect.objectContaining({
        poolContracts: true,
        bridgeContracts: true,
      }),
      wallet: expect.objectContaining({
        address: mockWallet.address,
        eth: '0.25',
        usdc: '500.0',
        wunit: '2.0',
        stablePoolUsdcAllowance: '100.0',
        stablePoolWunitAllowance: '2.0',
        bridgeRouterWunitAllowance: '3.0',
        canSwapUsdcSample: true,
        canSwapUnitSample: true,
        canRedeemUnitSample: true,
      }),
    }));
    expect(dashboard.quoteSamples[0]).toEqual({
      amountIn: '1',
      unitToUsdcOut: '0.999',
      unitToUsdcImpactBps: 10,
      usdcToUnitOut: '0.998',
      usdcToUnitImpactBps: 20,
    });
    expect(mockPool.getBalances).toHaveBeenCalledTimes(1);
    expect(mockPool.quoteSwap).toHaveBeenCalledTimes(6);
  });

  it('reports degraded state when the pool is readable but bridge backend config is incomplete', async () => {
    mockConfiguredPool({ bridgeApiBaseUrl: '' });

    const { getUnitUsdcPoolDashboard } = require('../evmBridgeService');
    const dashboard = await getUnitUsdcPoolDashboard();

    expect(dashboard).toEqual(expect.objectContaining({
      status: 'degraded',
      error: 'Pool is readable, but full bridge/redemption config is incomplete.',
      readiness: expect.objectContaining({
        bridgeApi: false,
        poolContracts: true,
        bridgeContracts: false,
      }),
      reserves: {
        wunit: '1000.0',
        usdc: '2000.0',
      },
      wallet: null,
    }));
  });

  it('returns an error dashboard when pool reads fail', async () => {
    mockConfiguredPool();
    mockPool.getBalances.mockRejectedValueOnce(new Error('pool reverted'));

    const { getUnitUsdcPoolDashboard } = require('../evmBridgeService');

    await expect(getUnitUsdcPoolDashboard(0)).resolves.toEqual(
      expect.objectContaining({
        status: 'error',
        reserves: null,
        error: 'pool reverted',
      })
    );
  });
});

describe('evmBridgeService Sepolia token history', () => {
  const usdcAddress = '0x0000000000000000000000000000000000000001';
  const walletAddress = '0x2222222222222222222222222222222222222222';
  const otherAddress = '0x3333333333333333333333333333333333333333';
  const originalFetch = global.fetch;
  let mockTokenContract: {
    filters: {
      Transfer: jest.Mock;
    };
    queryFilter: jest.Mock;
  };
  let mockProvider: {
    getBlockNumber: jest.Mock;
    getBlock: jest.Mock;
  };

  beforeEach(() => {
    jest.resetModules();
    mockTokenContract = {
      filters: {
        Transfer: jest.fn((from: string | null, to: string | null) => ({ from, to })),
      },
      queryFilter: jest.fn((filter: { from: string | null; to: string | null }, fromBlock: number) => {
        if (fromBlock !== 200_000) {
          return Promise.resolve([]);
        }
        if (filter.to === walletAddress) {
          return Promise.resolve([
            {
              transactionHash: '0xin',
              blockNumber: 490_000,
              args: [otherAddress, walletAddress, 1_000_000n],
            },
            {
              transactionHash: '0xself',
              blockNumber: 491_000,
              args: [walletAddress, walletAddress, 500_000n],
            },
          ]);
        }
        if (filter.from === walletAddress) {
          return Promise.resolve([
            {
              transactionHash: '0xout',
              blockNumber: 495_000,
              args: [walletAddress, otherAddress, 2_000_000n],
            },
            {
              transactionHash: '0xself',
              blockNumber: 491_000,
              args: [walletAddress, walletAddress, 500_000n],
            },
          ]);
        }
        return Promise.resolve([]);
      }),
    };
    mockProvider = {
      getBlockNumber: jest.fn().mockResolvedValue(500_000),
      getBlock: jest.fn((blockNumber: number) => Promise.resolve({ timestamp: blockNumber + 10 })),
    };

    jest.doMock('../../constants/evm', () => ({
      EVM_CONFIG: {
        confirmations: 1,
        rpcUrl: 'https://sepolia.example',
        bridgeApiBaseUrl: 'https://bridge.example',
        wunitAddress: '0x0000000000000000000000000000000000000002',
        bridgeRouterAddress: '0x0000000000000000000000000000000000000004',
        stablePoolAddress: '0x0000000000000000000000000000000000000003',
        usdcAddress,
        swapSlippageBps: 100,
        explorerBaseUrl: 'https://sepolia.etherscan.io',
      },
      EVM_DECIMALS: 6,
    }));
    jest.doMock('../evmWalletService', () => ({
      getSepoliaProvider: jest.fn(() => mockProvider),
      withSepoliaSigner: jest.fn((_accountIndex: number, callback: (wallet: { address: string }, provider: typeof mockProvider) => unknown) =>
        callback({ address: walletAddress }, mockProvider)
      ),
    }));
    jest.doMock('../bridgeApiService', () => ({
      trackRedemption: jest.fn(),
    }));
    jest.doMock('ethers', () => {
      const actual = jest.requireActual('ethers');
      return {
        ...actual,
        Contract: jest.fn(() => mockTokenContract),
      };
    });
    jest.doMock('../../utils/logger', () => ({
      logger: {
        debug: jest.fn(),
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
      },
    }));
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('groups incoming and outgoing ERC-20 logs, preserves self transfers, and sorts by block time', async () => {
    const { fetchSepoliaTokenHistory } = require('../evmBridgeService');

    const history = await fetchSepoliaTokenHistory(0, 'USDC');

    expect(mockTokenContract.filters.Transfer).toHaveBeenCalledWith(null, walletAddress);
    expect(mockTokenContract.filters.Transfer).toHaveBeenCalledWith(walletAddress, null);
    expect(mockTokenContract.queryFilter).toHaveBeenCalledTimes(32);
    expect(mockProvider.getBlock).toHaveBeenCalledWith(490_000);
    expect(mockProvider.getBlock).toHaveBeenCalledWith(491_000);
    expect(mockProvider.getBlock).toHaveBeenCalledWith(495_000);
    expect(history).toEqual([
      {
        txid: '0xout',
        status: {
          confirmed: true,
          block_time: 495_010,
        },
        txData: {
          amount: 2,
          assetType: 'USDC',
          isSent: true,
          isReceived: false,
        },
      },
      {
        txid: '0xself',
        status: {
          confirmed: true,
          block_time: 491_010,
        },
        txData: {
          amount: 0.5,
          assetType: 'USDC',
          isSent: true,
          isReceived: true,
        },
      },
      {
        txid: '0xin',
        status: {
          confirmed: true,
          block_time: 490_010,
        },
        txData: {
          amount: 1,
          assetType: 'USDC',
          isSent: false,
          isReceived: true,
        },
      },
    ]);
  });

  it('fetches native Sepolia ETH transfers from Blockscout history', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({
        items: [
          {
            hash: '0xcontract',
            value: '0',
            status: 'ok',
            result: 'success',
            block_number: 501_000,
            timestamp: '2026-04-28T10:20:00.000000Z',
            from: { hash: walletAddress },
            to: { hash: usdcAddress },
          },
          {
            hash: '0xselfeth',
            value: '8333000000000000',
            status: 'ok',
            result: 'success',
            block_number: 500_999,
            timestamp: '2026-04-28T10:19:00.000000Z',
            from: { hash: walletAddress },
            to: { hash: walletAddress },
          },
          {
            hash: '0xineth',
            value: '50000000000000000',
            status: 'ok',
            result: 'success',
            block_number: 500_900,
            timestamp: '2026-04-28T10:00:00.000000Z',
            from: { hash: otherAddress },
            to: { hash: walletAddress },
          },
        ],
      }),
    }) as unknown as typeof fetch;

    const { fetchSepoliaEthHistory } = require('../evmBridgeService');

    const history = await fetchSepoliaEthHistory(0);

    expect(global.fetch).toHaveBeenCalledWith(
      'https://eth-sepolia.blockscout.com/api/v2/addresses/0x2222222222222222222222222222222222222222/transactions',
      expect.objectContaining({ method: 'GET' }),
    );
    expect(history).toEqual([
      {
        txid: '0xselfeth',
        status: {
          confirmed: true,
          block_time: Math.floor(Date.parse('2026-04-28T10:19:00.000000Z') / 1000),
        },
        txData: {
          amount: 0.008333,
          assetType: 'ETH',
          isSent: true,
          isReceived: true,
        },
      },
      {
        txid: '0xineth',
        status: {
          confirmed: true,
          block_time: Math.floor(Date.parse('2026-04-28T10:00:00.000000Z') / 1000),
        },
        txData: {
          amount: 0.05,
          assetType: 'ETH',
          isSent: false,
          isReceived: true,
        },
      },
    ]);
  });
});
