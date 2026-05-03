import type { Literal } from '../../../types/index.js';
import type { RuneData } from './ord.js';
export type RuneMap = Map<string, RuneData>;
export type InscriptionID = [
    txid: string,
    vout: number
];
export type SatPoint = [
    txid: string,
    vout: number,
    sat: number
];
export type UtxoPointer = [
    curr_ptr: number,
    next_ptr: number
];
export type OrdTokenPointer = OrdUtxo & OrdRecordPointer;
export type OrdToken<T> = OrdUtxo & OrdRecord<T>;
export type RuneAmounts = Map<string, number>;
export interface OrdAddressBalance {
    runes_bal: Map<string, number>;
    sats_bal: number;
}
export interface OrdAddressData {
    inscriptions: string[];
    outputs: string[];
    runes: RuneAmounts;
    sat_bal: number;
}
export interface OrdUtxo {
    runes: RuneMap;
    sat_ptr: number;
    script: string;
    txid: string;
    value: number;
    vout: number;
}
export interface OrdRecordPointer {
    id: string;
    idx: number | null;
    sat: number;
}
export interface OrdRecord<T> extends OrdRecordPointer {
    content: T;
}
export interface ParsedInscription {
    body?: Literal | object;
    delegate?: string;
    parent?: string;
    pointer?: number;
    rune?: string;
    type?: string;
}
export interface InscriptionWitness {
    cblock: string;
    inscriptions: ParsedInscription[];
    pubkey: string;
    script: string;
    sig: string;
}
