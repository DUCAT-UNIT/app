/**
 * TransactionHistoryContext - DEPRECATED
 * This context has been merged into WalletDataContext
 * This file provides backwards compatibility by re-exporting from WalletDataContext
 *
 * @deprecated Use WalletDataContext instead
 */

import { WalletDataProvider, useTransactionHistory } from './WalletDataContext';

// Re-export for backwards compatibility
export { useTransactionHistory };
export const TransactionHistoryProvider = WalletDataProvider;
