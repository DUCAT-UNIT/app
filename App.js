/**
 * App.js - Main application entry point
 * Minimal orchestrator that wires up providers and navigation
 */

// Polyfills - MUST BE FIRST
import './crypto-polyfill';
import { Buffer } from 'buffer';
global.Buffer = Buffer;

import React, { useState } from 'react';
import { useFonts } from 'expo-font';
import BIP32Factory from 'bip32';
import * as bitcoin from 'bitcoinjs-lib';
import * as ecc from '@bitcoinerlab/secp256k1';

// Contexts
import { AuthProvider } from './contexts/AuthContext';
import { WalletProvider } from './contexts/WalletContext';

// Navigation
import AppNavigator from './navigation/AppNavigator';

// Components
import SplashScreen from './components/SplashScreen';

// Initialize BIP32 and ECC for bitcoinjs-lib
const bip32 = BIP32Factory(ecc);
bitcoin.initEccLib(ecc);

// Main App - Provider setup only
export default function App() {
  const [seedConfirmed, setSeedConfirmed] = useState(false);

  // Load fonts
  const [fontsLoaded] = useFonts({
    'CabinetGrotesk-Regular': require('./assets/fonts/CabinetGrotesk-Regular.otf'),
    'CabinetGrotesk-Medium': require('./assets/fonts/CabinetGrotesk-Medium.otf'),
    'CabinetGrotesk-Bold': require('./assets/fonts/CabinetGrotesk-Bold.otf'),
  });

  if (!fontsLoaded) {
    return <SplashScreen />;
  }

  return (
    <AuthProvider onSeedConfirmed={setSeedConfirmed}>
      <WalletProvider>
        <AppNavigator seedConfirmed={seedConfirmed} setSeedConfirmed={setSeedConfirmed} />
      </WalletProvider>
    </AuthProvider>
  );
}
