/**
 * Formatters - Legacy barrel file
 *
 * @deprecated This file is deprecated. Use imports from utils/formatters/ directory instead.
 * This file re-exports everything from formatters/ modules for backwards compatibility.
 *
 * Gradually migrate to:
 * - Bitcoin conversions: import from 'utils/bitcoin/conversions'
 * - Address formatting: import from 'utils/formatters/addresses'
 * - Amount formatting: import from 'utils/formatters/amounts'
 * - Date formatting: import from 'utils/formatters/dates'
 */

// Re-export everything from formatters modules
export * from './formatters/index';

// Explicitly export formatBalance which is defined in formatters/index.js
export { formatBalance } from './formatters/index';
