import { Buffer } from 'buffer';
import * as bitcoin from 'bitcoinjs-lib';
import {
  VaultAPI,
  type BaseUtxo,
  type RuneUtxo,
  type VaultBorrowCtx,
  type VaultDepositCtx,
  type VaultOpenCtx,
  type VaultRepayCtx,
  type VaultWithdrawCtx,
} from '@ducat-unit/client-sdk';
import { MUTINYNET_NETWORK } from '../../utils/bitcoin';

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

export function getExpectedVaultPsbtTemplates(): ExpectedPsbtTemplate[] {
  const operation = getPendingVaultSigningOperation();

  switch (operation.action) {
    case 'open': {
      const psbt1 = VaultAPI.open.create_psbt1(operation.ctx, operation.satsUtxos);
      const psbt2 = VaultAPI.open.create_psbt2(operation.ctx, psbt1);
      return [toExpectedPsbtTemplate(psbt1), toExpectedPsbtTemplate(psbt2)];
    }
    case 'borrow': {
      const psbt1 = VaultAPI.borrow.create_psbt1(operation.ctx, operation.satsUtxos);
      const psbt2 = VaultAPI.borrow.create_psbt2(operation.ctx, psbt1);
      return [toExpectedPsbtTemplate(psbt1), toExpectedPsbtTemplate(psbt2)];
    }
    case 'repay': {
      const psbt1 = VaultAPI.repay.create_psbt1(
        operation.ctx,
        operation.satsUtxos,
        operation.unitUtxos
      );
      const psbt2 = VaultAPI.repay.create_psbt2(operation.ctx, psbt1);
      return [toExpectedPsbtTemplate(psbt1), toExpectedPsbtTemplate(psbt2)];
    }
    case 'deposit': {
      const psbt = VaultAPI.deposit.create_psbt(operation.ctx, operation.satsUtxos);
      return [toExpectedPsbtTemplate(psbt)];
    }
    case 'withdraw': {
      const psbt = VaultAPI.withdraw.create_psbt(operation.ctx);
      return [toExpectedPsbtTemplate(psbt)];
    }
  }
}
