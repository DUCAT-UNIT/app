import type { Literal } from '../../../types/index.js';
export type ContractPointer = [
    adr: string,
    ptr: number
];
export type RecordPointer = [
    adr: string,
    id: string
];
export type ValuePointer = [
    type: number,
    ptr: number
];
export type ValueArray = [
    type: number,
    ...rest: Literal[]
];
export interface GroupContract {
    adr: string;
}
export interface PointerContract extends GroupContract {
    ptr: ValuePointer[];
}
export interface QuorumContract extends GroupContract {
    pub: string;
    thd: number;
}
export interface AccountRecord {
    iss: number;
}
export interface HostRecord {
    pub: string;
    url: string;
}
