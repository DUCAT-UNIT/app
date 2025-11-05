import { registerRootComponent } from 'expo';
import React from 'react';
import App from './App';
import { WalletProvider } from './contexts/WalletContext';

// Wrap App with WalletProvider
const AppWithProviders = () => (
  <WalletProvider>
    <App />
  </WalletProvider>
);

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(AppWithProviders);
