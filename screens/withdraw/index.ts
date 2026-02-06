/**
 * Withdraw Screens - Export all withdraw flow screens
 *
 * Note: Input, Confirm, and Processing screens now use the generic vault screens.
 * The old implementations are deprecated but still available as *ScreenLegacy.
 */

// New generic screens (recommended)
export { WithdrawInputScreenNew as WithdrawInputScreen } from '../vault/screens';
export { WithdrawConfirmScreenNew as WithdrawConfirmScreen } from '../vault/screens';
export { WithdrawProcessingScreenNew as WithdrawProcessingScreen } from '../vault/screens';

// Success screen (not yet genericized)
export { default as WithdrawSuccessScreen } from './WithdrawSuccessScreen';

// Legacy screens (deprecated - will be removed in future release)
export { default as WithdrawInputScreenLegacy } from './WithdrawInputScreen';
export { default as WithdrawConfirmScreenLegacy } from './WithdrawConfirmScreen';
export { default as WithdrawProcessingScreenLegacy } from './WithdrawProcessingScreen';
