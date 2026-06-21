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
  runestoneScript = Buffer.from('6a0100', 'hex'),
}: {
  segwitScript: Buffer;
  taprootScript: Buffer;
  includeRunestone?: boolean;
  runestoneScript?: Buffer;
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
    tx.addOutput(runestoneScript, 0n);
  }

  return {
    txhex: tx.toHex(),
    pendingParentTxid: Buffer.from(pendingParentHash).reverse().toString('hex'),
    confirmedParentTxid: Buffer.from(confirmedParentHash).reverse().toString('hex'),
  };
}

function createVaultPsbtBase64({
  segwitScript,
  taprootScript,
  includeRunestone = true,
}: {
  segwitScript: Buffer;
  taprootScript: Buffer;
  includeRunestone?: boolean;
}): { psbt: string; pendingParentTxid: string; confirmedParentTxid: string } {
  const pendingParentTxid = Buffer.from(Array.from({ length: 32 }, (_, index) => index)).toString(
    'hex'
  );
  const confirmedParentTxid = Buffer.from(
    Array.from({ length: 32 }, (_, index) => 0xff - index)
  ).toString('hex');
  const psbt = new bitcoin.Psbt({ network: MUTINYNET_NETWORK });

  psbt.addInput({
    hash: pendingParentTxid,
    index: 3,
    witnessUtxo: {
      script: segwitScript,
      value: 10_000n,
    },
  });
  psbt.addInput({
    hash: confirmedParentTxid,
    index: 4,
    witnessUtxo: {
      script: taprootScript,
      value: 20_000n,
    },
  });
  psbt.addOutput({
    script: segwitScript,
    value: 5_000n,
  });
  psbt.addOutput({
    script: Buffer.from(`0014${'33'.repeat(20)}`, 'hex'),
    value: 9_999n,
  });
  psbt.addOutput({
    script: taprootScript,
    value: 7_000n,
  });
  if (includeRunestone) {
    psbt.addOutput({
      script: Buffer.from('6a0100', 'hex'),
      value: 0n,
    });
  }

  return {
    psbt: psbt.toBase64(),
    pendingParentTxid,
    confirmedParentTxid,
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

  it('extracts pending data from issue_psbt when issue_txhex is absent', () => {
    const wallet = createAddressPair();
    const { psbt, pendingParentTxid, confirmedParentTxid } = createVaultPsbtBase64(wallet);

    const result = extractVaultIssuePendingData(
      { issue_psbt: psbt },
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

  it('uses vault_psbt for finalization pending data when vault_txhex is absent', () => {
    const wallet = createAddressPair();
    const { psbt } = createVaultPsbtBase64(wallet);

    const result = extractVaultFinalizationPendingData(
      {
        vault_psbt: psbt,
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

  it('applies the expected issued UNIT amount to the taproot finalization output when the validator metadata is non-standard', () => {
    const wallet = createAddressPair();
    const nonStandardValidatorMetadata = Buffer.from(
      '6a584c690101000001d5246a37cf7601000000fac100007eca296ac9a209c952dca106221a24b2dc08a84c4473b3b1d994cea4e1b9d5c378fe335a40e29d8d10fe5563f8e4fad4789c15bfa0841c5ad799b22ac666b2f7be769c12f4d6be459dbcef8bf0020d4ac7d86cb3cb75',
      'hex'
    );
    const { txhex } = createVaultTxHex({
      ...wallet,
      runestoneScript: nonStandardValidatorMetadata,
    });
    mockDecodeRunestone.mockReturnValueOnce(null);

    const result = extractVaultFinalizationPendingData(
      {
        vault_txhex: txhex,
      },
      wallet,
      {},
      100
    );

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
        runeAmount: 100,
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
