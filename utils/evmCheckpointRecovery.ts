import type {
  EvmTransactionCheckpoint,
  EvmTransactionCheckpointStatus,
} from '../stores/evmTransactionCheckpointStore';

export interface EvmCheckpointReconciliationCounts {
  checked: number;
  pending: number;
  confirmed: number;
  failed: number;
  errors: number;
}

export interface EvmCheckpointRecoveryCopy {
  title: string;
  body: string;
}

type RecoveryFlow = 'swap' | 'redeem' | 'send';

const ACTIVE_CHECKPOINT_STATUSES = new Set<EvmTransactionCheckpointStatus>(['submitted', 'failed']);

function normalizeAddress(value: string | null | undefined): string | null {
  const normalized = value?.trim().toLowerCase();
  return normalized ? normalized : null;
}

function amountsMatch(checkpointAmount: string | null | undefined, expectedAmount: string | null | undefined): boolean {
  const expected = Number(expectedAmount);
  if (!Number.isFinite(expected) || expected <= 0) {
    return true;
  }

  const actual = Number(checkpointAmount);
  if (!Number.isFinite(actual) || actual <= 0) {
    return false;
  }

  return Math.abs(actual - expected) < 0.000001;
}

function latestMatchingCheckpoint(
  checkpoints: EvmTransactionCheckpoint[],
  predicate: (checkpoint: EvmTransactionCheckpoint) => boolean,
): EvmTransactionCheckpoint | null {
  return checkpoints
    .filter(predicate)
    .sort((a, b) => b.updatedAt - a.updatedAt)[0] ?? null;
}

export function selectSwapRecoveryCheckpoint(
  checkpoints: EvmTransactionCheckpoint[],
  accountIndex: number,
  amountIn: string | null | undefined,
  destinationTaprootAddress?: string | null,
  expectedRedemptionAmount?: string | null,
): EvmTransactionCheckpoint | null {
  const destination = normalizeAddress(destinationTaprootAddress);
  const hasExpectedRedemptionAmount = Number.isFinite(Number(expectedRedemptionAmount))
    && Number(expectedRedemptionAmount) > 0;

  return latestMatchingCheckpoint(checkpoints, (checkpoint) => {
    if (checkpoint.accountIndex !== accountIndex) {
      return false;
    }

    if (
      checkpoint.kind === 'approval'
      && checkpoint.asset === 'USDC'
      && ACTIVE_CHECKPOINT_STATUSES.has(checkpoint.status)
    ) {
      return amountsMatch(checkpoint.amount, amountIn);
    }

    if (
      checkpoint.kind === 'swap'
      && checkpoint.tokenIn === 'USDC'
      && checkpoint.tokenOut === 'wUNIT'
    ) {
      return amountsMatch(checkpoint.amount, amountIn);
    }

    if (
      checkpoint.kind === 'redemption'
      && checkpoint.tokenIn === 'wUNIT'
      && checkpoint.tokenOut === 'UNIT'
    ) {
      const checkpointDestination = normalizeAddress(checkpoint.destinationTaprootAddress);
      const destinationMatches = !destination || !checkpointDestination || checkpointDestination === destination;
      if (!destinationMatches) {
        return false;
      }

      if (ACTIVE_CHECKPOINT_STATUSES.has(checkpoint.status)) {
        return true;
      }

      return hasExpectedRedemptionAmount && amountsMatch(checkpoint.amount, expectedRedemptionAmount);
    }

    return false;
  });
}

export function selectRedeemRecoveryCheckpoint(
  checkpoints: EvmTransactionCheckpoint[],
  accountIndex: number,
  destinationTaprootAddress: string | null | undefined,
  amount: string | null | undefined,
): EvmTransactionCheckpoint | null {
  const destination = normalizeAddress(destinationTaprootAddress);

  return latestMatchingCheckpoint(checkpoints, (checkpoint) => {
    if (
      checkpoint.accountIndex !== accountIndex
      || checkpoint.kind !== 'redemption'
      || checkpoint.tokenIn !== 'wUNIT'
      || checkpoint.tokenOut !== 'UNIT'
    ) {
      return false;
    }

    const checkpointDestination = normalizeAddress(checkpoint.destinationTaprootAddress);
    if (destination && checkpointDestination && checkpointDestination !== destination) {
      return false;
    }

    return amountsMatch(checkpoint.amount, amount);
  });
}

export function selectSendRecoveryCheckpoint(
  checkpoints: EvmTransactionCheckpoint[],
  accountIndex: number,
  asset: string,
  recipientAddress?: string | null,
  amount?: string | null,
): EvmTransactionCheckpoint | null {
  const recipient = normalizeAddress(recipientAddress);

  return latestMatchingCheckpoint(checkpoints, (checkpoint) => {
    if (
      checkpoint.accountIndex !== accountIndex
      || checkpoint.kind !== 'transfer'
      || checkpoint.asset !== asset
      || !ACTIVE_CHECKPOINT_STATUSES.has(checkpoint.status)
    ) {
      return false;
    }

    const checkpointRecipient = normalizeAddress(checkpoint.recipient);
    if (recipient && checkpointRecipient && checkpointRecipient !== recipient) {
      return false;
    }

    return amountsMatch(checkpoint.amount, amount);
  });
}

export function shortEvmTxHash(txHash: string): string {
  if (txHash.length <= 18) {
    return txHash;
  }

  return `${txHash.slice(0, 10)}...${txHash.slice(-6)}`;
}

export function describeEvmRecoveryCheckpoint(
  checkpoint: EvmTransactionCheckpoint,
  flow: RecoveryFlow,
): EvmCheckpointRecoveryCopy {
  const txHash = shortEvmTxHash(checkpoint.txHash);

  if (flow === 'swap') {
    if (checkpoint.kind === 'swap' && checkpoint.status === 'confirmed') {
      return {
        title: 'Swap confirmed; redeem wUNIT',
        body: `Sepolia swap ${txHash} is confirmed. If UNIT did not arrive, open Redeem and burn the wUNIT output to your Mutinynet address.`,
      };
    }

    if (checkpoint.kind === 'redemption' && checkpoint.status === 'confirmed') {
      return {
        title: 'Redemption burn confirmed',
        body: `Burn ${txHash} is confirmed on Sepolia. Open Redeem to track the UNIT release if it is not visible yet.`,
      };
    }

    if (checkpoint.status === 'submitted') {
      return {
        title: 'Sepolia transaction still pending',
        body: `Transaction ${txHash} was submitted earlier. Check its pending status before signing again so the app does not duplicate work.`,
      };
    }

    return {
      title: 'Previous Sepolia step failed',
      body: `Transaction ${txHash} failed after broadcast. Check its final status, then retry once balances and allowance are current.`,
    };
  }

  if (flow === 'redeem') {
    if (checkpoint.status === 'confirmed') {
      return {
        title: 'Burn confirmed; release may be pending',
        body: `Redemption burn ${txHash} is confirmed on Sepolia. Use these details to track or retry bridge status loading.`,
      };
    }

    if (checkpoint.status === 'submitted') {
      return {
        title: 'Redemption burn submitted',
        body: `Burn ${txHash} is waiting for Sepolia confirmation. Check pending status before submitting another redemption for the same destination.`,
      };
    }

    return {
      title: 'Previous redemption failed',
      body: `Burn ${txHash} failed after broadcast. Check its final status; if it remains failed, retry with the checkpoint amount and destination.`,
    };
  }

  if (checkpoint.status === 'submitted') {
    return {
      title: 'Transfer submitted',
      body: `Transfer ${txHash} is still pending on Sepolia. Check pending status before sending again.`,
    };
  }

  return {
    title: 'Previous transfer failed',
    body: `Transfer ${txHash} failed after broadcast. Check its final status, then retry if the balance is unchanged.`,
  };
}

export function formatEvmCheckpointReconciliationSummary(
  result: EvmCheckpointReconciliationCounts,
): string {
  if (result.checked === 0) {
    return 'No submitted Sepolia transactions needed a status check.';
  }

  const parts = [
    `${result.checked} checked`,
    `${result.confirmed} confirmed`,
    `${result.pending} pending`,
    `${result.failed} failed`,
  ];

  if (result.errors > 0) {
    parts.push(`${result.errors} errors`);
  }

  return parts.join(', ');
}
