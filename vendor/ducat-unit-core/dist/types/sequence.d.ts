export type SequenceData = SequenceTimelock | SequenceMetaData | SequenceNumber | SequenceNull;
export type SequenceType = 'timelock' | 'metadata' | 'number' | 'nullified';
export interface SequenceMetaData {
    code: number;
    type: 'metadata';
    version: number;
}
export interface SequenceNull {
    type: 'null';
}
export interface SequenceNumber {
    type: 'number';
    value: number;
}
export interface SequenceTimelock {
    format: 'height' | 'stamp';
    type: 'timelock';
    value: number;
}
