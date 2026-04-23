/**
 * Barrel exports for context hooks
 * Use this to reduce import count in components
 */

// Auth context exports
export { useAuth, useOnboardingFlow } from './AuthContext';

// Wallet context exports
export { useWallet } from './WalletContext';
export { useBalance, useVaultData, useEvmAssets } from './WalletDataContext';

// Navigation handlers
export {
  useSettingsHandlers,
  useAccountSwitcherContext,
  useAuthFlowHandlers,
} from './NavigationHandlersContext';

// Feature contexts
export { useCashu, useCashuBalanceState, useCashuOperations } from './CashuContext';
export { useAirdrop } from './AirdropContext';
