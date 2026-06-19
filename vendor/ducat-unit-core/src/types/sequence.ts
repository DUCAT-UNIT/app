/**
 * @fileoverview Sequence variant type definitions for metadata and timelock modes.
 */

export type SequenceData = SequenceTimelock | SequenceMetaData | SequenceNumber | SequenceNull
export type SequenceType = 'timelock' | 'metadata' | 'number' | 'nullified'

// Represents a metadata type in the sequence field.
export interface SequenceMetaData {
  code    : number     // For tagging inputs with a custom code.
  type    : 'metadata' // Discriminator for metadata type.
  version : number     // Meta version number.
}

export interface SequenceNull {
  type : 'null'
}

// Represents a number in the sequence field.
export interface SequenceNumber {
  type  : 'number'
  value : number
}

// Represents a block-height-based relative timelock.
export interface SequenceTimelock {
  format : 'height' | 'stamp'
  type   : 'timelock'
  value  : number
}
