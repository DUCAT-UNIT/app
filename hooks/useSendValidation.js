/**
 * useSendValidation Hook
 * Manages validation and loading states for send transaction flow:
 * - Address validation (including Taproot checks for UNIT)
 * - Loading message cycling during transaction creation
 */

import { useState, useEffect } from 'react';
import { validateBitcoinAddress } from '../utils/sendHelpers';

export function useSendValidation({ intentStep, sendRecipient, sendAssetType }) {
  const [addressError, setAddressError] = useState('');
  const [loadingMessageIndex, setLoadingMessageIndex] = useState(0);

  // Auto-validate address on change
  useEffect(() => {
    if (intentStep === 'entering_address' && sendRecipient) {
      const validation = validateBitcoinAddress(sendRecipient);

      // Additional validation for UNIT transfers - require Taproot address
      if (validation.valid && sendAssetType === 'unit') {
        const trimmedAddress = sendRecipient.trim();
        if (!trimmedAddress.startsWith('tb1p') && !trimmedAddress.startsWith('bc1p')) {
          setAddressError('UNIT transfers require a Taproot address (starting with tb1p)');
          return;
        }
      }

      setAddressError(validation.error || '');
    } else {
      setAddressError('');
    }
  }, [sendRecipient, intentStep, sendAssetType]);

  // Cycle through loading messages during transaction creation
  useEffect(() => {
    if (intentStep === 'creating') {
      setLoadingMessageIndex(0);
      const maxMessages = sendAssetType === 'btc' ? 2 : 3;

      const timer = setInterval(() => {
        setLoadingMessageIndex((prev) => {
          if (prev < maxMessages - 1) {
            return prev + 1;
          }
          return prev; // Stay on last message
        });
      }, 500); // 500ms between messages

      return () => clearInterval(timer);
    }
  }, [intentStep, sendAssetType]);

  return {
    addressError,
    loadingMessageIndex,
  };
}
