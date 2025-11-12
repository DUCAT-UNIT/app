/**
 * BalanceContext - DEPRECATED
 * This context has been merged into WalletDataContext
 * This file provides backwards compatibility by re-exporting from WalletDataContext
 *
 * @deprecated Use WalletDataContext instead
 */

import { WalletDataProvider, useBalance } from './WalletDataContext';

// Re-export for backwards compatibility
export { useBalance };
export const BalanceProvider = WalletDataProvider;
