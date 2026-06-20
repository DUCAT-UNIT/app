import './crypto-polyfill';
import { registerRootComponent } from 'expo';
import React from 'react';
import { enableFreeze, enableScreens } from 'react-native-screens';
import App from './App';
import ErrorBoundary from './components/ErrorBoundary';

enableScreens(true);
enableFreeze(true);

// Wrap App with ErrorBoundary only
// WalletProvider and other context providers are in App.js
const AppWithProviders = () => (
  <ErrorBoundary
    fallbackMessage="The UNIT Wallet encountered an error. Your funds are safe. Please restart the app."
    onReset={() => {
      // Optional: Add any cleanup logic here
    }}
  >
    <App />
  </ErrorBoundary>
);

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(AppWithProviders);
