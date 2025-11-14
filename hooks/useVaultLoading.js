/**
 * useVaultLoading Hook
 * Manages loading states and rotating messages for VaultScreen
 */

import { useState, useEffect, useRef } from 'react';

export function useVaultLoading(visible) {
  const messageIndexRef = useRef(0);
  const [isLoading, setIsLoading] = useState(true);
  const [preparingVault, setPreparingVault] = useState(true);
  const [preparingMessage, setPreparingMessage] = useState('Preparing the vault for you');

  const shouldShowLoading = isLoading || preparingVault;

  // Rotate through preparing messages
  useEffect(() => {
    if (!preparingVault) {
      messageIndexRef.current = 0;
      setPreparingMessage('Preparing the vault for you');
      return;
    }

    const messages = [
      'Preparing the vault for you',
      'Initializing secure parameters',
      'Generating vault credentials',
      'Configuring collateral settings',
      'Establishing Bitcoin connection',
      'Verifying network parameters',
      'Almost there...',
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
      setPreparingMessage('Preparing the vault for you');
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
