/**
 * Zustand Stores Index
 *
 * Central export point for all Zustand stores.
 * These stores replace React Context providers for better performance.
 *
 * Benefits of Zustand over Context:
 * - No provider nesting required
 * - Selective re-renders (only components using changed state re-render)
 * - Simpler API (just import and use)
 * - Better TypeScript support
 * - Built-in devtools support
 */

// Display Preferences
export {
  useDisplayPreferencesStore,
  useShowTotalInBTC,
  useShowBTCInBTC,
  useShowUnitInUnit,
  resetDisplayPreferencesStore,
} from './displayPreferencesStore';

// Price
export {
  usePriceStore,
  useBtcPrice,
  useLoadingBtcPrice,
  resetPriceStore,
} from './priceStore';

// Send Flow
export {
  useSendFlowStore,
  useIntentStep,
  useSendAssetType,
  useSendAmount,
  useSendRecipient,
  useTurboEnabled,
  resetSendFlowStore,
  type IntentStep,
  type AssetType,
  type SendAddressType,
} from './sendFlowStore';

// Notifications
export {
  useNotificationStore,
  useSnackbar,
  resetNotificationStore,
} from './notificationStore';

// Pending Transactions
export {
  usePendingTransactionsStore,
  usePendingTxs,
  useSpentUtxos,
  resetPendingTransactionsStore,
  type PendingTransaction,
  type PendingTransactionOutput,
} from './pendingTransactionsStore';

// Token Processing (replaces global variables)
export {
  useTokenProcessingStore,
  selectPendingToken,
  selectHasPendingToken,
} from './tokenProcessingStore';

/**
 * Reset all stores to initial state (useful for testing)
 */
export const resetAllStores = async () => {
  const { resetDisplayPreferencesStore } = await import('./displayPreferencesStore');
  const { resetPriceStore } = await import('./priceStore');
  const { resetSendFlowStore } = await import('./sendFlowStore');
  const { resetNotificationStore } = await import('./notificationStore');
  const { resetPendingTransactionsStore } = await import('./pendingTransactionsStore');
  const { useTokenProcessingStore } = await import('./tokenProcessingStore');

  resetDisplayPreferencesStore();
  resetPriceStore();
  resetSendFlowStore();
  resetNotificationStore();
  resetPendingTransactionsStore();
  useTokenProcessingStore.getState().reset();
};
