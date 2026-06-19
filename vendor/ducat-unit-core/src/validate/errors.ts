/**
 * @fileoverview Format validation errors into human-readable, contextual messages.
 */

import type { ZodError, ZodIssue } from 'zod'

import type {
  ValidationError,
  ValidationErrorContext
} from '@/validate/types.js'

/**
 * Format a Zod error into an array of ValidationError objects.
 */
export function format_zod_errors (
  error : ZodError
) : ValidationError[] {
  return error.issues.map(issue => format_zod_issue(issue))
}

/**
 * Format a single Zod issue into a ValidationError object.
 */
export function format_zod_issue (
  issue : ZodIssue
) : ValidationError {
  const path = issue.path.join('.')
  const context: ValidationErrorContext = {}

  if ('expected' in issue) {
    context.expected = String(issue.expected)
  }
  if ('received' in issue) {
    context.received = String(issue.received)
  }

  return {
    path    : path || '(root)',
    code    : issue.code,
    message : issue.message,
    context
  }
}

/**
 * Format a Zod error into a single human-readable string.
 *
 * @param error - The Zod error to format
 * @param validator_name - Optional name of the validator function for context
 * @returns A formatted error message string
 */
export function format_zod_error (
  error          : ZodError,
  validator_name? : string
) : string {
  const errors  = format_zod_errors(error)
  const prefix  = validator_name ? `${validator_name} failed: ` : ''
  const details = errors.map(e => format_validation_error(e)).join('; ')
  return `${prefix}${details}`
}

/**
 * Format a ValidationError into a human-readable string.
 */
export function format_validation_error (
  error : ValidationError
) : string {
  const { path, message, context } = error
  const parts = [ path ]

  if (context?.expected && context?.received) {
    parts.push(`(expected ${context.expected}, got ${context.received})`)
  } else {
    parts.push(`(${message})`)
  }

  return parts.join(' ')
}

/**
 * Create a standardized validation error message.
 *
 * @param validator_name - Name of the validator function
 * @param details - Additional error details
 * @returns Formatted error message
 */
export function create_validation_error (
  validator_name : string,
  details        : string
) : string {
  return `${validator_name}: ${details}`
}
