/**
 * @fileoverview Minimal Nostr event type definitions used by core modules.
 */

export interface SignedEvent {
  content : string
  id      : string
  kind    : number
  pubkey  : string
  sig     : string
  stamp   : number
  tags    : string[][]
}
