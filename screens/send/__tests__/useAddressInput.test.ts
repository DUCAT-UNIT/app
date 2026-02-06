/**
 * Tests for useAddressInput hook
 */

import { renderHook, act } from '@testing-library/react-native';
import * as Clipboard from 'expo-clipboard';
import { useAddressInput } from '../hooks/useAddressInput';
import { validateBitcoinAddress } from '../../../utils/bitcoin';

// Mock dependencies
jest.mock('expo-clipboard', () => ({
  getStringAsync: jest.fn(),
}));

jest.mock('../../../utils/bitcoin', () => ({
  validateBitcoinAddress: jest.fn(),
}));

describe('useAddressInput', () => {
  const mockOnRecipientChange = jest.fn();
  const mockOnAddressTypeChange = jest.fn();

  const defaultOptions = {
    assetType: 'btc' as const,
    onRecipientChange: mockOnRecipientChange,
    onAddressTypeChange: mockOnAddressTypeChange,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (validateBitcoinAddress as jest.Mock).mockReturnValue({ valid: true });
  });

  it('should return initial state', () => {
    const { result } = renderHook(() => useAddressInput(defaultOptions));

    expect(result.current!.addressError).toBe('');
    expect(result.current!.isValidAddress).toBe(false);
    expect(result.current!.showQRScanner).toBe(false);
  });

  describe('handleRecipientChange', () => {
    it('should validate a valid segwit address for BTC', () => {
      (validateBitcoinAddress as jest.Mock).mockReturnValue({ valid: true });

      const { result } = renderHook(() => useAddressInput(defaultOptions));

      act(() => {
        result.current!.handleRecipientChange('tb1qtest123');
      });

      expect(mockOnRecipientChange).toHaveBeenCalledWith('tb1qtest123');
      expect(mockOnAddressTypeChange).toHaveBeenCalledWith('segwit');
      expect(result.current!.isValidAddress).toBe(true);
      expect(result.current!.addressError).toBe('');
    });

    it('should validate a valid taproot address for BTC', () => {
      (validateBitcoinAddress as jest.Mock).mockReturnValue({ valid: true });

      const { result } = renderHook(() => useAddressInput(defaultOptions));

      act(() => {
        result.current!.handleRecipientChange('tb1ptest123');
      });

      expect(mockOnAddressTypeChange).toHaveBeenCalledWith('taproot');
      expect(result.current!.isValidAddress).toBe(true);
    });

    it('should set error for invalid address', () => {
      (validateBitcoinAddress as jest.Mock).mockReturnValue({
        valid: false,
        error: 'Invalid address format',
      });

      const { result } = renderHook(() => useAddressInput(defaultOptions));

      act(() => {
        result.current!.handleRecipientChange('invalid');
      });

      expect(result.current!.addressError).toBe('Invalid address format');
      expect(result.current!.isValidAddress).toBe(false);
    });

    it('should require taproot for UNIT', () => {
      (validateBitcoinAddress as jest.Mock).mockReturnValue({ valid: true });

      const { result } = renderHook(() =>
        useAddressInput({ ...defaultOptions, assetType: 'unit' })
      );

      act(() => {
        result.current!.handleRecipientChange('tb1qtest123'); // segwit, not taproot
      });

      expect(result.current!.addressError).toBe('UNIT requires Taproot (bc1p/tb1p)');
      expect(result.current!.isValidAddress).toBe(false);
    });

    it('should accept taproot for UNIT', () => {
      (validateBitcoinAddress as jest.Mock).mockReturnValue({ valid: true });

      const { result } = renderHook(() =>
        useAddressInput({ ...defaultOptions, assetType: 'unit' })
      );

      act(() => {
        result.current!.handleRecipientChange('tb1ptest123');
      });

      expect(result.current!.isValidAddress).toBe(true);
      expect(mockOnAddressTypeChange).toHaveBeenCalledWith('taproot');
    });

    it('should clean multiline input', () => {
      (validateBitcoinAddress as jest.Mock).mockReturnValue({ valid: true });

      const { result } = renderHook(() => useAddressInput(defaultOptions));

      act(() => {
        result.current!.handleRecipientChange('tb1qtest123\nextra line');
      });

      expect(mockOnRecipientChange).toHaveBeenCalledWith('tb1qtest123');
    });
  });

  describe('handlePaste', () => {
    it('should paste from clipboard and validate', async () => {
      (Clipboard.getStringAsync as jest.Mock).mockResolvedValue('tb1qpasted');
      (validateBitcoinAddress as jest.Mock).mockReturnValue({ valid: true });

      const { result } = renderHook(() => useAddressInput(defaultOptions));

      await act(async () => {
        await result.current!.handlePaste();
      });

      expect(mockOnRecipientChange).toHaveBeenCalledWith('tb1qpasted');
    });

    it('should handle empty clipboard', async () => {
      (Clipboard.getStringAsync as jest.Mock).mockResolvedValue('');

      const { result } = renderHook(() => useAddressInput(defaultOptions));

      await act(async () => {
        await result.current!.handlePaste();
      });

      expect(mockOnRecipientChange).not.toHaveBeenCalled();
    });
  });

  describe('handleScanQR', () => {
    it('should open QR scanner', () => {
      const { result } = renderHook(() => useAddressInput(defaultOptions));

      act(() => {
        result.current!.handleScanQR();
      });

      expect(result.current!.showQRScanner).toBe(true);
    });
  });

  describe('handleQRScanned', () => {
    it('should process plain address', () => {
      (validateBitcoinAddress as jest.Mock).mockReturnValue({ valid: true });

      const { result } = renderHook(() => useAddressInput(defaultOptions));

      act(() => {
        result.current!.handleQRScanned('tb1qscanned');
      });

      expect(result.current!.showQRScanner).toBe(false);
      expect(mockOnRecipientChange).toHaveBeenCalledWith('tb1qscanned');
    });

    it('should strip bitcoin: URI prefix', () => {
      (validateBitcoinAddress as jest.Mock).mockReturnValue({ valid: true });

      const { result } = renderHook(() => useAddressInput(defaultOptions));

      act(() => {
        result.current!.handleQRScanned('bitcoin:tb1qscanned?amount=0.001');
      });

      expect(mockOnRecipientChange).toHaveBeenCalledWith('tb1qscanned');
    });
  });
});
