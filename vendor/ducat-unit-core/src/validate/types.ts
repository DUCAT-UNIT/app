/**
 * @fileoverview Type definitions for validation errors and results.
 */

/**
 * Represents a validation error with contextual information.
 */
export interface ValidationError {
  /** The path to the field that failed validation (e.g., 'unit_balance', 'guard_members.0') */
  path: string
  /** Error code for programmatic handling (e.g., 'invalid_type', 'required') */
  code: string
  /** Human-readable error message */
  message: string
  /** Additional context about the error */
  context?: ValidationErrorContext
}

/**
 * Additional context for validation errors.
 */
export interface ValidationErrorContext {
  /** The expected type or value */
  expected?: string
  /** The actual type or value received */
  received?: string
  /** The name of the function that performed validation */
  validator?: string
}

/**
 * Result of a validation operation.
 */
export interface ValidationResult<T> {
  /** Whether validation succeeded */
  success: boolean
  /** The validated data if successful */
  data?: T
  /** Array of validation errors if failed */
  errors?: ValidationError[]
}
