/**
 * @fileoverview runestone-ts/src/types/runestone.ts
 */

export type RuneEtchingSpec = {
  divisibility?: number;
  premine?: bigint;
  symbol?: string;
  terms?: {
    cap?: bigint;
    amount?: bigint;
    offset?: {
      start?: bigint;
      end?: bigint;
    };
    height?: {
      start?: bigint;
      end?: bigint;
    };
  };
  turbo?: boolean;
  runeName?: string;
};

export type RunestoneSpec = {
  mint?: {
    block: bigint;
    tx: number;
  };
  pointer?: number;
  etching?: RuneEtchingSpec;
  edicts?: {
    id: {
      block: bigint;
      tx: number;
    };
    amount: bigint;
    output: number;
  }[];
};

export type Flaw =
  | 'edict_output'
  | 'edict_rune_id'
  | 'invalid_script'
  | 'opcode'
  | 'supply_overflow'
  | 'trailing_integers'
  | 'truncated_field'
  | 'unrecognized_even_tag'
  | 'unrecognized_flag'
  | 'varint';

export type Cenotaph = {
  flaws: Flaw[];
  etching?: string;
  mint?: {
    block: bigint;
    tx: number;
  };
};
