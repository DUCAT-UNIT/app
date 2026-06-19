/**
 * @fileoverview Chain-network normalization helpers.
 *
 * Three layers of conversion:
 *   - to_chain_network: string aliases ('mainnet', 'testnet', 'mutinynet') → narrow ChainNetwork.
 *   - to_address_network: ChainNetwork → btc-dev AddressNetwork (exhaustive).
 *   - normalize_address_network: composition of the two for wide-input call sites.
 */

import type { AddressNetwork, ChainNetwork } from '@/types/chain.js'

/**
 * Normalize a string network identifier to the protocol's narrow `ChainNetwork`.
 *
 * Accepts either a direct `ChainNetwork` value (`'main'`, `'testnet3'`, ...) or a
 * human/config alias (`'mainnet'`, `'testnet'`, `'mutinynet'`). Throws on any
 * unrecognized input so caller boundaries fail loudly.
 */
export function to_chain_network (network : string) : ChainNetwork {
  switch (network) {
    case 'mainnet':
      return 'main'
    case 'testnet':
      return 'testnet3'
    case 'mutinynet':
      return 'mutiny'
    case 'main':
    case 'testnet3':
    case 'testnet4':
    case 'signet':
    case 'mutiny':
    case 'regtest':
    case 'alpha-mainnet':
      return network
    default:
      throw new Error(`unsupported chain network: ${network}`)
  }
}

/**
 * Map a protocol `ChainNetwork` to the address-network value accepted by
 * `@vbyte/btc-dev` (`'main' | 'testnet' | 'regtest'`).
 *
 * `testnet3`, `testnet4`, `signet`, and `mutiny` all share the testnet
 * address prefixes (`tb` bech32, `m`/`n`/`2` base58), so they collapse to
 * `'testnet'` for address encoding/decoding purposes. `alpha-mainnet` is a
 * superficial label for an alpha deployment on Bitcoin mainnet, so it
 * collapses to `'main'` (same address prefixes as `main`).
 */
export function to_address_network (network : ChainNetwork) : AddressNetwork {
  switch (network) {
    case 'main':     return 'main'
    case 'alpha-mainnet': return 'main'
    case 'regtest':  return 'regtest'
    case 'testnet3':
    case 'testnet4':
    case 'signet':
    case 'mutiny':   return 'testnet'
    default: {
      const _exhaustive : never = network
      throw new Error(`unsupported chain network: ${_exhaustive as string}`)
    }
  }
}

/**
 * Wide-input convenience: accept a string (alias or `ChainNetwork`) and return
 * the address-network value. Composition of {@link to_chain_network} and
 * {@link to_address_network}.
 */
export function normalize_address_network (network : string) : AddressNetwork {
  return to_address_network(to_chain_network(network))
}
