import { registerRootComponent } from 'expo';
import React from 'react';
import App from './App';
import { WalletProvider } from './contexts/WalletContext';
import ErrorBoundary from './components/ErrorBoundary';

// Wrap App with ErrorBoundary and WalletProvider
const AppWithProviders = () => (
  <ErrorBoundary
    fallbackMessage="The UNIT Wallet encountered an error. Your funds are safe. Please restart the app."
    onReset={() => {
      // Optional: Add any cleanup logic here
    }}
  >
    <WalletProvider>
      <App />
    </WalletProvider>
  </ErrorBoundary>
);

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(AppWithProviders);
