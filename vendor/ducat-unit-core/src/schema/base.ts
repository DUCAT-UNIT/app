/**
 * @fileoverview Base Zod schema primitives and shared constrained scalar types.
 */

import { z } from 'zod'

type Literal = z.infer<typeof literal>
type Json    = Literal | { [key : string] : Json } | Json[]

/** Validate an unbounded bigint value. */
export const big    = z.bigint()                // unbounded bigint
/** Validate a boolean value. */
export const bool   = z.boolean()               // boolean
/** Validate a Date instance. */
export const date   = z.date()                  // Date instance
/** Validate an unbounded JavaScript number. */
export const num    = z.number()                // unbounded number (any finite/non-finite double)
/** Validate a Uint8Array instance. */
export const u8a    = z.instanceof(Uint8Array)  // Uint8Array instance
/** Validate a string value. */
export const str    = z.string()                // string
/** Accept any value without constraint. */
export const any    = z.any()                   // any value (no constraint)
/** Re-export the Zod namespace. */
export const zod    = z                         // re-export of the zod namespace
/** Validate an unsigned 8-bit number. */
export const char   = num.min(0).max(0xFF)      // unsigned 8-bit (0..255)
/** Validate an unsigned 16-bit number. */
export const short  = num.min(0).max(0xFFFF)    // unsigned 16-bit (0..65_535)
/** Validate a signed 32-bit integer. */
export const int    = num.int().min(-0x80000000).max(0x7FFFFFFF)  // signed 32-bit integer
/** Validate an unsigned 32-bit number. */
export const uint   = num.min(0).max(0xFFFFFFFF)                  // unsigned 32-bit (0..4_294_967_295)
/** Validate a safe integer. */
export const long   = z.int()                   // safe-integer (no explicit range bound)
/** Validate a non-negative safe integer. */
export const ulong  = long.nonnegative()        // non-negative safe-integer
/** Validate a 32-bit float. */
export const float  = z.float32()               // 32-bit float
/** Validate a 64-bit float. */
export const double = z.float64()               // 64-bit float

// 32-bit float with at most 2 decimal places.
/** Validate a 32-bit float with at most two decimal places. */
export const float2 = float.refine((e) => {
  const parts = String(e).split('.').at(1)
  return parts !== undefined && parts.length <= 2
})

/** Validate a Unix timestamp above the post-2015 sanity floor. */
export const stamp = uint.min(500_000_000)      // unix timestamp (post-2015 sanity floor)

// Even-length hex string (lower/upper case allowed).
/** Validate an even-length hex string. */
export const hex = z.string()
  .regex(/^[0-9a-fA-F]*$/)
  .refine(e => e.length % 2 === 0)

// JSON-compatible scalar (string | number | boolean | null).
/** Validate a JSON-compatible scalar value. */
export const literal = z.union([
  z.string(), z.number(), z.boolean(), z.null()
])

// Recursively-defined JSON value (scalar, array, or object).
/** Validate a recursively-defined JSON value. */
export const json : z.ZodType<Json> = z.lazy(() =>
  z.union([ literal, z.array(json), z.record(str, json) ])
)

/** Validate a 20-byte Uint8Array. */
export const u8a20    = u8a.refine((e) => e.length === 20)   // 20-byte Uint8Array (hash160)
/** Validate a 32-byte Uint8Array. */
export const u8a32    = u8a.refine((e) => e.length === 32)   // 32-byte Uint8Array (x-only pubkey / hash)
/** Validate a 33-byte Uint8Array. */
export const u8a33    = u8a.refine((e) => e.length === 33)   // 33-byte Uint8Array (compressed pubkey)
/** Validate a 64-byte Uint8Array. */
export const u8a64    = u8a.refine((e) => e.length === 64)   // 64-byte Uint8Array (signature)

/** Validate a 20-byte hex string. */
export const hex20    = hex.refine((e) => e.length === 40)   // 20-byte hex string (40 chars)
/** Validate a 32-byte hex string. */
export const hex32    = hex.refine((e) => e.length === 64)   // 32-byte hex string (64 chars)
/** Validate a 33-byte hex string. */
export const hex33    = hex.refine((e) => e.length === 66)   // 33-byte hex string (66 chars)
/** Validate a 64-byte hex string. */
export const hex64    = hex.refine((e) => e.length === 128)  // 64-byte hex string (128 chars)

/** Validate a byte value as either hex or Uint8Array. */
export const bytes  = z.union([ hex, u8a ])             // hex string or Uint8Array
/** Validate a 32-byte value as either hex or Uint8Array. */
export const byte32 = z.union([ hex32, u8a32 ])         // 32-byte value as hex or Uint8Array
/** Validate a 33-byte value as either hex or Uint8Array. */
export const byte33 = z.union([ hex33, u8a33 ])         // 33-byte value as hex or Uint8Array
/** Validate a 64-byte value as either hex or Uint8Array. */
export const byte64 = z.union([ hex64, u8a64 ])         // 64-byte value as hex or Uint8Array

/** Validate a base58-encoded string. */
export const base58    = z.string().regex(/^[1-9A-HJ-NP-Za-km-z]+$/)                 // base58 string
/** Validate a base64-encoded string. */
export const base64    = z.string().regex(/^[a-zA-Z0-9+/]+={0,2}$/)                  // base64 string (with padding)
/** Validate a base64url-encoded string. */
export const base64url = z.string().regex(/^[a-zA-Z0-9\-_]+={0,2}$/)                 // base64url string (url-safe alphabet)
/** Validate a bech32-encoded string. */
export const bech32    = z.string().regex(/^[a-z]+1[023456789acdefghjklmnpqrstuvwxyz]+$/)  // bech32 string (hrp + separator + data)
