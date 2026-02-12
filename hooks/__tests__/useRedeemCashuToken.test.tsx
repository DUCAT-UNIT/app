/**
 * Tests for useRedeemCashuToken hook
 * Covers token redemption flow including regular and P2PK tokens
 */

import React from 'react';
import { create, act } from 'react-test-renderer';
import { Alert } from 'react-native';
import { useRedeemCashuToken } from '../useRedeemCashuToken';

// Mock dependencies
jest.mock('../../utils/logger', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    transaction: jest.fn(),
    security: jest.fn(),
    screen: jest.fn(),
    action: jest.fn(),
    wallet: jest.fn(),
    cashu: jest.fn(),
    api: jest.fn(),
    auth: jest.fn(),
    perf: jest.fn(),
    turbo: jest.fn(),
    vault: jest.fn(),
    onboarding: jest.fn(),
    startTransaction: jest.fn().mockReturnValue({ finish: jest.fn() }),
    setContext: jest.fn(),
    setTag: jest.fn(),
  },
}));

jest.mock('react-native', () => ({
  Alert: {
    alert: jest.fn(),
    prompt: jest.fn(),
  },
}));

// Mock dynamic imports
const mockDecodeToken = jest.fn();
const mockIsP2PKSecret = jest.fn();
const mockGetP2PKRecipient = jest.fn();
const mockFindAccountForP2PKToken = jest.fn();
const mockGetCurrentAccount = jest.fn();
const mockReceiveP2PKToken = jest.fn();
const mockReceiveToken = jest.fn();

jest.mock('../../services/cashu/crypto', () => ({
  decodeToken: (...args: unknown[]) => mockDecodeToken(...args),
}));

jest.mock('../../services/cashu/p2pk', () => ({
  isP2PKSecret: (...args: unknown[]) => mockIsP2PKSecret(...args),
  getP2PKRecipient: (...args: unknown[]) => mockGetP2PKRecipient(...args),
  findAccountForP2PKToken: (...args: unknown[]) => mockFindAccountForP2PKToken(...args),
}));

jest.mock('../../services/secureStorageService', () => ({
  getCurrentAccount: (...args: unknown[]) => mockGetCurrentAccount(...args),
}));

jest.mock('../../services/cashu/cashuWalletService', () => ({
  receiveP2PKToken: (...args: unknown[]) => mockReceiveP2PKToken(...args),
  receiveToken: (...args: unknown[]) => mockReceiveToken(...args),
}));

// Type for the hook's return value
type UseRedeemCashuTokenReturn = ReturnType<typeof useRedeemCashuToken>;

// Helper to render hooks with props
function renderHookWithProps(props: Record<string, unknown>) {
  const result: { current: UseRedeemCashuTokenReturn | null } = { current: null };
  function TestComponent({ hookProps }: { hookProps?: Parameters<typeof useRedeemCashuToken>[0] }) {
    result.current = useRedeemCashuToken(hookProps!);
    return null;
  }
  let component: ReturnType<typeof create> | undefined;
  act(() => {
    component = create(<TestComponent hookProps={props as unknown as Parameters<typeof useRedeemCashuToken>[0]} />);
  });
  return {
    result,
    unmount: component!.unmount,
    component,
    rerender: (newProps?: Record<string, unknown>) => {
      act(() => {
        component?.update(<TestComponent hookProps={newProps as unknown as Parameters<typeof useRedeemCashuToken>[0]} />);
      });
    },
  };
}

describe('useRedeemCashuToken', () => {
  let mockProps: Record<string, unknown>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockProps = {
      fetchTransactionHistory: jest.fn().mockResolvedValue(undefined),
    };

    // Default mock implementations
    mockDecodeToken.mockReturnValue({
      mint: 'https://mint.example.com',
      proofs: [
        { secret: 'secret1', amount: 100, C: 'C1', id: 'id1' },
      ],
      amount: 100,
    });
    mockIsP2PKSecret.mockReturnValue(false);
    mockGetP2PKRecipient.mockReturnValue(null);
    mockFindAccountForP2PKToken.mockResolvedValue(null);
    mockGetCurrentAccount.mockResolvedValue(0);
    mockReceiveP2PKToken.mockResolvedValue(undefined);
    mockReceiveToken.mockResolvedValue(undefined);
  });

  it('should return handleRedeemToken function', () => {
    const { result } = renderHookWithProps(mockProps);

    expect(typeof result.current!.handleRedeemToken).toBe('function');
  });

  it('should show prompt when handleRedeemToken is called', () => {
    const { result } = renderHookWithProps(mockProps);

    act(() => {
      result.current!.handleRedeemToken();
    });

    expect(Alert.prompt).toHaveBeenCalledWith(
      'Redeem Cashu Token',
      'Paste your Cashu token to redeem:',
      expect.arrayContaining([
        expect.objectContaining({ text: 'Cancel', style: 'cancel' }),
        expect.objectContaining({ text: 'Redeem' }),
      ]),
      'plain-text'
    );
  });

  it('should handle empty token in prompt callback', async () => {
    const { result } = renderHookWithProps(mockProps);

    act(() => {
      result.current!.handleRedeemToken();
    });

    // Get the onPress handler from the Redeem button
    const redeemButton = (Alert.prompt as jest.Mock).mock.calls[0][2][1];

    await act(async () => {
      await redeemButton.onPress('');
    });

    expect(Alert.alert).toHaveBeenCalledWith('Error', 'Please enter a valid token');
  });

  it('should handle whitespace-only token', async () => {
    const { result } = renderHookWithProps(mockProps);

    act(() => {
      result.current!.handleRedeemToken();
    });

    const redeemButton = (Alert.prompt as jest.Mock).mock.calls[0][2][1];

    await act(async () => {
      await redeemButton.onPress('   ');
    });

    expect(Alert.alert).toHaveBeenCalledWith('Error', 'Please enter a valid token');
  });

  it('should handle null token', async () => {
    const { result } = renderHookWithProps(mockProps);

    act(() => {
      result.current!.handleRedeemToken();
    });

    const redeemButton = (Alert.prompt as jest.Mock).mock.calls[0][2][1];

    await act(async () => {
      await redeemButton.onPress(null);
    });

    expect(Alert.alert).toHaveBeenCalledWith('Error', 'Please enter a valid token');
  });

  it('should handle undefined token', async () => {
    const { result } = renderHookWithProps(mockProps);

    act(() => {
      result.current!.handleRedeemToken();
    });

    const redeemButton = (Alert.prompt as jest.Mock).mock.calls[0][2][1];

    await act(async () => {
      await redeemButton.onPress(undefined);
    });

    expect(Alert.alert).toHaveBeenCalledWith('Error', 'Please enter a valid token');
  });

  it('should memoize handleRedeemToken based on fetchTransactionHistory', () => {
    const { result, rerender } = renderHookWithProps(mockProps);
    const firstCallback = result.current!.handleRedeemToken;

    // Same props - callback should be same
    rerender(mockProps);
    expect(result.current!.handleRedeemToken).toBe(firstCallback);

    // Different fetchTransactionHistory - callback should change
    rerender({ fetchTransactionHistory: jest.fn() });
    expect(result.current!.handleRedeemToken).not.toBe(firstCallback);
  });

  it('should return object with handleRedeemToken property', () => {
    const { result } = renderHookWithProps(mockProps);

    expect(result.current).toHaveProperty('handleRedeemToken');
    expect(Object.keys(result.current!)).toHaveLength(1);
  });

  it('should have cancel and redeem buttons in prompt', () => {
    const { result } = renderHookWithProps(mockProps);

    act(() => {
      result.current!.handleRedeemToken();
    });

    const promptCall = (Alert.prompt as jest.Mock).mock.calls[0];
    const buttons = promptCall[2];

    expect(buttons).toHaveLength(2);
    expect(buttons[0].text).toBe('Cancel');
    expect(buttons[0].style).toBe('cancel');
    expect(buttons[1].text).toBe('Redeem');
    expect(typeof buttons[1].onPress).toBe('function');
  });

  it('should use plain-text input type for prompt', () => {
    const { result } = renderHookWithProps(mockProps);

    act(() => {
      result.current!.handleRedeemToken();
    });

    expect((Alert.prompt as jest.Mock).mock.calls[0][3]).toBe('plain-text');
  });

  it('should have correct prompt title', () => {
    const { result } = renderHookWithProps(mockProps);

    act(() => {
      result.current!.handleRedeemToken();
    });

    expect((Alert.prompt as jest.Mock).mock.calls[0][0]).toBe('Redeem Cashu Token');
  });

  it('should have correct prompt message', () => {
    const { result } = renderHookWithProps(mockProps);

    act(() => {
      result.current!.handleRedeemToken();
    });

    expect((Alert.prompt as jest.Mock).mock.calls[0][1]).toBe('Paste your Cashu token to redeem:');
  });

  describe('Token redemption flow', () => {
    it('should redeem valid regular token successfully', async () => {
      const { result } = renderHookWithProps(mockProps);

      act(() => {
        result.current!.handleRedeemToken();
      });

      const redeemButton = (Alert.prompt as jest.Mock).mock.calls[0][2][1];

      await act(async () => {
        await redeemButton.onPress('cashuAvalidtoken');
      });

      expect(mockDecodeToken).toHaveBeenCalledWith('cashuAvalidtoken');
      expect(mockReceiveToken).toHaveBeenCalledWith('cashuAvalidtoken');
      expect(mockProps.fetchTransactionHistory).toHaveBeenCalled();
      expect(Alert.alert).toHaveBeenCalledWith('Success', 'Token redeemed successfully!');
    });

    it('should trim whitespace from token before processing', async () => {
      const { result } = renderHookWithProps(mockProps);

      act(() => {
        result.current!.handleRedeemToken();
      });

      const redeemButton = (Alert.prompt as jest.Mock).mock.calls[0][2][1];

      await act(async () => {
        await redeemButton.onPress('  cashuAvalidtoken  ');
      });

      expect(mockDecodeToken).toHaveBeenCalledWith('cashuAvalidtoken');
    });

    it('should handle invalid token format - null decoded', async () => {
      mockDecodeToken.mockReturnValue(null);
      const { result } = renderHookWithProps(mockProps);

      act(() => {
        result.current!.handleRedeemToken();
      });

      const redeemButton = (Alert.prompt as jest.Mock).mock.calls[0][2][1];

      await act(async () => {
        await redeemButton.onPress('invalidtoken');
      });

      expect(Alert.alert).toHaveBeenCalledWith('Error', 'Invalid token format');
    });

    it('should handle invalid token format - missing proofs', async () => {
      mockDecodeToken.mockReturnValue({ mint: 'https://mint.example.com' });
      const { result } = renderHookWithProps(mockProps);

      act(() => {
        result.current!.handleRedeemToken();
      });

      const redeemButton = (Alert.prompt as jest.Mock).mock.calls[0][2][1];

      await act(async () => {
        await redeemButton.onPress('invalidtoken');
      });

      expect(Alert.alert).toHaveBeenCalledWith('Error', 'Invalid token format');
    });

    it('should handle invalid token format - proofs not array', async () => {
      mockDecodeToken.mockReturnValue({ mint: 'https://mint.example.com', proofs: 'notarray' });
      const { result } = renderHookWithProps(mockProps);

      act(() => {
        result.current!.handleRedeemToken();
      });

      const redeemButton = (Alert.prompt as jest.Mock).mock.calls[0][2][1];

      await act(async () => {
        await redeemButton.onPress('invalidtoken');
      });

      expect(Alert.alert).toHaveBeenCalledWith('Error', 'Invalid token format');
    });

    it('should handle decode token error', async () => {
      mockDecodeToken.mockImplementation(() => {
        throw new Error('Decode failed');
      });
      const { result } = renderHookWithProps(mockProps);

      act(() => {
        result.current!.handleRedeemToken();
      });

      const redeemButton = (Alert.prompt as jest.Mock).mock.calls[0][2][1];

      await act(async () => {
        await redeemButton.onPress('invalidtoken');
      });

      expect(Alert.alert).toHaveBeenCalledWith('Error', 'Failed to redeem token: Decode failed');
    });

    it('should handle non-Error exception during decoding', async () => {
      mockDecodeToken.mockImplementation(() => {
        throw 'String error';
      });
      const { result } = renderHookWithProps(mockProps);

      act(() => {
        result.current!.handleRedeemToken();
      });

      const redeemButton = (Alert.prompt as jest.Mock).mock.calls[0][2][1];

      await act(async () => {
        await redeemButton.onPress('invalidtoken');
      });

      expect(Alert.alert).toHaveBeenCalledWith('Error', 'Failed to redeem token: String error');
    });
  });

  describe('P2PK token redemption', () => {
    beforeEach(() => {
      mockDecodeToken.mockReturnValue({
        mint: 'https://mint.example.com',
        proofs: [
          { secret: 'P2PK:pubkey123', amount: 100, C: 'C1', id: 'id1' },
        ],
        amount: 100,
      });
      mockIsP2PKSecret.mockReturnValue(true);
      mockGetP2PKRecipient.mockReturnValue('02pubkey123456789abcdef');
    });

    it('should detect P2PK token', async () => {
      const { result } = renderHookWithProps(mockProps);

      act(() => {
        result.current!.handleRedeemToken();
      });

      const redeemButton = (Alert.prompt as jest.Mock).mock.calls[0][2][1];

      await act(async () => {
        await redeemButton.onPress('cashuAp2pktoken');
      });

      expect(mockIsP2PKSecret).toHaveBeenCalled();
    });

    it('should redeem P2PK token when account matches', async () => {
      mockFindAccountForP2PKToken.mockResolvedValue({
        accountIndex: 0,
        address: 'bc1ptest123456789',
        privateKey: 'privatekey123',
      });
      mockGetCurrentAccount.mockResolvedValue(0);

      const { result } = renderHookWithProps(mockProps);

      act(() => {
        result.current!.handleRedeemToken();
      });

      const redeemButton = (Alert.prompt as jest.Mock).mock.calls[0][2][1];

      await act(async () => {
        await redeemButton.onPress('cashuAp2pktoken');
      });

      expect(mockReceiveP2PKToken).toHaveBeenCalledWith('cashuAp2pktoken', 'privatekey123');
      expect(mockProps.fetchTransactionHistory).toHaveBeenCalled();
      expect(Alert.alert).toHaveBeenCalledWith('Success', 'P2PK token redeemed successfully!');
    });

    it('should show error when P2PK pubkey cannot be extracted', async () => {
      mockGetP2PKRecipient.mockReturnValue(null);

      const { result } = renderHookWithProps(mockProps);

      act(() => {
        result.current!.handleRedeemToken();
      });

      const redeemButton = (Alert.prompt as jest.Mock).mock.calls[0][2][1];

      await act(async () => {
        await redeemButton.onPress('cashuAp2pktoken');
      });

      expect(Alert.alert).toHaveBeenCalledWith('Error', 'Could not extract recipient pubkey from P2PK token');
    });

    it('should show error when no matching account found for P2PK token', async () => {
      mockFindAccountForP2PKToken.mockResolvedValue(null);

      const { result } = renderHookWithProps(mockProps);

      act(() => {
        result.current!.handleRedeemToken();
      });

      const redeemButton = (Alert.prompt as jest.Mock).mock.calls[0][2][1];

      await act(async () => {
        await redeemButton.onPress('cashuAp2pktoken');
      });

      expect(Alert.alert).toHaveBeenCalledWith(
        'Error',
        'This token is not locked to any of your accounts (checked 50 accounts). Make sure you are using the correct wallet.'
      );
    });

    it('should show wrong account message when P2PK token belongs to different account', async () => {
      mockFindAccountForP2PKToken.mockResolvedValue({
        accountIndex: 2,
        address: 'bc1ptest123456789',
        privateKey: 'privatekey123',
      });
      mockGetCurrentAccount.mockResolvedValue(0);

      const { result } = renderHookWithProps(mockProps);

      act(() => {
        result.current!.handleRedeemToken();
      });

      const redeemButton = (Alert.prompt as jest.Mock).mock.calls[0][2][1];

      await act(async () => {
        await redeemButton.onPress('cashuAp2pktoken');
      });

      expect(Alert.alert).toHaveBeenCalledWith(
        'Wrong Account',
        'This proof belongs to account 3. Please switch to that account to claim this token.'
      );
    });

    it('should iterate through proofs to find pubkey', async () => {
      mockDecodeToken.mockReturnValue({
        mint: 'https://mint.example.com',
        proofs: [
          { secret: 'regular_secret', amount: 50, C: 'C1', id: 'id1' },
          { secret: 'P2PK:pubkey123', amount: 50, C: 'C2', id: 'id2' },
        ],
        amount: 100,
      });
      mockIsP2PKSecret.mockImplementation((secret) => secret.startsWith('P2PK:'));
      mockGetP2PKRecipient.mockImplementation((secret) => {
        if (secret.startsWith('P2PK:')) return '02pubkey123';
        return null;
      });
      mockFindAccountForP2PKToken.mockResolvedValue({
        accountIndex: 0,
        address: 'bc1ptest',
        privateKey: 'pk123',
      });

      const { result } = renderHookWithProps(mockProps);

      act(() => {
        result.current!.handleRedeemToken();
      });

      const redeemButton = (Alert.prompt as jest.Mock).mock.calls[0][2][1];

      await act(async () => {
        await redeemButton.onPress('cashuAp2pktoken');
      });

      expect(mockGetP2PKRecipient).toHaveBeenCalledWith('regular_secret');
      expect(mockGetP2PKRecipient).toHaveBeenCalledWith('P2PK:pubkey123');
    });

    it('should handle proof without secret property', async () => {
      mockDecodeToken.mockReturnValue({
        mint: 'https://mint.example.com',
        proofs: [
          { amount: 50, C: 'C1', id: 'id1' }, // no secret
          { secret: 'P2PK:pubkey123', amount: 50, C: 'C2', id: 'id2' },
        ],
        amount: 100,
      });
      mockIsP2PKSecret.mockReturnValue(true);
      mockGetP2PKRecipient.mockImplementation((secret) => {
        if (secret && secret.startsWith('P2PK:')) return '02pubkey123';
        return null;
      });
      mockFindAccountForP2PKToken.mockResolvedValue({
        accountIndex: 0,
        address: 'bc1ptest',
        privateKey: 'pk123',
      });

      const { result } = renderHookWithProps(mockProps);

      act(() => {
        result.current!.handleRedeemToken();
      });

      const redeemButton = (Alert.prompt as jest.Mock).mock.calls[0][2][1];

      await act(async () => {
        await redeemButton.onPress('cashuAp2pktoken');
      });

      // Should still find the pubkey from the second proof
      expect(mockReceiveP2PKToken).toHaveBeenCalled();
    });
  });

  describe('Error handling', () => {
    it('should handle receiveToken error', async () => {
      mockReceiveToken.mockRejectedValue(new Error('Network error'));

      const { result } = renderHookWithProps(mockProps);

      act(() => {
        result.current!.handleRedeemToken();
      });

      const redeemButton = (Alert.prompt as jest.Mock).mock.calls[0][2][1];

      await act(async () => {
        await redeemButton.onPress('cashuAvalidtoken');
      });

      expect(Alert.alert).toHaveBeenCalledWith('Error', 'Failed to redeem token: Network error');
    });

    it('should handle receiveP2PKToken error', async () => {
      mockIsP2PKSecret.mockReturnValue(true);
      mockGetP2PKRecipient.mockReturnValue('02pubkey123');
      mockFindAccountForP2PKToken.mockResolvedValue({
        accountIndex: 0,
        address: 'bc1ptest',
        privateKey: 'pk123',
      });
      mockReceiveP2PKToken.mockRejectedValue(new Error('P2PK error'));

      const { result } = renderHookWithProps(mockProps);

      act(() => {
        result.current!.handleRedeemToken();
      });

      const redeemButton = (Alert.prompt as jest.Mock).mock.calls[0][2][1];

      await act(async () => {
        await redeemButton.onPress('cashuAp2pktoken');
      });

      expect(Alert.alert).toHaveBeenCalledWith('Error', 'Failed to redeem token: P2PK error');
    });

    it('should handle non-Error exception during redemption', async () => {
      mockReceiveToken.mockRejectedValue('String rejection');

      const { result } = renderHookWithProps(mockProps);

      act(() => {
        result.current!.handleRedeemToken();
      });

      const redeemButton = (Alert.prompt as jest.Mock).mock.calls[0][2][1];

      await act(async () => {
        await redeemButton.onPress('cashuAvalidtoken');
      });

      expect(Alert.alert).toHaveBeenCalledWith('Error', 'Failed to redeem token: String rejection');
    });
  });
});
