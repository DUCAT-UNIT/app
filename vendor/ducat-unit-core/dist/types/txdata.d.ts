import type { CoinUtxo } from './coin.js';
import type { ProtoProfile } from './proto.js';
import type { SequenceData } from './sequence.js';
import type { WitnessCommit } from './witness.js';
import type { VaultCosignerScript, VaultLiquidationScript } from './script.js';
import type { VaultAction, VaultConfigData, VaultReturnData } from './vault.js';
import type { LockScriptType, LocktimeData, TxSize, TxValue, WitnessData, WitnessVersion } from '@vbyte/btc-dev';
export interface ProtoTxContext {
    coinbase: boolean;
    commits: WitnessCommit[];
    opreturn: OpReturnData | null;
    proto: ProtoProfile;
    tx: ProtoTxData;
}
export interface OpReturnData {
    code: number;
    script: string;
}
export interface ProtoTxData {
    locktime: LocktimeData | null;
    txhex: string;
    txid: string;
    txsize: TxSize;
    txtotal: TxValue;
    version: number;
    vin: ProtoTxInput[];
    vout: ProtoTxOutput[];
}
export interface ProtoTxOutput {
    script_pk: string;
    type: LockScriptType | 'unknown';
    value: number;
    version: WitnessVersion;
}
export interface ProtoTxCoinbase {
    coinbase: string;
    sequence: number;
    witness: string[];
}
export interface ProtoTxInput {
    coinbase: null;
    coin_id: string;
    prevout: ProtoTxOutput | null;
    sequence: SequenceData;
    script_sig: string | null;
    txid: string;
    vout: number;
    witness: WitnessData;
}
export interface VaultTxContext {
    coin_id: string;
    spend_id: string;
    vault_action: VaultAction;
    vault_config: VaultConfigData | null;
    vault_input: ProtoTxInput;
    vault_signers: VaultCosignerScript;
    vault_utxo: CoinUtxo | null;
    vault_version: number;
}
export interface VaultTxData extends VaultTxContext {
    conn_input: ProtoTxInput | null;
    vault_ratio: number | null;
    vault_return: VaultReturnData | null;
}
export interface LiquidTxInput {
    liquid_input: ProtoTxInput;
    liquid_script: VaultLiquidationScript;
    liquid_utxo: CoinUtxo;
    liquid_version: number;
}
