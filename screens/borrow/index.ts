/**
 * Borrow Screens - Export all borrow flow screens
 *
 * Note: Input, Confirm, and Processing screens now use the generic vault screens.
 * The old implementations are deprecated but still available as *ScreenLegacy.
 */

// New generic screens (recommended)
export { BorrowInputScreenNew as BorrowInputScreen } from '../vault/screens';
export { BorrowConfirmScreenNew as BorrowConfirmScreen } from '../vault/screens';
export { BorrowProcessingScreenNew as BorrowProcessingScreen } from '../vault/screens';

// Success screen (not yet genericized)
export { default as BorrowSuccessScreen } from './BorrowSuccessScreen';

// Legacy screens (deprecated - will be removed in future release)
export { default as BorrowInputScreenLegacy } from './BorrowInputScreen';
export { default as BorrowConfirmScreenLegacy } from './BorrowConfirmScreen';
export { default as BorrowProcessingScreenLegacy } from './BorrowProcessingScreen';
