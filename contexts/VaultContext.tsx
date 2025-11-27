/**
 * VaultContext - Thin wrapper around vaultStore for backwards compatibility
 * The actual state lives in stores/vaultStore.ts (Zustand)
 *
 * This provider handles:
 * - Loading credentials when currentAccount changes
 * - Providing the legacy useVault() hook API
 *
 * For better performance, use the selector hooks directly:
 * - useActiveTab() - only re-renders on tab change
 * - useVaultCredentials() - only re-renders when credentials change
 * - useAutoCreateVaultTrigger() - only re-renders on trigger change
 */

import React, { useEffect, ReactNode } from 'react';
import {
  useVaultStore,
  useActiveTab,
  useVaultCredentials,
  useAutoCreateVaultTrigger,
} from '../stores/vaultStore';

// Re-export types and selectors from store
export type { VaultCredentials, ActiveTab } from '../stores/vaultStore';
export { useActiveTab, useVaultCredentials, useAutoCreateVaultTrigger } from '../stores/vaultStore';

interface VaultContextValue {
  vaultCredentials: ReturnType<typeof useVaultCredentials>;
  autoCreateVaultTrigger: ReturnType<typeof useAutoCreateVaultTrigger>;
  activeTab: ReturnType<typeof useActiveTab>;
  setActiveTab: (tab: 'wallet' | 'vault') => void;
  openVault: (shouldAutoCreate?: boolean) => void;
  clearVaultCredentials: () => void;
}

/**
 * Legacy hook - returns all vault values
 * For better performance, use selector hooks: useActiveTab, useVaultCredentials, etc.
 */
export const useVault = (): VaultContextValue => {
  const vaultCredentials = useVaultCredentials();
  const autoCreateVaultTrigger = useAutoCreateVaultTrigger();
  const activeTab = useActiveTab();
  const setActiveTab = useVaultStore((state) => state.setActiveTab);
  const openVault = useVaultStore((state) => state.openVault);
  const clearVaultCredentials = useVaultStore((state) => state.clearVaultCredentials);

  return {
    vaultCredentials,
    autoCreateVaultTrigger,
    activeTab,
    setActiveTab,
    openVault,
    clearVaultCredentials,
  };
};

interface VaultProviderProps {
  children: ReactNode;
  currentAccount: number;
}

/**
 * VaultProvider - Handles credential loading on account change
 * The actual state management is done by Zustand store
 */
export const VaultProvider: React.FC<VaultProviderProps> = ({ children, currentAccount }) => {
  const loadCredentials = useVaultStore((state) => state.loadCredentials);

  // Load vault credentials whenever account changes
  useEffect(() => {
    loadCredentials(currentAccount);
  }, [currentAccount, loadCredentials]);

  return <>{children}</>;
};
