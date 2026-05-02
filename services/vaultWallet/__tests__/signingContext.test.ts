import { Buffer } from 'buffer';
import * as bitcoin from 'bitcoinjs-lib';
import { VaultAPI } from '@ducat-unit/client-sdk';
import {
  clearPendingVaultSigningOperation,
  getExpectedVaultPsbtTemplates,
  setPendingVaultSigningOperation,
} from '../signingContext';

const mockTestNetwork = {
  messagePrefix: '\x18Bitcoin Signed Message:\n',
  bech32: 'bcrt',
  bip32: {
    public: 0x043587cf,
    private: 0x04358394,
  },
  pubKeyHash: 111,
  scriptHash: 196,
  wif: 239,
};

jest.mock('@ducat-unit/client-sdk', () => ({
  VaultAPI: {
    open: {
      create_psbt1: jest.fn(),
      create_psbt2: jest.fn(),
    },
    borrow: {
      create_psbt1: jest.fn(),
      create_psbt2: jest.fn(),
    },
    repay: {
      create_psbt1: jest.fn(),
      create_psbt2: jest.fn(),
    },
    deposit: {
      create_psbt: jest.fn(),
    },
    withdraw: {
      create_psbt: jest.fn(),
    },
    repo: {
      create_psbt1: jest.fn(),
      create_psbt2: jest.fn(),
    },
  },
}));

jest.mock('../../../utils/bitcoin', () => ({
  MUTINYNET_NETWORK: mockTestNetwork,
}));

function createPsbtBase64({
  inputHashByte,
  inputIndex,
  inputSequence,
  inputValue,
  inputScriptByte,
  outputValue,
  outputScriptByte,
  version = 2,
  locktime = 0,
}: {
  inputHashByte: number;
  inputIndex: number;
  inputSequence: number;
  inputValue: bigint;
  inputScriptByte: number;
  outputValue: bigint;
  outputScriptByte: number;
  version?: number;
  locktime?: number;
}): string {
  const psbt = new bitcoin.Psbt({ network: mockTestNetwork });
  psbt.setVersion(version);
  psbt.setLocktime(locktime);
  psbt.addInput({
    hash: Buffer.alloc(32, inputHashByte).toString('hex'),
    index: inputIndex,
    sequence: inputSequence,
    witnessUtxo: {
      script: Buffer.from(`0014${inputScriptByte.toString(16).padStart(2, '0').repeat(20)}`, 'hex'),
      value: inputValue,
    },
  });
  psbt.addOutput({
    script: Buffer.from(`0014${outputScriptByte.toString(16).padStart(2, '0').repeat(20)}`, 'hex'),
    value: outputValue,
  });
  return psbt.toBase64();
}

const PSBT_A = createPsbtBase64({
  inputHashByte: 0x11,
  inputIndex: 1,
  inputSequence: 0xfffffffd,
  inputValue: 12_345n,
  inputScriptByte: 0xaa,
  outputValue: 10_000n,
  outputScriptByte: 0xbb,
  locktime: 7,
});

const PSBT_B = createPsbtBase64({
  inputHashByte: 0x22,
  inputIndex: 2,
  inputSequence: 0xfffffffc,
  inputValue: 22_222n,
  inputScriptByte: 0xcc,
  outputValue: 20_000n,
  outputScriptByte: 0xdd,
  version: 1,
});

const mockOpenCreatePsbt1 = VaultAPI.open.create_psbt1 as jest.Mock;
const mockOpenCreatePsbt2 = VaultAPI.open.create_psbt2 as jest.Mock;
const mockBorrowCreatePsbt1 = VaultAPI.borrow.create_psbt1 as jest.Mock;
const mockBorrowCreatePsbt2 = VaultAPI.borrow.create_psbt2 as jest.Mock;
const mockRepayCreatePsbt1 = VaultAPI.repay.create_psbt1 as jest.Mock;
const mockRepayCreatePsbt2 = VaultAPI.repay.create_psbt2 as jest.Mock;
const mockDepositCreatePsbt = VaultAPI.deposit.create_psbt as jest.Mock;
const mockWithdrawCreatePsbt = VaultAPI.withdraw.create_psbt as jest.Mock;
const mockRepoCreatePsbt1 = VaultAPI.repo.create_psbt1 as jest.Mock;
const mockRepoCreatePsbt2 = VaultAPI.repo.create_psbt2 as jest.Mock;

describe('vault signing context', () => {
  const ctx = { ctx: true };
  const liquidCtx = { liquid: true };
  const vaultCtx = { vault: true };
  const satsUtxos = [{ txid: 'sats', vout: 0, value: 50_000 }];
  const unitUtxos = [{ txid: 'unit', vout: 1, value: 10_000 }];

  beforeEach(() => {
    jest.clearAllMocks();
    clearPendingVaultSigningOperation();

    mockOpenCreatePsbt1.mockReturnValue(PSBT_A);
    mockOpenCreatePsbt2.mockReturnValue(PSBT_B);
    mockBorrowCreatePsbt1.mockReturnValue(PSBT_A);
    mockBorrowCreatePsbt2.mockReturnValue(PSBT_B);
    mockRepayCreatePsbt1.mockReturnValue(PSBT_A);
    mockRepayCreatePsbt2.mockReturnValue(PSBT_B);
    mockDepositCreatePsbt.mockReturnValue(PSBT_A);
    mockWithdrawCreatePsbt.mockReturnValue(PSBT_A);
    mockRepoCreatePsbt1.mockReturnValue(PSBT_A);
    mockRepoCreatePsbt2.mockReturnValue(PSBT_B);
  });

  afterEach(() => {
    clearPendingVaultSigningOperation();
  });

  it('throws a security error when no signing operation is pending', () => {
    expect(() => getExpectedVaultPsbtTemplates()).toThrow(
      'SECURITY: Missing pending vault signing context',
    );
  });

  it('extracts stable PSBT templates without private signing material', () => {
    setPendingVaultSigningOperation({
      action: 'deposit',
      ctx: ctx as never,
      satsUtxos: satsUtxos as never,
    });

    expect(getExpectedVaultPsbtTemplates()).toEqual([
      {
        version: 2,
        locktime: 7,
        inputs: [
          {
            hashHex: '11'.repeat(32),
            index: 1,
            scriptHex: `0014${'aa'.repeat(20)}`,
            sequence: 0xfffffffd,
            value: '12345',
          },
        ],
        outputs: [
          {
            scriptHex: `0014${'bb'.repeat(20)}`,
            value: '10000',
          },
        ],
      },
    ]);
  });

  it('routes open operations through both SDK PSBT builders', () => {
    setPendingVaultSigningOperation({
      action: 'open',
      ctx: ctx as never,
      satsUtxos: satsUtxos as never,
    });

    const templates = getExpectedVaultPsbtTemplates();

    expect(templates).toHaveLength(2);
    expect(mockOpenCreatePsbt1).toHaveBeenCalledWith(ctx, satsUtxos);
    expect(mockOpenCreatePsbt2).toHaveBeenCalledWith(ctx, PSBT_A);
  });

  it('routes borrow operations through both SDK PSBT builders', () => {
    setPendingVaultSigningOperation({
      action: 'borrow',
      ctx: ctx as never,
      satsUtxos: satsUtxos as never,
    });

    const templates = getExpectedVaultPsbtTemplates();

    expect(templates).toHaveLength(2);
    expect(mockBorrowCreatePsbt1).toHaveBeenCalledWith(ctx, satsUtxos);
    expect(mockBorrowCreatePsbt2).toHaveBeenCalledWith(ctx, PSBT_A);
  });

  it('routes repay operations with sats and UNIT UTXOs', () => {
    setPendingVaultSigningOperation({
      action: 'repay',
      ctx: ctx as never,
      satsUtxos: satsUtxos as never,
      unitUtxos: unitUtxos as never,
    });

    const templates = getExpectedVaultPsbtTemplates();

    expect(templates).toHaveLength(2);
    expect(mockRepayCreatePsbt1).toHaveBeenCalledWith(ctx, satsUtxos, unitUtxos);
    expect(mockRepayCreatePsbt2).toHaveBeenCalledWith(ctx, PSBT_A);
  });

  it('routes deposit operations through the single deposit PSBT builder', () => {
    setPendingVaultSigningOperation({
      action: 'deposit',
      ctx: ctx as never,
      satsUtxos: satsUtxos as never,
    });

    const templates = getExpectedVaultPsbtTemplates();

    expect(templates).toHaveLength(1);
    expect(mockDepositCreatePsbt).toHaveBeenCalledWith(ctx, satsUtxos);
  });

  it('routes withdraw operations through the single withdraw PSBT builder', () => {
    setPendingVaultSigningOperation({
      action: 'withdraw',
      ctx: ctx as never,
    });

    const templates = getExpectedVaultPsbtTemplates();

    expect(templates).toHaveLength(1);
    expect(mockWithdrawCreatePsbt).toHaveBeenCalledWith(ctx);
  });

  it('routes repo operations through liquidation and vault contexts', () => {
    setPendingVaultSigningOperation({
      action: 'repo',
      liquidCtx: liquidCtx as never,
      vaultCtx: vaultCtx as never,
      satsUtxos: satsUtxos as never,
    });

    const templates = getExpectedVaultPsbtTemplates();

    expect(templates).toHaveLength(2);
    expect(mockRepoCreatePsbt1).toHaveBeenCalledWith(liquidCtx, vaultCtx, satsUtxos);
    expect(mockRepoCreatePsbt2).toHaveBeenCalledWith(liquidCtx, vaultCtx, PSBT_A);
  });
});
