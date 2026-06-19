import * as bitcoin from 'bitcoinjs-lib';
import type { PendingTransactionOutput } from '../../stores/pendingTransactionsStore';
import { RUNES_CONFIG } from '../../utils/constants';
import { MUTINYNET_NETWORK } from '../../utils/bitcoin';
import { decodeRunestone } from '../../utils/runestoneEncoder';

interface VaultIssueEdict {
  id: {
    block: bigint;
    tx: bigint;
  };
  amount: bigint;
  output: bigint;
}

interface VaultIssueRunestone {
  edicts?: VaultIssueEdict[];
}

interface WalletLike {
  segwitAddress?: string;
  taprootAddress?: string;
}

interface PendingTransactionLike {
  status: string;
}

interface VaultIssueRequestLike {
  issue_txhex?: string;
  issue_psbt?: string;
  repay_txhex?: string;
  repay_psbt?: string;
  vault_txhex?: string;
  vault_psbt?: string;
}

export interface VaultIssuePendingData {
  outputs: PendingTransactionOutput[];
  spentInputs: Array<{ txid: string; vout: number }>;
  parentTxid: string | null;
}

interface ExtractedTxInput {
  txid: string;
  vout: number;
}

interface ExtractedTxOutput {
  script: Buffer;
  value: number;
}

interface ExtractedTxData {
  inputs: ExtractedTxInput[];
  outputs: ExtractedTxOutput[];
}

function getRuneAmountsByOutput(outputs: ExtractedTxOutput[]): Map<number, number> {
  const runeAmounts = new Map<number, number>();
  const runestoneOutput = outputs.find((output) => output.script[0] === 0x6a);

  if (!runestoneOutput) {
    return runeAmounts;
  }

  const decoded = decodeRunestone(Buffer.from(runestoneOutput.script)) as VaultIssueRunestone | null;
  if (!decoded?.edicts?.length) {
    return runeAmounts;
  }

  decoded.edicts.forEach((edict) => {
    if (
      edict.id.block !== RUNES_CONFIG.DUCAT_UNIT_RUNE_ID.block ||
      edict.id.tx !== RUNES_CONFIG.DUCAT_UNIT_RUNE_ID.tx
    ) {
      return;
    }

    const outputIndex = Number(edict.output);
    const amount = Number(edict.amount);
    runeAmounts.set(outputIndex, (runeAmounts.get(outputIndex) || 0) + amount);
  });

  return runeAmounts;
}

function txInputToOutpoint(input: bitcoin.Transaction['ins'][number]): ExtractedTxInput {
  return {
    txid: Buffer.from(input.hash).reverse().toString('hex'),
    vout: input.index,
  };
}

function extractFromTransaction(tx: bitcoin.Transaction): ExtractedTxData {
  return {
    inputs: tx.ins.map(txInputToOutpoint),
    outputs: tx.outs.map((output) => ({
      script: Buffer.from(output.script),
      value: Number(output.value),
    })),
  };
}

function extractFromPsbt(psbtBase64: string): ExtractedTxData {
  const psbt = bitcoin.Psbt.fromBase64(psbtBase64, { network: MUTINYNET_NETWORK });

  try {
    return extractFromTransaction(psbt.extractTransaction(true));
  } catch {
    return {
      inputs: psbt.txInputs.map((input) => ({
        txid: Buffer.from(input.hash).reverse().toString('hex'),
        vout: input.index,
      })),
      outputs: psbt.txOutputs.map((output) => ({
        script: Buffer.from(output.script),
        value: Number(output.value),
      })),
    };
  }
}

function extractPendingSource(
  txhex: string | undefined,
  psbtBase64: string | undefined
): ExtractedTxData | null {
  if (txhex) {
    return extractFromTransaction(bitcoin.Transaction.fromHex(txhex));
  }

  if (psbtBase64) {
    return extractFromPsbt(psbtBase64);
  }

  return null;
}

function extractPendingTxData(
  txhex: string | undefined,
  psbtBase64: string | undefined,
  wallet: WalletLike | null,
  pendingTransactions: Record<string, PendingTransactionLike>,
): VaultIssuePendingData {
  if (!wallet?.segwitAddress || !wallet?.taprootAddress) {
    return {
      outputs: [],
      spentInputs: [],
      parentTxid: null,
    };
  }

  const txData = extractPendingSource(txhex, psbtBase64);
  if (!txData) {
    return {
      outputs: [],
      spentInputs: [],
      parentTxid: null,
    };
  }

  const runeAmounts = getRuneAmountsByOutput(txData.outputs);
  const outputs: PendingTransactionOutput[] = [];
  const spentInputs: Array<{ txid: string; vout: number }> = [];
  let parentTxid: string | null = null;

  txData.inputs.forEach((spentInput) => {
    spentInputs.push(spentInput);

    if (!parentTxid && pendingTransactions[spentInput.txid]?.status === 'pending') {
      parentTxid = spentInput.txid;
    }
  });

  txData.outputs.forEach((output, vout) => {
    try {
      const address = bitcoin.address.fromOutputScript(output.script, MUTINYNET_NETWORK);
      const isWalletOutput = address === wallet.segwitAddress || address === wallet.taprootAddress;

      if (!isWalletOutput) {
        return;
      }

      const pendingOutput: PendingTransactionOutput = {
        address,
        value: Number(output.value),
        vout,
      };

      const runeAmount = runeAmounts.get(vout);
      if (runeAmount && runeAmount > 0) {
        pendingOutput.runeAmount = runeAmount;
      }

      outputs.push(pendingOutput);
    } catch {
      // Ignore OP_RETURN and non-standard outputs.
    }
  });

  return {
    outputs,
    spentInputs,
    parentTxid,
  };
}

export function extractVaultIssuePendingData(
  request: VaultIssueRequestLike,
  wallet: WalletLike | null,
  pendingTransactions: Record<string, PendingTransactionLike>,
): VaultIssuePendingData {
  return extractPendingTxData(
    request.issue_txhex || request.repay_txhex,
    request.issue_psbt || request.repay_psbt,
    wallet,
    pendingTransactions
  );
}

export function extractVaultFinalizationPendingData(
  request: VaultIssueRequestLike,
  wallet: WalletLike | null,
  pendingTransactions: Record<string, PendingTransactionLike>,
): VaultIssuePendingData {
  return extractPendingTxData(
    request.vault_txhex,
    request.vault_psbt,
    wallet,
    pendingTransactions
  );
}
