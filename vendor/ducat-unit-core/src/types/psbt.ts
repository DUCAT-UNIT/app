/**
 * @fileoverview PSBT type aliases and structural helper types.
 */

import type { Transaction } from '@scure/btc-signer/transaction.js'

import type {
  TaprootControlBlock,
  TransactionInput,
  TransactionOutput
} from '@scure/btc-signer/psbt.js'

export type ControlBlock = ReturnType<typeof TaprootControlBlock.decode>

export type PSBTInput  = TransactionInput
export type PSBTOutput = TransactionOutput
export type PSBTData   = Transaction

export type PSBTFullInput  = PSBTInput  & { txid : string, index : number, witnessUtxo : PSBTPrevouts }
export type PSBTFullOutput = PSBTOutput & { amount : bigint, script : Uint8Array }

export interface PSBTPrevouts {
  amounts : bigint[]
  scripts : Uint8Array[]
}
