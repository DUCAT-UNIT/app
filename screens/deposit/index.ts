/**
 * Deposit Screens - Export all deposit flow screens
 *
 * Note: Input, Confirm, and Processing screens now use the generic vault screens.
 * The old implementations are deprecated but still available as *ScreenLegacy.
 */

// New generic screens (recommended)
export { DepositInputScreenNew as DepositInputScreen } from '../vault/screens';
export { DepositConfirmScreenNew as DepositConfirmScreen } from '../vault/screens';
export { DepositProcessingScreenNew as DepositProcessingScreen } from '../vault/screens';

// Success screen (not yet genericized)
export { default as DepositSuccessScreen } from './DepositSuccessScreen';

// Legacy screens (deprecated - will be removed in future release)
export { default as DepositInputScreenLegacy } from './DepositInputScreen';
export { default as DepositConfirmScreenLegacy } from './DepositConfirmScreen';
export { default as DepositProcessingScreenLegacy } from './DepositProcessingScreen';
