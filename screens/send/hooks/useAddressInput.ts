/**
 * useAddressInput Hook
 * Handles address input validation, paste, and QR code scanning
 */

import { useState, useCallback } from 'react';
import * as Clipboard from 'expo-clipboard';
import { MUTINYNET_NETWORK, validateBitcoinAddress } from '../../../utils/bitcoin';
import type { AssetType } from '../../../stores/sendFlowStore';

export interface UseAddressInputOptions {
  assetType: AssetType;
  onRecipientChange: (address: string) => void;
  onAddressTypeChange: (type: 'segwit' | 'taproot') => void;
}

export interface UseAddressInputResult {
  /** Current address error message */
  addressError: string;
  /** Whether the current address is valid */
  isValidAddress: boolean;
  /** Whether QR scanner is visible */
  showQRScanner: boolean;
  /** Set QR scanner visibility */
  setShowQRScanner: (show: boolean) => void;
  /** Handle address text change */
  handleRecipientChange: (text: string) => void;
  /** Handle paste from clipboard */
  handlePaste: () => Promise<void>;
  /** Handle QR code scan */
  handleScanQR: () => void;
  /** Handle QR scanned result */
  handleQRScanned: (data: string) => void;
}

export function useAddressInput({
  assetType,
  onRecipientChange,
  onAddressTypeChange,
}: UseAddressInputOptions): UseAddressInputResult {
  const bech32Hrp = typeof MUTINYNET_NETWORK?.bech32 === 'string' ? MUTINYNET_NETWORK.bech32 : 'tb';
  const taprootPrefix = `${bech32Hrp}1p`;
  const [addressError, setAddressError] = useState('');
  const [isValidAddress, setIsValidAddress] = useState(false);
  const [showQRScanner, setShowQRScanner] = useState(false);

  const handleRecipientChange = useCallback((text: string): void => {
    const cleanText = text.split(/[\r\n]/)[0].trim();
    onRecipientChange(cleanText);
    setAddressError('');
    setIsValidAddress(false);

    if (cleanText) {
      const validation = validateBitcoinAddress(cleanText);
      if (!validation.valid) {
        setAddressError(validation.error || 'Invalid address');
      } else if (assetType === 'unit') {
        const isTaproot = cleanText.toLowerCase().startsWith(taprootPrefix);
        if (!isTaproot) {
          setAddressError('UNIT requires Taproot (bc1p/tb1p)');
        } else {
          onAddressTypeChange('taproot');
          setIsValidAddress(true);
        }
      } else {
        const addressType = cleanText.toLowerCase().startsWith(taprootPrefix) ? 'taproot' : 'segwit';
        onAddressTypeChange(addressType);
        setIsValidAddress(true);
      }
    }
  }, [assetType, onRecipientChange, onAddressTypeChange, taprootPrefix]);

  const handlePaste = useCallback(async () => {
    const text = await Clipboard.getStringAsync();
    if (text) {
      const firstLine = text.split(/[\r\n]/)[0].trim();
      handleRecipientChange(firstLine);
    }
  }, [handleRecipientChange]);

  const handleScanQR = useCallback(() => {
    setShowQRScanner(true);
  }, []);

  const handleQRScanned = useCallback((data: string) => {
    setShowQRScanner(false);
    let address = data;
    if (data.toLowerCase().startsWith('bitcoin:')) {
      address = data.replace(/^bitcoin:/i, '').split('?')[0];
    }
    handleRecipientChange(address);
  }, [handleRecipientChange]);

  return {
    addressError,
    isValidAddress,
    showQRScanner,
    setShowQRScanner,
    handleRecipientChange,
    handlePaste,
    handleScanQR,
    handleQRScanned,
  };
}
