import * as bitcoin from 'bitcoinjs-lib';
import { getWithRetry, postJSON } from '../../../utils/apiClient';
import { broadcastTransaction } from '../../transactionBroadcastService';
import { resetSwapDiagnosticsStore, useSwapDiagnosticsStore } from '../../../stores/swapDiagnosticsStore';
import {
  broadcastSwapTx,
  calculateSwapBtcAmount,
  createSwapPayload,
  fetchSwapPsbt,
  finalizeSwapPsbt,
  toSwapUtxo,
  waitForMempool,
} from '../swapService';
import { FAUCET_SWAP_URL } from '../constants';

jest.mock('../../../utils/apiClient', () => ({
  getWithRetry: jest.fn(),
  postJSON: jest.fn(),
}));

jest.mock('../../transactionBroadcastService', () => ({
  broadcastTransaction: jest.fn(),
}));

jest.mock('../../../utils/logger', () => ({
  logger: {
    debug: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
  },
}));

describe('liquidation swapService', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    jest.clearAllMocks();
    resetSwapDiagnosticsStore();
    global.fetch = jest.fn();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('converts SDK UTXOs into faucet swap UTXOs', () => {
    expect(toSwapUtxo({ txid: 'abc', vout: 2, value: 12345 } as never)).toEqual({
      tx: 'abc',
      output: 2,
      value: 12345,
    });
  });

  it('builds swap payloads with change UTXO first and UNIT cents rounded', () => {
    const payload = createSwapPayload({
      changeUtxo: { txid: 'change', vout: 0, value: 100_000 } as never,
      extraUtxos: [
        { txid: 'extra-1', vout: 1, value: 50_000 },
        { txid: 'extra-2', vout: 2, value: 75_000 },
      ] as never,
      swapBtcAmount: 0.00123,
      swapClaimedUnit: 42.456,
      btcPrice: 65000,
      paymentAddress: 'tb1qpay',
      ordinalsAddress: 'tb1pord',
      vaultTxId: 'vault-txid',
    });

    expect(payload).toEqual({
      utxos: [
        { tx: 'change', output: 0, value: 100_000 },
        { tx: 'extra-1', output: 1, value: 50_000 },
        { tx: 'extra-2', output: 2, value: 75_000 },
      ],
      amt_to_transfer: 0.00123,
      unit_amt: 4246,
      payment_address: 'tb1qpay',
      ordinals_address: 'tb1pord',
      btc_price: 65000,
      vault_id: 'vault-txid',
    });
  });

  it('calculates BTC swap amount with protocol spread and 8-decimal precision', () => {
    expect(calculateSwapBtcAmount(1234.56, 65432.1)).toBe(0.01924516);
  });

  it('returns swap PSBT data from a successful faucet response', async () => {
    const data = {
      psbt: 'psbt-base64',
      message: 'ok',
      inputs: {},
      outputs: {},
      user_input_indices: [0],
    };
    (postJSON as jest.Mock).mockResolvedValue({ success: true, data });

    const result = await fetchSwapPsbt({
      utxos: [{ tx: 'txid', output: 0, value: 1000 }],
      amt_to_transfer: 0.001,
      unit_amt: 100,
      payment_address: 'tb1qpay',
      ordinals_address: 'tb1pord',
      btc_price: 65000,
      vault_id: 'vault',
    });

    expect(postJSON).toHaveBeenCalledWith(
      FAUCET_SWAP_URL,
      expect.objectContaining({ vault_id: 'vault' }),
      expect.objectContaining({ description: 'Fetch swap PSBT', timeout: 15000 }),
    );
    expect(result).toBe(data);
  });

  it('returns null when the faucet rejects or throws', async () => {
    (postJSON as jest.Mock)
      .mockResolvedValueOnce({ success: false, error: 'no liquidity' })
      .mockRejectedValueOnce(new Error('network down'));

    const payload = {
      utxos: [],
      amt_to_transfer: 0,
      unit_amt: 0,
      payment_address: 'tb1qpay',
      ordinals_address: 'tb1pord',
      btc_price: 65000,
      vault_id: 'vault',
    };

    await expect(fetchSwapPsbt(payload)).resolves.toBeNull();
    await expect(fetchSwapPsbt(payload)).resolves.toBeNull();
  });

  it('broadcasts finalized swap transactions and absorbs broadcast errors', async () => {
    (broadcastTransaction as jest.Mock)
      .mockResolvedValueOnce('txid-123')
      .mockResolvedValueOnce(null)
      .mockRejectedValueOnce(new Error('broadcast failed'));

    await expect(broadcastSwapTx('txhex')).resolves.toBe('txid-123');
    await expect(broadcastSwapTx('txhex')).resolves.toBeNull();
    await expect(broadcastSwapTx('txhex')).resolves.toBeNull();
  });

  it('finalizes signed swap PSBTs and validates the expected payout address', () => {
    const finalizeAllInputs = jest.fn();
    const tx = {
      outs: [{ script: Buffer.from('0014', 'hex') }],
      toHex: jest.fn(() => 'raw-swap-txhex'),
    };
    const fromBase64Spy = jest.spyOn(bitcoin.Psbt, 'fromBase64').mockReturnValue({
      finalizeAllInputs,
      extractTransaction: jest.fn(() => tx),
    } as never);
    const fromOutputScriptSpy = jest
      .spyOn(bitcoin.address, 'fromOutputScript')
      .mockReturnValue('tb1qexpected');

    expect(finalizeSwapPsbt('signed-psbt', 'tb1qexpected')).toBe('raw-swap-txhex');
    expect(fromBase64Spy).toHaveBeenCalledWith('signed-psbt', expect.any(Object));
    expect(finalizeAllInputs).toHaveBeenCalled();
    expect(fromOutputScriptSpy).toHaveBeenCalledWith(tx.outs[0].script, expect.any(Object));

    fromBase64Spy.mockRestore();
    fromOutputScriptSpy.mockRestore();
  });

  it('rejects finalized swap PSBTs that do not pay the expected address', () => {
    const fromBase64Spy = jest.spyOn(bitcoin.Psbt, 'fromBase64').mockReturnValue({
      finalizeAllInputs: jest.fn(),
      extractTransaction: jest.fn(() => ({
        outs: [
          { script: Buffer.from('0014', 'hex') },
          { script: Buffer.from('6a00', 'hex') },
        ],
        toHex: jest.fn(() => 'raw-swap-txhex'),
      })),
    } as never);
    const fromOutputScriptSpy = jest
      .spyOn(bitcoin.address, 'fromOutputScript')
      .mockImplementation((script: Uint8Array) => {
        if (script[0] === 0x6a) {
          throw new Error('op return');
        }
        return 'tb1qwrong';
      });

    expect(() => finalizeSwapPsbt('signed-psbt', 'tb1qexpected')).toThrow(
      'Swap PSBT does not pay to expected address',
    );

    fromBase64Spy.mockRestore();
    fromOutputScriptSpy.mockRestore();
  });

  it('records a successful mempool poll', async () => {
    (getWithRetry as jest.Mock).mockResolvedValue({ ok: true, status: 200 });

    await expect(waitForMempool('txid-success', 2, 0)).resolves.toBe(true);

    expect(getWithRetry).toHaveBeenCalledWith(
      expect.stringContaining('/tx/txid-success'),
      expect.objectContaining({ timeout: 8000 }),
    );
    expect(useSwapDiagnosticsStore.getState().polls[0]).toMatchObject({
      id: 'liquidation-mempool:txid-success',
      status: 'success',
      attempts: 1,
      lastStatus: 'found',
    });
  });

  it('records timeout and network-error state while waiting for mempool visibility', async () => {
    (getWithRetry as jest.Mock)
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce({ ok: false, status: 404 });

    await expect(waitForMempool('txid-timeout', 2, 0)).resolves.toBe(false);

    expect(useSwapDiagnosticsStore.getState().polls[0]).toMatchObject({
      id: 'liquidation-mempool:txid-timeout',
      status: 'timeout',
      attempts: 2,
      lastStatus: 'http_404',
    });
  });
});
