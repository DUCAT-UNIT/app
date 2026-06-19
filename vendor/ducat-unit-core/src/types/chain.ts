/**
 * @fileoverview Chain-network type definitions.
 */

import { CHAIN_NETWORKS } from '../const.js'

export type ChainNetwork = typeof CHAIN_NETWORKS[number]

/**
 * Address-network value accepted by `@vbyte/btc-dev` address functions.
 * Subset of the bitcoin network space that maps to a distinct address prefix.
 */
export type AddressNetwork = 'main' | 'testnet' | 'regtest'
