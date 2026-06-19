/**
 * @fileoverview Validate data against Zod schemas with improved error messaging.
 */

import { z } from 'zod'
import { format_zod_error } from './errors.js'

/**
 * Parse input data against a Zod schema and return the validated result.
 *
 * @param input - The data to validate
 * @param schema - The Zod schema to validate against
 * @param error - Optional custom error message used as a context prefix
 * @returns The validated and typed data
 * @throws Error if validation fails
 */
export function parse_schema <S extends z.ZodTypeAny> (
  input  : unknown,
  schema : S,
  error? : string
) : z.infer<S> {
  // Parse the input with the schema.
  const parsed = schema.safeParse(input)
  // If the parsing fails,
  if (!parsed.success) {
    // Always surface the underlying Zod issues (path + expected/received)
    // so failures are debuggable; prepend the caller's context message when
    // provided. (Previously a custom message discarded the Zod detail.)
    const detail = format_zod_error(parsed.error)
    throw new Error(error ? `${error}: ${detail}` : `parse_schema failed: ${detail}`)
  }
  // Return the parsed input.
  return parsed.data
}

/**
 * Assert that input data matches a Zod schema.
 * This is an assertion variant that narrows the type of the input.
 *
 * IMPORTANT (Codex #28): this discards the parsed result and only
 * narrows the type of `input`. If the schema performs any coercion or
 * transform (defaults, `z.coerce`, `.transform()`, trimming), the
 * caller continues using the ORIGINAL un-coerced `input` — the
 * narrowed type may not match the actual runtime value. When you need
 * the coerced/parsed value, call `parse_schema` and use its return
 * value instead. Use `assert_schema` only for pure structural
 * validation where input === parsed.
 *
 * @param input - The data to validate
 * @param schema - The Zod schema to validate against
 * @param error - Optional custom error message (if not provided, formats Zod errors)
 * @throws Error if validation fails
 */
export function assert_schema <S extends z.ZodTypeAny> (
  input  : unknown,
  schema : S,
  error? : string
) : asserts input is z.infer<S> {
  // Apply the schema to the input.
  parse_schema(input, schema, error)
}
