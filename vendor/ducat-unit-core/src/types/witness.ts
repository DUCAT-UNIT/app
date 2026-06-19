/**
 * @fileoverview Witness inscription/commit record type definitions.
 */

export interface InscriptionData {
  content  ?: string
  delegate ?: string
  mimetype ?: string
  parent   ?: string
  pointer  ?: number
  protocol ?: string
  rune     ?: string
}

export interface CommitData {
  commit_id  : string
  commit_ref : string | null
  author     : string
  content    : string | null
  mimetype   : string | null
}

export interface WitnessCommit extends CommitData { 
  coin_id     : string
  coin_index  : number
  seq_code    : number
  seq_version : number
}

export interface WitnessRecord extends CommitData {
  commit_ref : string
  content    : string
  mimetype   : string
}
