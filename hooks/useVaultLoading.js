/**
 * useVaultLoading Hook
 * Manages loading states and rotating messages for VaultScreen
 */

import { useState, useEffect, useRef } from 'react';

export function useVaultLoading(visible) {
  const messageIndexRef = useRef(0);
  const [isLoading, setIsLoading] = useState(true);
  const [preparingVault, setPreparingVault] = useState(true);
  const [preparingMessage, setPreparingMessage] = useState('Connecting to your vault');

  const shouldShowLoading = isLoading || preparingVault;

  // Rotate through preparing messages
  useEffect(() => {
    if (!preparingVault) {
      messageIndexRef.current = 0;
      setPreparingMessage('Connecting to your vault');
      return;
    }

    const messages = [
      'Connecting to your vault',
      'Verifying your wallet credentials',
      'Loading your collateral positions',
      'Checking Bitcoin network status',
      'Syncing vault balances',
      'Fetching latest price data',
      'Preparing vault interface',
      'Almost ready...',
    ];

    // Reset to first message when starting
    messageIndexRef.current = 0;
    setPreparingMessage(messages[0]);

    const interval = setInterval(() => {
      messageIndexRef.current = (messageIndexRef.current + 1) % messages.length;
      const newMessage = messages[messageIndexRef.current];
      setPreparingMessage(newMessage);
    }, 2000);

    return () => {
      clearInterval(interval);
    };
  }, [preparingVault]);

  // Reset loading message when leaving the vault screen
  useEffect(() => {
    if (!visible) {
      setPreparingVault(false);
      setPreparingMessage('Connecting to your vault');
      messageIndexRef.current = 0;
    }
  }, [visible]);

  return {
    isLoading,
    setIsLoading,
    preparingVault,
    setPreparingVault,
    preparingMessage,
    shouldShowLoading,
  };
}
