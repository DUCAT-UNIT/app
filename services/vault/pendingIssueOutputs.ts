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
  vault_txhex?: string;
}

export interface VaultIssuePendingData {
  outputs: PendingTransactionOutput[];
  spentInputs: Array<{ txid: string; vout: number }>;
  parentTxid: string | null;
}

function getRuneAmountsByOutput(tx: bitcoin.Transaction): Map<number, number> {
  const runeAmounts = new Map<number, number>();
  const runestoneOutput = tx.outs.find((output) => output.script[0] === 0x6a);

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

function extractPendingTxData(
  txhex: string | undefined,
  wallet: WalletLike | null,
  pendingTransactions: Record<string, PendingTransactionLike>,
): VaultIssuePendingData {
  if (!txhex || !wallet?.segwitAddress || !wallet?.taprootAddress) {
    return {
      outputs: [],
      spentInputs: [],
      parentTxid: null,
    };
  }

  const tx = bitcoin.Transaction.fromHex(txhex);
  const runeAmounts = getRuneAmountsByOutput(tx);
  const outputs: PendingTransactionOutput[] = [];
  const spentInputs: Array<{ txid: string; vout: number }> = [];
  let parentTxid: string | null = null;

  tx.ins.forEach((input) => {
    const txid = Buffer.from(input.hash).reverse().toString('hex');
    const spentInput = { txid, vout: input.index };
    spentInputs.push(spentInput);

    if (!parentTxid && pendingTransactions[txid]?.status === 'pending') {
      parentTxid = txid;
    }
  });

  tx.outs.forEach((output, vout) => {
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
  return extractPendingTxData(request.issue_txhex, wallet, pendingTransactions);
}

export function extractVaultFinalizationPendingData(
  request: VaultIssueRequestLike,
  wallet: WalletLike | null,
  pendingTransactions: Record<string, PendingTransactionLike>,
): VaultIssuePendingData {
  return extractPendingTxData(request.vault_txhex, wallet, pendingTransactions);
}
