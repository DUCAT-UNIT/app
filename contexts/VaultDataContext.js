/**
 * VaultDataContext - DEPRECATED
 * This context has been merged into WalletDataContext
 * This file provides backwards compatibility by re-exporting from WalletDataContext
 *
 * @deprecated Use WalletDataContext instead
 */

import { WalletDataProvider, useVaultData } from './WalletDataContext';

// Re-export for backwards compatibility
export { useVaultData };
export const VaultDataProvider = WalletDataProvider;
