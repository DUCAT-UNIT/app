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
const mockFetchWithTimeout = jest.fn();

jest.mock('../../utils/logger', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

jest.mock('../../utils/api', () => ({
  fetchWithTimeout: (...args: unknown[]) => mockFetchWithTimeout(...args),
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
const mockDecodeToken = jest.fn();
const mockEncodeToken = jest.fn();
const mockCheckProofsSpent = jest.fn();
jest.mock('../../services/cashu/cashuWalletService', () => ({
  checkProofsSpent: (...args: unknown[]) => mockCheckProofsSpent(...args),
  decodeToken: (...args: unknown[]) => mockDecodeToken(...args),
  decodeTokenMetadata: (...args: unknown[]) => mockDecodeToken(...args),
  encodeToken: (...args: unknown[]) => mockEncodeToken(...args),
  getOrFetchKeys: jest.fn().mockResolvedValue({
    keysets: [{ id: 'keyset1', unit: 'unit', active: true, keys: { 1: 'key1' } }],
  }),
  hasP2PKProofs: (...args: unknown[]) => mockHasP2PKProofs(...args),
}));

jest.mock('../../services/cashu/cashuTsCompat', () => ({
  getKeysetIdsFromMintKeys: jest.fn(() => ['keyset1']),
}));

// Mock tokenProcessingStore
const mockSetPendingToken = jest.fn().mockResolvedValue(undefined);
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
    mockFetchWithTimeout.mockReset();
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
    mockEncodeToken.mockReturnValue('cashuBencodedtoken');
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

  const expectTurboTokenQueued = (token: string) => {
    expect(mockSetPendingToken).toHaveBeenCalledWith(token);
    expect(mockTriggerTokenCheck).toHaveBeenCalled();
    expect(mockProps.setShowQRScanner).toHaveBeenCalledWith(false);
    expect(mockNavigate).not.toHaveBeenCalledWith('SendFlow', expect.objectContaining({
      screen: 'TurboClaiming',
    }));
  };

  describe('Bitcoin addresses', () => {
    const validSegwitAddress = 'tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx';
    const validTaprootAddress = 'tb1pmfr3p9j00pfxjh0zmgp99y8zftmd3s5pmedqhyptwy6lm87hf5ssk79hv2';
    const mainnetSegwitAddress = 'bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4';

    it('should handle bitcoin: addresses', async () => {
      const { result } = renderHookWithProps(mockProps);

      await act(async () => {
        await result.current!(`bitcoin:${validSegwitAddress}`);
      });

      expect(mockNavigate).toHaveBeenCalledWith('SendFlow', {
        screen: 'SendInput',
        params: { assetType: 'btc', prefillAddress: validSegwitAddress },
      });
    });

    it('should handle tb1 addresses', async () => {
      const { result } = renderHookWithProps(mockProps);

      await act(async () => {
        await result.current!(validSegwitAddress);
      });

      expect(mockNavigate).toHaveBeenCalledWith('SendFlow', {
        screen: 'SendInput',
        params: { assetType: 'btc', prefillAddress: validSegwitAddress },
      });
    });

    it('should default Mutinynet taproot addresses to UNIT', async () => {
      const { result } = renderHookWithProps(mockProps);

      await act(async () => {
        await result.current!(validTaprootAddress);
      });

      expect(mockNavigate).toHaveBeenCalledWith('SendFlow', {
        screen: 'SendInput',
        params: { assetType: 'unit', prefillAddress: validTaprootAddress },
      });
    });

    it('should reject mainnet bc1 addresses', async () => {
      const { result } = renderHookWithProps(mockProps);

      await act(async () => {
        await result.current!(mainnetSegwitAddress);
      });

      expect(mockNavigate).not.toHaveBeenCalled();
      expect(mockProps.setShowQRScanner).toHaveBeenCalledWith(false);
      expect(mockProps.showSnackbar).toHaveBeenCalledWith({
        type: 'error',
        action: 'send',
        description: expect.stringContaining('Mainnet address detected'),
      });
    });

    it('should close scanner after handling bitcoin address', async () => {
      const { result } = renderHookWithProps(mockProps);

      await act(async () => {
        await result.current!(`bitcoin:${validSegwitAddress}`);
      });

      expect(mockProps.setShowQRScanner).toHaveBeenCalledWith(false);
    });

    it('should handle bitcoin: with amount parameter', async () => {
      const { result } = renderHookWithProps(mockProps);

      await act(async () => {
        await result.current!(`bitcoin:${validSegwitAddress}?amount=0.001`);
      });

      // Implementation strips the query params from the address
      expect(mockNavigate).toHaveBeenCalledWith('SendFlow', {
        screen: 'SendInput',
        params: { assetType: 'btc', prefillAddress: validSegwitAddress },
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
        await result.current!('cashuBtestP2PKtoken');
      });

      expect(mockSetPendingToken).toHaveBeenCalledWith('cashuBtestP2PKtoken');
      expect(mockProps.setShowQRScanner).toHaveBeenCalledWith(false);
    });

    it('should trigger pending token check via store', async () => {
      const { result } = renderHookWithProps(mockProps);

      await act(async () => {
        await result.current!('cashuBtestP2PKtoken');
      });

      expect(mockTriggerTokenCheck).toHaveBeenCalled();
    });

    it('should show error snackbar for already processed token', async () => {
      mockIsTokenProcessed.mockResolvedValue(true);

      const { result } = renderHookWithProps(mockProps);

      await act(async () => {
        await result.current!('cashuBtestP2PKtoken');
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
        await result.current!('cashuBtestP2PKtoken');
      });

      expect(mockSetPendingToken).toHaveBeenCalledWith('cashuBtestP2PKtoken');
    });
  });

  describe('Cashu tokens - Regular', () => {
    beforeEach(() => {
      mockHasP2PKProofs.mockReturnValue(false);
    });

    it('should claim token when all proofs are unspent', async () => {
      const { result } = renderHookWithProps(mockProps);

      await act(async () => {
        await result.current!('cashuBtesttoken');
      });

      expect(notify.token.checking).toHaveBeenCalled();
      expect(notify.token.claiming).toHaveBeenCalled();
      expect(mockProps.receiveCashuToken).toHaveBeenCalledWith('cashuBtesttoken');
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
        await result.current!('cashuBtesttoken');
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
        await result.current!('cashuBtesttoken');
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
      mockEncodeToken.mockReturnValue('cashuBfiltered');

      const { result } = renderHookWithProps(mockProps);

      await act(async () => {
        await result.current!('cashuBtesttoken');
      });

      // Get the Claim button callback
      const alertCall = (Alert.alert as jest.Mock).mock.calls[0];
      const claimButton = alertCall[2][1];

      await act(async () => {
        await claimButton.onPress();
      });

      expect(notify.token.claimingUnspent).toHaveBeenCalled();
      expect(mockEncodeToken).toHaveBeenCalled();
      expect(mockProps.receiveCashuToken).toHaveBeenCalledWith('cashuBfiltered');
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
        await result.current!('cashuBtesttoken');
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
        await result.current!('cashuBtesttoken');
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
        await result.current!('cashuBtesttoken');
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
        await result.current!('cashuBtesttoken');
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
      expect(mockProps.receiveCashuToken).toHaveBeenCalledWith('cashuBencodedtoken');
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
        await result.current!('ducat://turbo/cashuBbc123xyz');
      });

      expectTurboTokenQueued('cashuBbc123xyz');
    });

    it('should handle URL with t parameter (base64 token)', async () => {
      const base64Token = Buffer.from('cashuBtesttoken').toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=/g, '');

      const { result } = renderHookWithProps(mockProps);

      await act(async () => {
        await result.current!(`https://ducatprotocol.com/unit?t=${base64Token}`);
      });

      expectTurboTokenQueued('cashuBtesttoken');
    });

    it('should handle redeem URL with raw token parameter', async () => {
      const { result } = renderHookWithProps(mockProps);

      await act(async () => {
        await result.current!('https://redeem.ducatprotocol.com?token=cashuBtokenparam');
      });

      expectTurboTokenQueued('cashuBtokenparam');
    });

    it('should handle unit URL with hash token parameter', async () => {
      const { result } = renderHookWithProps(mockProps);

      await act(async () => {
        await result.current!('https://ducatprotocol.com/unit#token=cashuBhashtoken');
      });

      expectTurboTokenQueued('cashuBhashtoken');
    });

    it('should resolve short URLs through the shortener info API', async () => {
      mockFetchWithTimeout.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({
          success: true,
          data: { cashuToken: 'cashuBshorttoken' },
        }),
      });

      const { result } = renderHookWithProps(mockProps);

      await act(async () => {
        await result.current!('https://short.ducatprotocol.com/abc12345');
      });

      expect(mockFetchWithTimeout).toHaveBeenCalledWith(
        'https://short.ducatprotocol.com/api/info/abc12345',
        { method: 'GET' },
        5000,
      );
      expectTurboTokenQueued('cashuBshorttoken');
    });

    it('should add padding to base64 tokens as needed', async () => {
      // Create token that needs 1 padding character
      const token = 'cashuBab';
      const base64Token = Buffer.from(token).toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=/g, '');

      const { result } = renderHookWithProps(mockProps);

      await act(async () => {
        await result.current!(`https://ducatprotocol.com/unit?t=${base64Token}`);
      });

      expectTurboTokenQueued('cashuBab');
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

      expect(notify.token.extractFailed).toHaveBeenCalled();

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

      expect(notify.token.extractFailed).toHaveBeenCalled();

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
