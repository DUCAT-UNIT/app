import { Buffer } from 'buffer';
import * as bitcoin from 'bitcoinjs-lib';
import type {
  BaseUtxo,
  RuneUtxo,
  VaultBorrowCtx,
  VaultDepositCtx,
  VaultOpenCtx,
  VaultRepayCtx,
  VaultWithdrawCtx,
} from '@ducat-unit/client-sdk';
import { MUTINYNET_NETWORK } from '../../utils/bitcoin';

type VaultRepoLiquidCtx = {
  liquid_vaults?: unknown[];
};
type VaultRepoCtx = unknown;
type VaultTrimCtx = unknown;

export interface ExpectedPsbtInputTemplate {
  hashHex: string;
  index: number;
  scriptHex: string | null;
  sequence: number;
  value: string | null;
}

export interface ExpectedPsbtOutputTemplate {
  scriptHex: string;
  value: string;
}

export interface ExpectedPsbtTemplate {
  version: number;
  locktime: number;
  inputs: ExpectedPsbtInputTemplate[];
  outputs: ExpectedPsbtOutputTemplate[];
}

type PendingVaultSigningOperation =
  | {
      action: 'open';
      ctx: VaultOpenCtx;
      satsUtxos: BaseUtxo[];
    }
  | {
      action: 'borrow';
      ctx: VaultBorrowCtx;
      satsUtxos: BaseUtxo[];
    }
  | {
      action: 'repay';
      ctx: VaultRepayCtx;
      satsUtxos: BaseUtxo[];
      unitUtxos: RuneUtxo[];
    }
  | {
      action: 'deposit';
      ctx: VaultDepositCtx;
      satsUtxos: BaseUtxo[];
    }
  | {
      action: 'withdraw';
      ctx: VaultWithdrawCtx;
    }
  | {
      action: 'repo';
      liquidCtx: VaultRepoLiquidCtx;
      vaultCtx: VaultRepoCtx;
      satsUtxos: BaseUtxo[];
      unsignedPsbt: string;
    }
  | {
      action: 'trim';
      ctx: VaultTrimCtx;
      unsignedPsbt: string;
    };

let pendingVaultSigningOperation: PendingVaultSigningOperation | null = null;

export function setPendingVaultSigningOperation(
  operation: PendingVaultSigningOperation
): void {
  pendingVaultSigningOperation = operation;
}

export function clearPendingVaultSigningOperation(): void {
  pendingVaultSigningOperation = null;
}

function getPendingVaultSigningOperation(): PendingVaultSigningOperation {
  if (!pendingVaultSigningOperation) {
    throw new Error('SECURITY: Missing pending vault signing context');
  }

  return pendingVaultSigningOperation;
}

function toExpectedPsbtTemplate(psbtBase64: string): ExpectedPsbtTemplate {
  const psbt = bitcoin.Psbt.fromBase64(psbtBase64, { network: MUTINYNET_NETWORK });
  const tx = (psbt as unknown as { __CACHE?: { __TX?: { version: number; locktime: number } } }).__CACHE?.__TX;

  if (!tx) {
    throw new Error('SECURITY: Unable to inspect unsigned vault PSBT template');
  }

  return {
    version: tx.version,
    locktime: tx.locktime,
    inputs: psbt.txInputs.map((input, index) => ({
      hashHex: Buffer.from(input.hash).toString('hex'),
      index: input.index,
      scriptHex: psbt.data.inputs[index].witnessUtxo
        ? Buffer.from(psbt.data.inputs[index].witnessUtxo!.script).toString('hex')
        : null,
      sequence: input.sequence ?? 0xffffffff,
      value: psbt.data.inputs[index].witnessUtxo
        ? psbt.data.inputs[index].witnessUtxo!.value.toString()
        : null,
    })),
    outputs: psbt.txOutputs.map((output) => ({
      scriptHex: Buffer.from(output.script).toString('hex'),
      value: output.value.toString(),
    })),
  };
}

export function getExpectedVaultPsbtTemplates(
  unsignedPsbts: string | string[]
): ExpectedPsbtTemplate[] {
  getPendingVaultSigningOperation();

  const psbts = Array.isArray(unsignedPsbts) ? unsignedPsbts : [unsignedPsbts];
  if (psbts.length === 0 || psbts.some((psbt) => typeof psbt !== 'string' || psbt.length === 0)) {
    throw new Error('SECURITY: Missing unsigned vault PSBT template');
  }

  return psbts.map(toExpectedPsbtTemplate);
}
