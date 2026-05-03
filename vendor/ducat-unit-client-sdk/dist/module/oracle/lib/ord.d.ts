import type { BaseUtxo, InscriptionWitness, OrdOutputResponse, RuneAmounts, UtxoPointer, RuneMap, InscriptionResponse } from '../../../types/index.js';
export declare function parse_outpoint(outpoint: string): {
    txid: string;
    vout: number;
};
export declare function parse_outpoint_sat(output: OrdOutputResponse): number | null;
export declare function parse_output_pointers(res: OrdOutputResponse): UtxoPointer;
export declare function parse_outpoint_utxo(outpoint: string, res: OrdOutputResponse): BaseUtxo;
export declare function parse_inscription_utxo(res: InscriptionResponse): BaseUtxo;
export declare function parse_rune_data(output: OrdOutputResponse): RuneMap;
export declare function parse_inscription_ctx(witness: string[]): InscriptionWitness;
export declare function parse_html_rune_balances(html: string): RuneAmounts;
export declare function parse_html_sat_balance(html: string): number;
export declare function parse_html_inscriptions(html: string): string[];
export declare function parse_html_outpoints(html: string): string[];
