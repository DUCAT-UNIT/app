/**
 * Navigation type definitions and param lists
 * Defines the navigation structure for the entire app
 */

// Root Stack Navigator (top level)
// Switches between Auth flow and Main app
export const RootStackParams = {
  Auth: undefined, // Auth/Onboarding flow
  Main: undefined, // Main app (after authentication)
};

// Auth Stack Navigator (onboarding/authentication)
// All screens before user is authenticated
export const AuthStackParams = {
  Welcome: undefined, // Welcome screen (create/import wallet)
  PinSetup: undefined, // PIN setup screen
  LockScreen: undefined, // PIN entry/unlock screen
};

// Main Tab Navigator (authenticated app)
// Bottom tab navigation
export const MainTabParams = {
  WalletTab: undefined, // Main wallet screen
  VaultTab: undefined, // Vault screen
};

// Wallet Stack Navigator (nested in WalletTab)
// Stack navigation within the wallet section
export const WalletStackParams = {
  WalletHome: undefined, // Main wallet dashboard
  Send: undefined, // Send transaction flow
  Receive: undefined, // Receive addresses
  TransactionHistory: undefined, // Transaction history
  Settings: undefined, // Settings screen
};

// Future expansion placeholders
export const VaultStackParams = {
  VaultHome: undefined, // Main vault interface
};
