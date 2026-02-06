/**
 * Barrel exports for context hooks
 * Use this to reduce import count in components
 */

// Auth context exports
export { useAuth, useOnboardingFlow } from './AuthContext';

// Wallet context exports
export { useWallet } from './WalletContext';
export { useBalance, useVaultData } from './WalletDataContext';

// Navigation handlers
export { useNavigationHandlers } from './NavigationHandlersContext';

// Feature contexts
export { useCashu } from './CashuContext';
export { useAirdrop } from './AirdropContext';
