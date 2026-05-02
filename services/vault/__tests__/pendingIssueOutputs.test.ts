import { Buffer } from 'buffer';
import * as bitcoin from 'bitcoinjs-lib';
import {
  extractVaultFinalizationPendingData,
  extractVaultIssuePendingData,
} from '../pendingIssueOutputs';
import { MUTINYNET_NETWORK } from '../../../utils/bitcoin';
import { decodeRunestone } from '../../../utils/runestoneEncoder';

jest.mock('../../../utils/constants', () => ({
  RUNES_CONFIG: {
    DUCAT_UNIT_RUNE_ID: {
      block: 123n,
      tx: 456n,
    },
  },
}));

jest.mock('../../../utils/runestoneEncoder', () => ({
  decodeRunestone: jest.fn(),
}));

const mockDecodeRunestone = decodeRunestone as jest.MockedFunction<typeof decodeRunestone>;

function createAddressPair(): {
  segwitAddress: string;
  segwitScript: Buffer;
  taprootAddress: string;
  taprootScript: Buffer;
} {
  const segwitScript = Buffer.from(`0014${'11'.repeat(20)}`, 'hex');
  const taprootScript = Buffer.from(`5120${'22'.repeat(32)}`, 'hex');

  return {
    segwitAddress: bitcoin.address.fromOutputScript(segwitScript, MUTINYNET_NETWORK),
    segwitScript,
    taprootAddress: bitcoin.address.fromOutputScript(taprootScript, MUTINYNET_NETWORK),
    taprootScript,
  };
}

function createVaultTxHex({
  segwitScript,
  taprootScript,
  includeRunestone = true,
}: {
  segwitScript: Buffer;
  taprootScript: Buffer;
  includeRunestone?: boolean;
}): { txhex: string; pendingParentTxid: string; confirmedParentTxid: string } {
  const pendingParentHash = Buffer.alloc(32, 0x01);
  const confirmedParentHash = Buffer.alloc(32, 0x02);
  const tx = new bitcoin.Transaction();

  tx.version = 2;
  tx.addInput(pendingParentHash, 3, 0xfffffffd);
  tx.addInput(confirmedParentHash, 4, 0xfffffffc);
  tx.addOutput(segwitScript, 5_000n);
  tx.addOutput(Buffer.from(`0014${'33'.repeat(20)}`, 'hex'), 9_999n);
  tx.addOutput(taprootScript, 7_000n);
  if (includeRunestone) {
    tx.addOutput(Buffer.from('6a0100', 'hex'), 0n);
  }

  return {
    txhex: tx.toHex(),
    pendingParentTxid: Buffer.from(pendingParentHash).reverse().toString('hex'),
    confirmedParentTxid: Buffer.from(confirmedParentHash).reverse().toString('hex'),
  };
}

describe('pending vault issue outputs', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockDecodeRunestone.mockReturnValue({
      edicts: [
        {
          id: {
            block: 123n,
            tx: 456n,
          },
          output: 0n,
          amount: 250n,
        },
        {
          id: {
            block: 123n,
            tx: 456n,
          },
          output: 0n,
          amount: 50n,
        },
        {
          id: {
            block: 999n,
            tx: 456n,
          },
          output: 2n,
          amount: 1_000n,
        },
      ],
    });
  });

  it('returns no pending data when the request or wallet is incomplete', () => {
    const wallet = createAddressPair();

    expect(extractVaultIssuePendingData({}, wallet, {})).toEqual({
      outputs: [],
      spentInputs: [],
      parentTxid: null,
    });

    expect(
      extractVaultIssuePendingData(
        { issue_txhex: '00' },
        { segwitAddress: wallet.segwitAddress },
        {},
      ),
    ).toEqual({
      outputs: [],
      spentInputs: [],
      parentTxid: null,
    });
  });

  it('extracts wallet outputs, UNIT rune amounts, spent inputs, and pending parent txid', () => {
    const wallet = createAddressPair();
    const { txhex, pendingParentTxid, confirmedParentTxid } = createVaultTxHex(wallet);

    const result = extractVaultIssuePendingData(
      { issue_txhex: txhex },
      wallet,
      {
        [pendingParentTxid]: { status: 'pending' },
        [confirmedParentTxid]: { status: 'confirmed' },
      },
    );

    expect(result).toEqual({
      outputs: [
        {
          address: wallet.segwitAddress,
          value: 5_000,
          vout: 0,
          runeAmount: 300,
        },
        {
          address: wallet.taprootAddress,
          value: 7_000,
          vout: 2,
        },
      ],
      spentInputs: [
        {
          txid: pendingParentTxid,
          vout: 3,
        },
        {
          txid: confirmedParentTxid,
          vout: 4,
        },
      ],
      parentTxid: pendingParentTxid,
    });
  });

  it('uses vault_txhex for finalization pending data', () => {
    const wallet = createAddressPair();
    const { txhex } = createVaultTxHex(wallet);

    const result = extractVaultFinalizationPendingData(
      {
        issue_txhex: createVaultTxHex(wallet).txhex,
        vault_txhex: txhex,
      },
      wallet,
      {},
    );

    expect(result.outputs).toEqual([
      {
        address: wallet.segwitAddress,
        value: 5_000,
        vout: 0,
        runeAmount: 300,
      },
      {
        address: wallet.taprootAddress,
        value: 7_000,
        vout: 2,
      },
    ]);
  });

  it('handles transactions without a runestone as plain BTC pending outputs', () => {
    const wallet = createAddressPair();
    const { txhex } = createVaultTxHex({ ...wallet, includeRunestone: false });

    const result = extractVaultIssuePendingData({ issue_txhex: txhex }, wallet, {});

    expect(mockDecodeRunestone).not.toHaveBeenCalled();
    expect(result.outputs).toEqual([
      {
        address: wallet.segwitAddress,
        value: 5_000,
        vout: 0,
      },
      {
        address: wallet.taprootAddress,
        value: 7_000,
        vout: 2,
      },
    ]);
  });

  it('ignores malformed runestone payloads', () => {
    const wallet = createAddressPair();
    const { txhex } = createVaultTxHex(wallet);
    mockDecodeRunestone.mockReturnValueOnce(null);

    const result = extractVaultIssuePendingData({ issue_txhex: txhex }, wallet, {});

    expect(result.outputs).toEqual([
      {
        address: wallet.segwitAddress,
        value: 5_000,
        vout: 0,
      },
      {
        address: wallet.taprootAddress,
        value: 7_000,
        vout: 2,
      },
    ]);
  });
});
