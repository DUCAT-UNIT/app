import { Buffer } from 'buffer';
import * as bitcoin from 'bitcoinjs-lib';
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

describe('vault signing context', () => {
  const ctx = { ctx: true };
  const liquidCtx = { liquid: true };
  const vaultCtx = { vault: true, __create_psbts: jest.fn(() => [PSBT_A]) };
  const satsUtxos = [{ txid: 'sats', vout: 0, value: 50_000 }];
  const unitUtxos = [{ txid: 'unit', vout: 1, value: 10_000 }];

  beforeEach(() => {
    jest.clearAllMocks();
    clearPendingVaultSigningOperation();
    vaultCtx.__create_psbts.mockReturnValue([PSBT_A]);
  });

  afterEach(() => {
    clearPendingVaultSigningOperation();
  });

  it('throws a security error when no signing operation is pending', () => {
    expect(() => getExpectedVaultPsbtTemplates(PSBT_A)).toThrow(
      'SECURITY: Missing pending vault signing context',
    );
  });

  it('extracts stable PSBT templates without private signing material', () => {
    setPendingVaultSigningOperation({
      action: 'deposit',
      ctx: ctx as never,
      satsUtxos: satsUtxos as never,
    });

    expect(getExpectedVaultPsbtTemplates(PSBT_A)).toEqual([
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

  it('uses the supplied open PSBT templates without SDK rebuilds', () => {
    setPendingVaultSigningOperation({
      action: 'open',
      ctx: ctx as never,
      satsUtxos: satsUtxos as never,
    });

    const templates = getExpectedVaultPsbtTemplates([PSBT_A, PSBT_B]);

    expect(templates).toHaveLength(2);
    expect(templates[0].inputs[0].hashHex).toBe('11'.repeat(32));
    expect(templates[1].inputs[0].hashHex).toBe('22'.repeat(32));
  });

  it('uses the supplied borrow PSBT templates without SDK rebuilds', () => {
    setPendingVaultSigningOperation({
      action: 'borrow',
      ctx: ctx as never,
      satsUtxos: satsUtxos as never,
    });

    const templates = getExpectedVaultPsbtTemplates([PSBT_A, PSBT_B]);

    expect(templates).toHaveLength(2);
  });

  it('uses the supplied repay PSBT templates without SDK rebuilds', () => {
    setPendingVaultSigningOperation({
      action: 'repay',
      ctx: ctx as never,
      satsUtxos: satsUtxos as never,
      unitUtxos: unitUtxos as never,
    });

    const templates = getExpectedVaultPsbtTemplates([PSBT_A, PSBT_B]);

    expect(templates).toHaveLength(2);
  });

  it('uses the supplied deposit PSBT template without SDK rebuilds', () => {
    setPendingVaultSigningOperation({
      action: 'deposit',
      ctx: ctx as never,
      satsUtxos: satsUtxos as never,
    });

    const templates = getExpectedVaultPsbtTemplates(PSBT_A);

    expect(templates).toHaveLength(1);
  });

  it('does not call compat deposit replay builders when a PSBT is supplied', () => {
    const compatCtx = { ...ctx, __create_psbts: jest.fn(() => [PSBT_A]) };
    setPendingVaultSigningOperation({
      action: 'deposit',
      ctx: compatCtx as never,
      satsUtxos: satsUtxos as never,
    });

    const templates = getExpectedVaultPsbtTemplates(PSBT_A);

    expect(templates).toHaveLength(1);
    expect(compatCtx.__create_psbts).not.toHaveBeenCalled();
  });

  it('uses the supplied withdraw PSBT template without SDK rebuilds', () => {
    setPendingVaultSigningOperation({
      action: 'withdraw',
      ctx: ctx as never,
    });

    const templates = getExpectedVaultPsbtTemplates(PSBT_A);

    expect(templates).toHaveLength(1);
  });

  it('does not call compat withdraw replay builders when a PSBT is supplied', () => {
    const compatCtx = { ...ctx, __create_psbts: jest.fn(() => [PSBT_A]) };
    setPendingVaultSigningOperation({
      action: 'withdraw',
      ctx: compatCtx as never,
    });

    const templates = getExpectedVaultPsbtTemplates(PSBT_A);

    expect(templates).toHaveLength(1);
    expect(compatCtx.__create_psbts).not.toHaveBeenCalled();
  });

  it('uses the supplied trim PSBT template without SDK rebuilds', () => {
    setPendingVaultSigningOperation({
      action: 'trim',
      ctx: ctx as never,
      unsignedPsbt: PSBT_A,
    });

    const templates = getExpectedVaultPsbtTemplates(PSBT_A);

    expect(templates).toHaveLength(1);
  });

  it('routes repo operations through the exact unsigned action PSBT', () => {
    const repoLiquidCtx = { ...liquidCtx, liquid_vaults: [{ vault: 1 }] };
    setPendingVaultSigningOperation({
      action: 'repo',
      liquidCtx: repoLiquidCtx as never,
      vaultCtx: vaultCtx as never,
      satsUtxos: satsUtxos as never,
      unsignedPsbt: PSBT_A,
    });

    const templates = getExpectedVaultPsbtTemplates(PSBT_A);

    expect(templates).toHaveLength(1);
    expect(vaultCtx.__create_psbts).not.toHaveBeenCalled();
  });
});
