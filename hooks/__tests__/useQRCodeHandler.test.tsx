/**
 * Tests for useQRCodeHandler hook
 * Covers QR code scanning for Bitcoin addresses, Cashu tokens, JSON tokens, and Turbo URLs
 */

import React from 'react';
import { create, act } from 'react-test-renderer';
import { Alert } from 'react-native';
import { useQRCodeHandler } from '../useQRCodeHandler';
import { notify } from '../../utils/notify';

// Mock dependencies
jest.mock('../../utils/logger', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

jest.mock('react-native', () => ({
  Alert: {
    alert: jest.fn(),
  },
}));

const mockNavigate = jest.fn();

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({
    navigate: mockNavigate,
  }),
}));

const mockDigestStringAsync = jest.fn();
jest.mock('expo-crypto', () => ({
  digestStringAsync: (...args: unknown[]) => mockDigestStringAsync(...args),
  CryptoDigestAlgorithm: {
    SHA256: 'SHA-256',
  },
}));

const mockHasP2PKProofs = jest.fn();
jest.mock('../../services/cashu/p2pk', () => ({
  hasP2PKProofs: (...args: unknown[]) => mockHasP2PKProofs(...args),
}));

const mockDecodeToken = jest.fn();
const mockEncodeToken = jest.fn();
jest.mock('../../services/cashu/crypto', () => ({
  decodeToken: (...args: unknown[]) => mockDecodeToken(...args),
  encodeToken: (...args: unknown[]) => mockEncodeToken(...args),
}));

const mockCheckProofsSpent = jest.fn();
jest.mock('../../services/cashu/cashuMintClient', () => ({
  checkProofsSpent: (...args: unknown[]) => mockCheckProofsSpent(...args),
}));

// Mock tokenProcessingStore
const mockSetPendingToken = jest.fn();
const mockIsTokenProcessed = jest.fn();
const mockTriggerTokenCheck = jest.fn();
jest.mock('../../stores/tokenProcessingStore', () => ({
  useTokenProcessingStore: () => ({
    setPendingToken: mockSetPendingToken,
    isTokenProcessed: mockIsTokenProcessed,
    triggerTokenCheck: mockTriggerTokenCheck,
  }),
}));

// Mock atob for base64 decoding
global.atob = jest.fn((str) => Buffer.from(str, 'base64').toString('utf8'));

// Helper to render hooks with props
type UseQRCodeHandlerParams = Parameters<typeof useQRCodeHandler>[0];
type UseQRCodeHandlerReturn = ReturnType<typeof useQRCodeHandler>;

function renderHookWithProps(props: Record<string, unknown>) {
  const result: { current: UseQRCodeHandlerReturn | null } = { current: null };
  function TestComponent({ hookProps }: { hookProps?: UseQRCodeHandlerParams }) {
    result.current = useQRCodeHandler(hookProps!);
    return null;
  }
  let component: ReturnType<typeof create> | undefined;
  act(() => {
    component = create(<TestComponent hookProps={props as unknown as UseQRCodeHandlerParams} />);
  });
  return {
    result,
    unmount: component!.unmount,
    component,
    rerender: (newProps?: unknown) => {
      act(() => {
        component?.update(<TestComponent hookProps={newProps as UseQRCodeHandlerParams} />);
      });
    },
  };
}

describe('useQRCodeHandler', () => {
  let mockProps: Record<string, unknown>;
  let originalRaf: typeof global.requestAnimationFrame;

  beforeEach(() => {
    jest.clearAllMocks();
    // Mock requestAnimationFrame globally
    originalRaf = global.requestAnimationFrame;
    global.requestAnimationFrame = jest.fn((cb: (time: number) => void) => {
      cb(0);
      return 1;
    });

    // Clear store mock default behavior
    mockSetPendingToken.mockClear();
    mockIsTokenProcessed.mockResolvedValue(false);
    mockTriggerTokenCheck.mockClear();

    mockProps = {
      receiveCashuToken: jest.fn().mockResolvedValue({ amount: 100 }),
      showSnackbar: jest.fn(),
      setShowQRScanner: jest.fn(),
    };

    // Default mocks
    mockHasP2PKProofs.mockReturnValue(false);
    mockDigestStringAsync.mockResolvedValue('mockhash123');
    mockDecodeToken.mockReturnValue({
      proofs: [{ id: 'proof1', amount: 100, secret: 'secret', C: 'C' }],
      amount: 100,
      mint: 'https://mint.example.com',
    });
    mockEncodeToken.mockReturnValue('cashuAencodedtoken');
    mockCheckProofsSpent.mockResolvedValue({
      states: [{ state: 'UNSPENT' }],
    });
  });

  afterEach(() => {
    global.requestAnimationFrame = originalRaf;
  });

  it('should return handleQRScan function', () => {
    const { result } = renderHookWithProps(mockProps);

    expect(typeof result.current).toBe('function');
  });

  describe('Bitcoin addresses', () => {
    it('should handle bitcoin: addresses', async () => {
      const { result } = renderHookWithProps(mockProps);

      await act(async () => {
        await result.current!('bitcoin:bc1qtest123');
      });

      expect(mockNavigate).toHaveBeenCalledWith('SendFlow', {
        screen: 'SendInput',
        params: { assetType: 'btc', prefillAddress: 'bc1qtest123' },
      });
    });

    it('should handle tb1 addresses', async () => {
      const { result } = renderHookWithProps(mockProps);

      await act(async () => {
        await result.current!('tb1qtest123');
      });

      expect(mockNavigate).toHaveBeenCalledWith('SendFlow', {
        screen: 'SendInput',
        params: { assetType: 'btc', prefillAddress: 'tb1qtest123' },
      });
    });

    it('should handle bc1 addresses', async () => {
      const { result } = renderHookWithProps(mockProps);

      await act(async () => {
        await result.current!('bc1qtest123');
      });

      expect(mockNavigate).toHaveBeenCalledWith('SendFlow', {
        screen: 'SendInput',
        params: { assetType: 'btc', prefillAddress: 'bc1qtest123' },
      });
    });

    it('should close scanner after handling bitcoin address', async () => {
      const { result } = renderHookWithProps(mockProps);

      await act(async () => {
        await result.current!('bitcoin:bc1qtest');
      });

      expect(mockProps.setShowQRScanner).toHaveBeenCalledWith(false);
    });

    it('should handle bitcoin: with amount parameter', async () => {
      const { result } = renderHookWithProps(mockProps);

      await act(async () => {
        await result.current!('bitcoin:bc1qtest?amount=0.001');
      });

      // Implementation strips the query params from the address
      expect(mockNavigate).toHaveBeenCalledWith('SendFlow', {
        screen: 'SendInput',
        params: { assetType: 'btc', prefillAddress: 'bc1qtest' },
      });
    });
  });

  describe('Cashu tokens - P2PK (Turbo)', () => {
    beforeEach(() => {
      mockHasP2PKProofs.mockReturnValue(true);
    });

    it('should handle P2PK token and set pending token via store', async () => {
      const { result } = renderHookWithProps(mockProps);

      await act(async () => {
        await result.current!('cashuAtestP2PKtoken');
      });

      expect(mockSetPendingToken).toHaveBeenCalledWith('cashuAtestP2PKtoken');
      expect(mockProps.setShowQRScanner).toHaveBeenCalledWith(false);
    });

    it('should trigger pending token check via store', async () => {
      const { result } = renderHookWithProps(mockProps);

      await act(async () => {
        await result.current!('cashuAtestP2PKtoken');
      });

      expect(mockTriggerTokenCheck).toHaveBeenCalled();
    });

    it('should show error snackbar for already processed token', async () => {
      mockIsTokenProcessed.mockResolvedValue(true);

      const { result } = renderHookWithProps(mockProps);

      await act(async () => {
        await result.current!('cashuAtestP2PKtoken');
      });

      expect(mockProps.showSnackbar).toHaveBeenCalledWith({
        type: 'error',
        action: 'swap',
        description: 'Token already claimed',
      });
      expect(mockProps.setShowQRScanner).toHaveBeenCalledWith(false);
    });

    it('should process new P2PK token when not already processed', async () => {
      mockIsTokenProcessed.mockResolvedValue(false);

      const { result } = renderHookWithProps(mockProps);

      await act(async () => {
        await result.current!('cashuAtestP2PKtoken');
      });

      expect(mockSetPendingToken).toHaveBeenCalledWith('cashuAtestP2PKtoken');
    });
  });

  describe('Cashu tokens - Regular', () => {
    beforeEach(() => {
      mockHasP2PKProofs.mockReturnValue(false);
    });

    it('should claim token when all proofs are unspent', async () => {
      const { result } = renderHookWithProps(mockProps);

      await act(async () => {
        await result.current!('cashuAtesttoken');
      });

      expect(notify.token.checking).toHaveBeenCalled();
      expect(notify.token.claiming).toHaveBeenCalled();
      expect(mockProps.receiveCashuToken).toHaveBeenCalledWith('cashuAtesttoken');
      expect(mockProps.showSnackbar).toHaveBeenCalledWith({
        type: 'success',
        action: 'claim',
        description: 'Successfully claimed 100 UNIT',
      });
    });

    it('should show error when all proofs are spent', async () => {
      mockCheckProofsSpent.mockResolvedValue({
        states: [{ state: 'SPENT' }],
      });

      const { result } = renderHookWithProps(mockProps);

      await act(async () => {
        await result.current!('cashuAtesttoken');
      });

      expect(mockProps.showSnackbar).toHaveBeenCalledWith({
        type: 'error',
        action: 'swap',
        description: 'All proofs in this token have been spent',
      });
    });

    it('should show partial token alert when some proofs are spent', async () => {
      mockDecodeToken.mockReturnValue({
        proofs: [
          { id: 'proof1', amount: 50, secret: 'secret1', C: 'C1' },
          { id: 'proof2', amount: 50, secret: 'secret2', C: 'C2' },
        ],
        amount: 100,
        mint: 'https://mint.example.com',
      });
      mockCheckProofsSpent.mockResolvedValue({
        states: [{ state: 'SPENT' }, { state: 'UNSPENT' }],
      });

      const { result } = renderHookWithProps(mockProps);

      await act(async () => {
        await result.current!('cashuAtesttoken');
      });

      expect(Alert.alert).toHaveBeenCalledWith(
        'Partial Token',
        expect.stringContaining('This token has 2 proofs'),
        expect.arrayContaining([
          expect.objectContaining({ text: 'Cancel', style: 'cancel' }),
          expect.objectContaining({ text: 'Claim' }),
        ])
      );
    });

    it('should claim unspent proofs when user confirms partial claim', async () => {
      mockDecodeToken.mockReturnValue({
        proofs: [
          { id: 'proof1', amount: 50, secret: 'secret1', C: 'C1' },
          { id: 'proof2', amount: 50, secret: 'secret2', C: 'C2' },
        ],
        amount: 100,
        mint: 'https://mint.example.com',
      });
      mockCheckProofsSpent.mockResolvedValue({
        states: [{ state: 'SPENT' }, { state: 'UNSPENT' }],
      });
      mockEncodeToken.mockReturnValue('cashuAfiltered');

      const { result } = renderHookWithProps(mockProps);

      await act(async () => {
        await result.current!('cashuAtesttoken');
      });

      // Get the Claim button callback
      const alertCall = (Alert.alert as jest.Mock).mock.calls[0];
      const claimButton = alertCall[2][1];

      await act(async () => {
        await claimButton.onPress();
      });

      expect(notify.token.claimingUnspent).toHaveBeenCalled();
      expect(mockEncodeToken).toHaveBeenCalled();
      expect(mockProps.receiveCashuToken).toHaveBeenCalledWith('cashuAfiltered');
      expect(mockProps.showSnackbar).toHaveBeenCalledWith({
        type: 'success',
        action: 'claim',
        description: 'Successfully claimed 100 UNIT',
      });
    });

    it('should handle error during partial claim', async () => {
      mockDecodeToken.mockReturnValue({
        proofs: [
          { id: 'proof1', amount: 50, secret: 'secret1', C: 'C1' },
          { id: 'proof2', amount: 50, secret: 'secret2', C: 'C2' },
        ],
        amount: 100,
        mint: 'https://mint.example.com',
      });
      mockCheckProofsSpent.mockResolvedValue({
        states: [{ state: 'SPENT' }, { state: 'UNSPENT' }],
      });
      (mockProps.receiveCashuToken as jest.Mock).mockRejectedValue(new Error('Claim failed'));

      const { result } = renderHookWithProps(mockProps);

      await act(async () => {
        await result.current!('cashuAtesttoken');
      });

      const alertCall = (Alert.alert as jest.Mock).mock.calls[0];
      const claimButton = alertCall[2][1];

      await act(async () => {
        await claimButton.onPress();
      });

      expect(mockProps.showSnackbar).toHaveBeenCalledWith({
        type: 'error',
        action: 'claim',
        description: 'Failed to claim: Claim failed',
      });
    });

    it('should handle non-Error exception during partial claim', async () => {
      mockDecodeToken.mockReturnValue({
        proofs: [
          { id: 'proof1', amount: 50, secret: 'secret1', C: 'C1' },
          { id: 'proof2', amount: 50, secret: 'secret2', C: 'C2' },
        ],
        amount: 100,
        mint: 'https://mint.example.com',
      });
      mockCheckProofsSpent.mockResolvedValue({
        states: [{ state: 'SPENT' }, { state: 'UNSPENT' }],
      });
      (mockProps.receiveCashuToken as jest.Mock).mockRejectedValue('String error');

      const { result } = renderHookWithProps(mockProps);

      await act(async () => {
        await result.current!('cashuAtesttoken');
      });

      const alertCall = (Alert.alert as jest.Mock).mock.calls[0];
      const claimButton = alertCall[2][1];

      await act(async () => {
        await claimButton.onPress();
      });

      expect(mockProps.showSnackbar).toHaveBeenCalledWith({
        type: 'error',
        action: 'claim',
        description: 'Failed to claim: String error',
      });
    });

    it('should handle error during token check', async () => {
      mockDecodeToken.mockImplementation(() => {
        throw new Error('Decode failed');
      });

      const { result } = renderHookWithProps(mockProps);

      await act(async () => {
        await result.current!('cashuAtesttoken');
      });

      expect(mockProps.showSnackbar).toHaveBeenCalledWith({
        type: 'error',
        action: 'claim',
        description: 'Failed to process token: Decode failed',
      });
    });

    it('should handle non-Error exception during token check', async () => {
      mockDecodeToken.mockImplementation(() => {
        throw 'String decode error';
      });

      const { result } = renderHookWithProps(mockProps);

      await act(async () => {
        await result.current!('cashuAtesttoken');
      });

      expect(mockProps.showSnackbar).toHaveBeenCalledWith({
        type: 'error',
        action: 'claim',
        description: 'Failed to process token: String decode error',
      });
    });
  });

  describe('JSON token formats', () => {
    it('should handle JSON object with token array', async () => {
      const { result } = renderHookWithProps(mockProps);

      const jsonToken = JSON.stringify({
        token: [{
          mint: 'https://mint.example.com',
          proofs: [{ id: 'proof1', amount: 100, secret: 'secret', C: 'C' }],
        }],
      });

      await act(async () => {
        await result.current!(jsonToken);
      });

      expect(mockEncodeToken).toHaveBeenCalled();
      expect(notify.token.claiming).toHaveBeenCalled();
      expect(mockProps.receiveCashuToken).toHaveBeenCalledWith('cashuAencodedtoken');
      expect(mockProps.showSnackbar).toHaveBeenCalledWith({
        type: 'success',
        action: 'claim',
        description: 'Successfully claimed 100 UNIT',
      });
    });

    it('should show error for raw proofs array', async () => {
      const { result } = renderHookWithProps(mockProps);

      const rawProofs = JSON.stringify({
        proofs: [{ id: 'proof1', amount: 100 }],
      });

      await act(async () => {
        await result.current!(rawProofs);
      });

      expect(mockProps.showSnackbar).toHaveBeenCalledWith({
        type: 'error',
        action: 'claim',
        description: 'Invalid token format - raw proofs not supported',
      });
    });

    it('should show error for array without token property', async () => {
      const { result } = renderHookWithProps(mockProps);

      await act(async () => {
        await result.current!('[{"id":"proof1","amount":100}]');
      });

      expect(mockProps.showSnackbar).toHaveBeenCalledWith({
        type: 'error',
        action: 'claim',
        description: 'Invalid token format - raw proofs not supported',
      });
    });

    it('should show error for invalid JSON token format', async () => {
      const { result } = renderHookWithProps(mockProps);

      await act(async () => {
        await result.current!('{"other":"data"}');
      });

      expect(mockProps.showSnackbar).toHaveBeenCalledWith({
        type: 'error',
        action: 'claim',
        description: 'Invalid JSON token format',
      });
    });

    it('should handle JSON parse error', async () => {
      const { result } = renderHookWithProps(mockProps);

      await act(async () => {
        await result.current!('{invalid json}');
      });

      expect(mockProps.showSnackbar).toHaveBeenCalledWith({
        type: 'error',
        action: 'claim',
        description: expect.stringContaining('Failed to claim token:'),
      });
    });

    it('should handle error during JSON token claim', async () => {
      (mockProps.receiveCashuToken as jest.Mock).mockRejectedValue(new Error('Claim failed'));

      const { result } = renderHookWithProps(mockProps);

      const jsonToken = JSON.stringify({
        token: [{
          mint: 'https://mint.example.com',
          proofs: [{ id: 'proof1', amount: 100, secret: 'secret', C: 'C' }],
        }],
      });

      await act(async () => {
        await result.current!(jsonToken);
      });

      expect(mockProps.showSnackbar).toHaveBeenCalledWith({
        type: 'error',
        action: 'claim',
        description: 'Failed to claim token: Claim failed',
      });
    });

    it('should handle non-Error exception during JSON token claim', async () => {
      (mockProps.receiveCashuToken as jest.Mock).mockRejectedValue('String claim error');

      const { result } = renderHookWithProps(mockProps);

      const jsonToken = JSON.stringify({
        token: [{
          mint: 'https://mint.example.com',
          proofs: [{ id: 'proof1', amount: 100, secret: 'secret', C: 'C' }],
        }],
      });

      await act(async () => {
        await result.current!(jsonToken);
      });

      expect(mockProps.showSnackbar).toHaveBeenCalledWith({
        type: 'error',
        action: 'claim',
        description: 'Failed to claim token: String claim error',
      });
    });
  });

  describe('Turbo URL formats', () => {
    it('should extract token from ducat://turbo/ URL', async () => {
      const { result } = renderHookWithProps(mockProps);

      await act(async () => {
        await result.current!('ducat://turbo/cashuAbc123xyz');
      });

      expect(mockNavigate).toHaveBeenCalledWith('SendFlow', {
        screen: 'TurboClaiming',
        params: { tokenString: 'cashuAbc123xyz' },
      });
    });

    it('should handle URL with t parameter (base64 token)', async () => {
      const base64Token = Buffer.from('testtoken').toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=/g, '');

      const { result } = renderHookWithProps(mockProps);

      await act(async () => {
        await result.current!(`https://ducatprotocol.com/unit?t=${base64Token}`);
      });

      expect(mockNavigate).toHaveBeenCalledWith('SendFlow', {
        screen: 'TurboClaiming',
        params: { tokenString: 'testtoken' },
      });
    });

    it('should add padding to base64 tokens as needed', async () => {
      // Create token that needs 1 padding character
      const token = 'ab';
      const base64Token = Buffer.from(token).toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=/g, '');

      const { result } = renderHookWithProps(mockProps);

      await act(async () => {
        await result.current!(`https://ducatprotocol.com/unit?t=${base64Token}`);
      });

      expect(mockNavigate).toHaveBeenCalledWith('SendFlow', {
        screen: 'TurboClaiming',
        params: { tokenString: 'ab' },
      });
    });

    it('should show error when no token found in URL', async () => {
      const { result } = renderHookWithProps(mockProps);

      await act(async () => {
        await result.current!('https://ducatprotocol.com/unit?other=param');
      });

      expect(notify.token.extractFailed).toHaveBeenCalled();
    });

    it('should handle error during token extraction', async () => {
      // Mock atob to throw
      const originalAtob = global.atob;
      global.atob = jest.fn(() => {
        throw new Error('Invalid base64');
      });

      const { result } = renderHookWithProps(mockProps);

      await act(async () => {
        await result.current!('https://ducatprotocol.com/unit?t=invalid!!!');
      });

      expect(notify.token.extractError).toHaveBeenCalled();

      global.atob = originalAtob;
    });

    it('should handle non-Error exception during extraction', async () => {
      const originalAtob = global.atob;
      global.atob = jest.fn(() => {
        throw 'String error';
      });

      const { result } = renderHookWithProps(mockProps);

      await act(async () => {
        await result.current!('https://ducatprotocol.com/unit?t=invalid');
      });

      expect(notify.token.extractError).toHaveBeenCalled();

      global.atob = originalAtob;
    });
  });

  describe('Unknown format', () => {
    it('should show error for unknown QR format', async () => {
      const { result } = renderHookWithProps(mockProps);

      await act(async () => {
        await result.current!('random-unknown-data');
      });

      expect(notify.token.unknownFormat).toHaveBeenCalled();
    });

    it('should show error for empty string', async () => {
      const { result } = renderHookWithProps(mockProps);

      await act(async () => {
        await result.current!('');
      });

      expect(notify.token.unknownFormat).toHaveBeenCalled();
    });

    it('should show error for http URL without turbo indicators', async () => {
      const { result } = renderHookWithProps(mockProps);

      await act(async () => {
        await result.current!('https://example.com/some-page');
      });

      expect(notify.token.unknownFormat).toHaveBeenCalled();
    });
  });
});
