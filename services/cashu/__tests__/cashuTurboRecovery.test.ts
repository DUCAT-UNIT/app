/**
 * Tests for cashuTurboRecovery service
 */

import * as SecureStore from 'expo-secure-store';
import {
  savePendingTurboSend,
  updateTurboSendStage,
  loadPendingTurboSend,
  clearPendingTurboSend,
  hasPendingTurboSend,
  recoverPendingTurboSend,
  PendingTurboSend,
} from '../cashuTurboRecovery';

// Mock dependencies
jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

jest.mock('../../../utils/logger', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

jest.mock('../cashuProofManager', () => ({
  getCurrentCashuAccount: jest.fn(() => null),
}));

const mockCheckMintStatus = jest.fn();
const mockCompleteMint = jest.fn();
const mockGetBalance = jest.fn();

jest.mock('../operations/cashuMintOperations', () => ({
  checkMintStatus: (...args: unknown[]) => mockCheckMintStatus(...args),
  completeMint: (...args: unknown[]) => mockCompleteMint(...args),
}));

jest.mock('../cashuBalanceService', () => ({
  getBalance: (...args: unknown[]) => mockGetBalance(...args),
}));

import { getCurrentCashuAccount } from '../cashuProofManager';

describe('cashuTurboRecovery', () => {
  const mockQuoteId = 'quote123456';
  const mockRecipient = 'tb1precipientsaddress1234567890';
  const mockAmount = 1000;
  const mockSenderAddress = 'tb1psendersaddress1234567890';

  beforeEach(() => {
    jest.clearAllMocks();
    (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(null);
    (SecureStore.setItemAsync as jest.Mock).mockResolvedValue(undefined);
    (SecureStore.deleteItemAsync as jest.Mock).mockResolvedValue(undefined);
    (getCurrentCashuAccount as jest.Mock).mockReturnValue(mockSenderAddress);
    mockCheckMintStatus.mockResolvedValue({ state: 'UNPAID', availableAmount: 0 });
    mockCompleteMint.mockResolvedValue([]);
    mockGetBalance.mockResolvedValue(mockAmount);
  });

  describe('savePendingTurboSend', () => {
    it('should save pending turbo send', async () => {
      await savePendingTurboSend(mockQuoteId, mockRecipient, mockAmount, mockSenderAddress);

      expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
        expect.stringMatching(/^cashu_pending_turbo_send_tb1psendersaddress1234567890_quote123456$/),
        expect.stringContaining(mockQuoteId),
        expect.any(Object)
      );
    });

    it('should save with waiting_for_mint stage', async () => {
      await savePendingTurboSend(mockQuoteId, mockRecipient, mockAmount, mockSenderAddress);

      const savedData = JSON.parse(
        (SecureStore.setItemAsync as jest.Mock).mock.calls[0][1]
      );
      expect(savedData.stage).toBe('waiting_for_mint');
      expect(savedData.quoteId).toBe(mockQuoteId);
      expect(savedData.recipient).toBe(mockRecipient);
      expect(savedData.amount).toBe(mockAmount);
      expect(savedData.senderTaprootAddress).toBe(mockSenderAddress);
      expect(savedData.preMintBalance).toBe(mockAmount);
    });

    it('should include timestamp', async () => {
      const beforeTime = Date.now();

      await savePendingTurboSend(mockQuoteId, mockRecipient, mockAmount, mockSenderAddress);

      const savedData = JSON.parse(
        (SecureStore.setItemAsync as jest.Mock).mock.calls[0][1]
      );
      expect(savedData.createdAt).toBeGreaterThanOrEqual(beforeTime);
    });

    it('should persist a separate mint claim amount for top-up sends', async () => {
      await savePendingTurboSend(
        mockQuoteId,
        mockRecipient,
        mockAmount,
        mockSenderAddress,
        'sat',
        400
      );

      const savedData = JSON.parse(
        (SecureStore.setItemAsync as jest.Mock).mock.calls[0][1]
      );
      expect(savedData.amount).toBe(mockAmount);
      expect(savedData.mintAmount).toBe(400);
      expect(savedData.unit).toBe('sat');
    });

    it('should throw on storage errors before starting the turbo send', async () => {
      (SecureStore.setItemAsync as jest.Mock).mockRejectedValue(new Error('Storage error'));

      await expect(
        savePendingTurboSend(mockQuoteId, mockRecipient, mockAmount, mockSenderAddress)
      ).rejects.toThrow('Storage error');
    });

    it('should not overwrite a corrupt turbo registry and should write a legacy fallback', async () => {
      (SecureStore.getItemAsync as jest.Mock).mockImplementation((key: string) => {
        if (key === 'cashu_pending_turbo_sends_v1') {
          return Promise.resolve('not json');
        }
        return Promise.resolve(null);
      });

      await savePendingTurboSend(mockQuoteId, mockRecipient, mockAmount, mockSenderAddress);

      expect((SecureStore.setItemAsync as jest.Mock).mock.calls.some(
        ([key]) => key === 'cashu_pending_turbo_sends_v1',
      )).toBe(false);
      expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
        expect.stringMatching(/^cashu_pending_turbo_sends_v1_corrupt_/),
        'not json',
        expect.any(Object),
      );
      expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
        'cashu_pending_turbo_send',
        expect.stringContaining(mockQuoteId),
        expect.any(Object),
      );
    });

    it('should keep separate pending sends for different quotes on the same account', async () => {
      (SecureStore.getItemAsync as jest.Mock).mockImplementation((key: string) => {
        if (key === 'cashu_pending_turbo_sends_v1') {
          return Promise.resolve(JSON.stringify(['cashu_pending_turbo_send_existing_quote']));
        }
        return Promise.resolve(null);
      });

      await savePendingTurboSend(mockQuoteId, mockRecipient, mockAmount, mockSenderAddress);

      const registryWrite = (SecureStore.setItemAsync as jest.Mock).mock.calls.find(
        ([key]) => key === 'cashu_pending_turbo_sends_v1'
      );
      expect(registryWrite).toBeDefined();
      const registry = JSON.parse(registryWrite[1]);
      expect(registry).toEqual([
        'cashu_pending_turbo_send_existing_quote',
        'cashu_pending_turbo_send_tb1psendersaddress1234567890_quote123456',
      ]);
    });

    it('should not downgrade an existing advanced recovery entry', async () => {
      const storageKey = 'cashu_pending_turbo_send_tb1psendersaddress1234567890_quote123456';
      const advancedPending: PendingTurboSend = {
        quoteId: mockQuoteId,
        recipient: mockRecipient,
        amount: mockAmount,
        senderTaprootAddress: mockSenderAddress,
        createdAt: Date.now(),
        stage: 'p2pk_created',
        token: 'cashuBpersisted',
      };
      (SecureStore.getItemAsync as jest.Mock).mockImplementation((key: string) => {
        if (key === 'cashu_pending_turbo_sends_v1') {
          return Promise.resolve(JSON.stringify([storageKey]));
        }
        if (key === storageKey) {
          return Promise.resolve(JSON.stringify(advancedPending));
        }
        return Promise.resolve(null);
      });

      await savePendingTurboSend(mockQuoteId, mockRecipient, mockAmount, mockSenderAddress);

      expect(SecureStore.setItemAsync).not.toHaveBeenCalled();
    });
  });

  describe('updateTurboSendStage', () => {
    it('should update stage of existing pending send', async () => {
      const pending: PendingTurboSend = {
        quoteId: mockQuoteId,
        recipient: mockRecipient,
        amount: mockAmount,
        senderTaprootAddress: mockSenderAddress,
        createdAt: Date.now(),
        stage: 'waiting_for_mint',
      };
      (SecureStore.getItemAsync as jest.Mock).mockImplementation((key: string) => {
        if (key === 'cashu_pending_turbo_send') {
          return Promise.resolve(JSON.stringify(pending));
        }
        return Promise.resolve(null);
      });

      await updateTurboSendStage('mint_completed');

      const savedData = JSON.parse(
        (SecureStore.setItemAsync as jest.Mock).mock.calls[0][1]
      );
      expect(savedData.stage).toBe('mint_completed');
    });

    it('should do nothing if no pending send', async () => {
      await updateTurboSendStage('mint_completed');

      expect(SecureStore.setItemAsync).not.toHaveBeenCalled();
    });

    it('should handle errors gracefully', async () => {
      (SecureStore.getItemAsync as jest.Mock).mockRejectedValue(new Error('Storage error'));

      await expect(updateTurboSendStage('mint_completed')).resolves.not.toThrow();
    });

    it('updates the selected quote instead of the oldest pending turbo send', async () => {
      const olderPending: PendingTurboSend = {
        quoteId: 'quote_old',
        recipient: mockRecipient,
        amount: mockAmount,
        senderTaprootAddress: mockSenderAddress,
        createdAt: Date.now() - 1000,
        stage: 'waiting_for_mint',
      };
      const selectedPending: PendingTurboSend = {
        quoteId: 'quote_new',
        recipient: mockRecipient,
        amount: mockAmount,
        senderTaprootAddress: mockSenderAddress,
        createdAt: Date.now(),
        stage: 'waiting_for_mint',
      };

      (SecureStore.getItemAsync as jest.Mock).mockImplementation((key: string) => {
        if (key === 'cashu_pending_turbo_sends_v1') {
          return Promise.resolve(JSON.stringify(['turbo_old', 'turbo_new']));
        }
        if (key === 'turbo_old') return Promise.resolve(JSON.stringify(olderPending));
        if (key === 'turbo_new') return Promise.resolve(JSON.stringify(selectedPending));
        return Promise.resolve(null);
      });

      await updateTurboSendStage(
        'p2pk_created',
        { token: 'cashuBselected' },
        { quoteId: 'quote_new', senderTaprootAddress: mockSenderAddress }
      );

      expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
        'turbo_new',
        expect.stringContaining('cashuBselected'),
        expect.any(Object)
      );
      expect(SecureStore.setItemAsync).not.toHaveBeenCalledWith(
        'turbo_old',
        expect.any(String),
        expect.any(Object)
      );
    });
  });

  describe('loadPendingTurboSend', () => {
    it('should return null if no pending send', async () => {
      const result = await loadPendingTurboSend();

      expect(result).toBeNull();
    });

    it('should return pending send if exists', async () => {
      const pending: PendingTurboSend = {
        quoteId: mockQuoteId,
        recipient: mockRecipient,
        amount: mockAmount,
        senderTaprootAddress: mockSenderAddress,
        createdAt: Date.now(),
        stage: 'waiting_for_mint',
      };
      (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(JSON.stringify(pending));

      const result = await loadPendingTurboSend();

      expect(result).toEqual(pending);
    });

    it('should clear and return null if expired (> 24 hours)', async () => {
      const expiredPending: PendingTurboSend = {
        quoteId: mockQuoteId,
        recipient: mockRecipient,
        amount: mockAmount,
        senderTaprootAddress: mockSenderAddress,
        createdAt: Date.now() - 25 * 60 * 60 * 1000, // 25 hours ago
        stage: 'waiting_for_mint',
      };
      (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(JSON.stringify(expiredPending));

      const result = await loadPendingTurboSend();

      expect(result).toBeNull();
      expect(SecureStore.deleteItemAsync).toHaveBeenCalled();
    });

    it('should keep expired waiting sends when the quote is already paid', async () => {
      const expiredPaidPending: PendingTurboSend = {
        quoteId: mockQuoteId,
        recipient: mockRecipient,
        amount: mockAmount,
        senderTaprootAddress: mockSenderAddress,
        createdAt: Date.now() - 25 * 60 * 60 * 1000,
        stage: 'waiting_for_mint',
        unit: 'sat',
      };
      (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(JSON.stringify(expiredPaidPending));
      mockCheckMintStatus.mockResolvedValue({ state: 'PAID', paid: true, availableAmount: 0 });

      const result = await loadPendingTurboSend();

      expect(result).toEqual(expiredPaidPending);
      expect(SecureStore.deleteItemAsync).not.toHaveBeenCalled();
    });

    it('should keep expired waiting sends when mint status cannot be checked', async () => {
      const expiredPending: PendingTurboSend = {
        quoteId: mockQuoteId,
        recipient: mockRecipient,
        amount: mockAmount,
        senderTaprootAddress: mockSenderAddress,
        createdAt: Date.now() - 25 * 60 * 60 * 1000,
        stage: 'waiting_for_mint',
      };
      (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(JSON.stringify(expiredPending));
      mockCheckMintStatus.mockRejectedValue(new Error('mint down'));

      const result = await loadPendingTurboSend();

      expect(result).toEqual(expiredPending);
      expect(SecureStore.deleteItemAsync).not.toHaveBeenCalled();
    });

    it('should keep expired pending sends once a P2PK token is recoverable', async () => {
      const expiredWithToken: PendingTurboSend = {
        quoteId: mockQuoteId,
        recipient: mockRecipient,
        amount: mockAmount,
        senderTaprootAddress: mockSenderAddress,
        createdAt: Date.now() - 25 * 60 * 60 * 1000,
        stage: 'p2pk_created',
        token: 'cashuBtoken',
      };
      (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(JSON.stringify(expiredWithToken));

      const result = await loadPendingTurboSend();

      expect(result).toEqual(expiredWithToken);
      expect(SecureStore.deleteItemAsync).not.toHaveBeenCalled();
    });

    it('should load the pending send for the current Cashu account', async () => {
      const pendingA: PendingTurboSend = {
        quoteId: 'quote_a',
        recipient: mockRecipient,
        amount: mockAmount,
        senderTaprootAddress: 'account_a',
        createdAt: Date.now(),
        stage: 'waiting_for_mint',
      };
      const pendingB: PendingTurboSend = {
        quoteId: 'quote_b',
        recipient: mockRecipient,
        amount: mockAmount,
        senderTaprootAddress: 'account_b',
        createdAt: Date.now(),
        stage: 'mint_completed',
      };
      (getCurrentCashuAccount as jest.Mock).mockReturnValue('account_b');
      (SecureStore.getItemAsync as jest.Mock).mockImplementation((key: string) => {
        if (key === 'cashu_pending_turbo_sends_v1') {
          return Promise.resolve(JSON.stringify(['turbo_a', 'turbo_b']));
        }
        if (key === 'turbo_a') return Promise.resolve(JSON.stringify(pendingA));
        if (key === 'turbo_b') return Promise.resolve(JSON.stringify(pendingB));
        return Promise.resolve(null);
      });

      const result = await loadPendingTurboSend();

      expect(result).toEqual(pendingB);
    });

    it('should load the latest legacy fallback when the turbo registry is corrupt', async () => {
      const pending: PendingTurboSend = {
        quoteId: mockQuoteId,
        recipient: mockRecipient,
        amount: mockAmount,
        senderTaprootAddress: mockSenderAddress,
        createdAt: Date.now(),
        stage: 'p2pk_created',
        token: 'cashuBpersisted',
      };
      (SecureStore.getItemAsync as jest.Mock).mockImplementation((key: string) => {
        if (key === 'cashu_pending_turbo_sends_v1') {
          return Promise.resolve('{bad json');
        }
        if (key === 'cashu_pending_turbo_send') {
          return Promise.resolve(JSON.stringify(pending));
        }
        return Promise.resolve(null);
      });

      const result = await loadPendingTurboSend();

      expect(result).toEqual(pending);
      expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
        expect.stringMatching(/^cashu_pending_turbo_sends_v1_corrupt_/),
        '{bad json',
        expect.any(Object)
      );
    });

    it('should not load account-tagged pending sends before the current account is initialized', async () => {
      (getCurrentCashuAccount as jest.Mock).mockReturnValue(null);
      const pending: PendingTurboSend = {
        quoteId: mockQuoteId,
        recipient: mockRecipient,
        amount: mockAmount,
        senderTaprootAddress: mockSenderAddress,
        createdAt: Date.now(),
        stage: 'mint_completed',
      };
      const storageKey = 'cashu_pending_turbo_send_tb1psendersaddress1234567890_quote123456';
      (SecureStore.getItemAsync as jest.Mock).mockImplementation((key: string) => {
        if (key === 'cashu_pending_turbo_sends_v1') {
          return Promise.resolve(JSON.stringify([storageKey]));
        }
        if (key === storageKey) {
          return Promise.resolve(JSON.stringify(pending));
        }
        return Promise.resolve(null);
      });

      await expect(loadPendingTurboSend()).resolves.toBeNull();
    });

    it('should prefer an advanced legacy fallback over a stale primary entry for the same send', async () => {
      const storageKey = 'cashu_pending_turbo_send_tb1psendersaddress1234567890_quote123456';
      const stalePrimary: PendingTurboSend = {
        quoteId: mockQuoteId,
        recipient: mockRecipient,
        amount: mockAmount,
        senderTaprootAddress: mockSenderAddress,
        createdAt: Date.now(),
        stage: 'mint_completed',
      };
      const advancedFallback: PendingTurboSend = {
        ...stalePrimary,
        stage: 'p2pk_created',
        token: 'cashuBpersisted',
      };

      (SecureStore.getItemAsync as jest.Mock).mockImplementation((key: string) => {
        if (key === 'cashu_pending_turbo_sends_v1') {
          return Promise.resolve(JSON.stringify([storageKey]));
        }
        if (key === storageKey) return Promise.resolve(JSON.stringify(stalePrimary));
        if (key === 'cashu_pending_turbo_send') {
          return Promise.resolve(JSON.stringify(advancedFallback));
        }
        return Promise.resolve(null);
      });

      const result = await loadPendingTurboSend();

      expect(result).toEqual(advancedFallback);
    });

    it('should handle parse errors gracefully', async () => {
      (SecureStore.getItemAsync as jest.Mock).mockResolvedValue('invalid json');

      const result = await loadPendingTurboSend();

      expect(result).toBeNull();
    });
  });

  describe('clearPendingTurboSend', () => {
    it('should delete pending turbo send', async () => {
      await clearPendingTurboSend();

      expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('cashu_pending_turbo_send');
    });

    it('should not delete the legacy fallback when a selector has no match', async () => {
      await clearPendingTurboSend({
        quoteId: 'missing-quote',
        senderTaprootAddress: mockSenderAddress,
        unit: 'sat',
      });

      expect(SecureStore.deleteItemAsync).not.toHaveBeenCalledWith('cashu_pending_turbo_send');
    });

    it('should handle delete errors gracefully', async () => {
      (SecureStore.deleteItemAsync as jest.Mock).mockRejectedValue(new Error('Delete error'));

      await expect(clearPendingTurboSend()).resolves.not.toThrow();
    });
  });

  describe('hasPendingTurboSend', () => {
    it('should return false if no pending send', async () => {
      const result = await hasPendingTurboSend();

      expect(result).toBe(false);
    });

    it('should return true if pending send exists', async () => {
      const pending: PendingTurboSend = {
        quoteId: mockQuoteId,
        recipient: mockRecipient,
        amount: mockAmount,
        senderTaprootAddress: mockSenderAddress,
        createdAt: Date.now(),
        stage: 'waiting_for_mint',
      };
      (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(JSON.stringify(pending));

      const result = await hasPendingTurboSend();

      expect(result).toBe(true);
    });
  });

  describe('recoverPendingTurboSend', () => {
    const mockSendP2PKToken = jest.fn();
    const mockExtractPubkey = jest.fn();
    const mockShortenToken = jest.fn();
    const mockSaveToken = jest.fn();

    beforeEach(() => {
      mockSendP2PKToken.mockResolvedValue({ token: 'cashuBtoken123' });
      mockExtractPubkey.mockReturnValue('02abc123pubkey');
      mockShortenToken.mockResolvedValue('https://short.url/abc');
      mockSaveToken.mockResolvedValue(undefined);
    });

    it('should return not recovered if no pending send', async () => {
      const result = await recoverPendingTurboSend(
        mockSendP2PKToken,
        mockExtractPubkey,
        mockShortenToken,
        mockSaveToken
      );

      expect(result.recovered).toBe(false);
    });

    it('should return not recovered for waiting_for_mint stage', async () => {
      const pending: PendingTurboSend = {
        quoteId: mockQuoteId,
        recipient: mockRecipient,
        amount: mockAmount,
        senderTaprootAddress: mockSenderAddress,
        createdAt: Date.now(),
        stage: 'waiting_for_mint',
      };
      (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(JSON.stringify(pending));

      const result = await recoverPendingTurboSend(
        mockSendP2PKToken,
        mockExtractPubkey,
        mockShortenToken,
        mockSaveToken
      );

      expect(result.recovered).toBe(false);
    });

    it('should not recover account-tagged pending sends before account initialization', async () => {
      (getCurrentCashuAccount as jest.Mock).mockReturnValue(null);
      const pending: PendingTurboSend = {
        quoteId: mockQuoteId,
        recipient: mockRecipient,
        amount: mockAmount,
        senderTaprootAddress: mockSenderAddress,
        createdAt: Date.now(),
        stage: 'mint_completed',
      };
      const storageKey = 'cashu_pending_turbo_send_tb1psendersaddress1234567890_quote123456';
      (SecureStore.getItemAsync as jest.Mock).mockImplementation((key: string) => {
        if (key === 'cashu_pending_turbo_sends_v1') {
          return Promise.resolve(JSON.stringify([storageKey]));
        }
        if (key === storageKey) {
          return Promise.resolve(JSON.stringify(pending));
        }
        return Promise.resolve(null);
      });

      const result = await recoverPendingTurboSend(
        mockSendP2PKToken,
        mockExtractPubkey,
        mockShortenToken,
        mockSaveToken
      );

      expect(result.recovered).toBe(false);
      expect(mockSendP2PKToken).not.toHaveBeenCalled();
      expect(mockSaveToken).not.toHaveBeenCalled();
    });

    it('should skip an unpaid older send and recover a later actionable send', async () => {
      const olderWaiting: PendingTurboSend = {
        quoteId: 'quote_unpaid',
        recipient: 'tb1punpaidrecipient1234567890',
        amount: 500,
        senderTaprootAddress: mockSenderAddress,
        createdAt: Date.now() - 5000,
        stage: 'waiting_for_mint',
      };
      const laterReady: PendingTurboSend = {
        quoteId: 'quote_ready',
        recipient: mockRecipient,
        amount: mockAmount,
        senderTaprootAddress: mockSenderAddress,
        createdAt: Date.now(),
        stage: 'mint_completed',
        unit: 'sat',
      };

      (SecureStore.getItemAsync as jest.Mock).mockImplementation((key: string) => {
        if (key === 'cashu_pending_turbo_sends_v1') {
          return Promise.resolve(JSON.stringify(['turbo_unpaid', 'turbo_ready']));
        }
        if (key === 'turbo_unpaid') return Promise.resolve(JSON.stringify(olderWaiting));
        if (key === 'turbo_ready') return Promise.resolve(JSON.stringify(laterReady));
        return Promise.resolve(null);
      });

      const result = await recoverPendingTurboSend(
        mockSendP2PKToken,
        mockExtractPubkey,
        mockShortenToken,
        mockSaveToken
      );

      expect(result.recovered).toBe(true);
      expect(result.token).toBe('cashuBtoken123');
      expect(mockCheckMintStatus).toHaveBeenCalledWith('quote_unpaid');
      expect(mockSendP2PKToken).toHaveBeenCalledWith(
        mockAmount,
        '02abc123pubkey',
        {},
        undefined,
        mockRecipient,
        'sat'
      );
      expect(mockSaveToken).toHaveBeenCalledWith(
        'cashuBtoken123',
        mockRecipient,
        mockAmount,
        null,
        'https://short.url/abc',
        mockSenderAddress,
        'sat'
      );
    });

    it('should drain both UNIT and sat actionable sends in one recovery pass', async () => {
      const unitPending: PendingTurboSend = {
        quoteId: 'quote_unit',
        recipient: 'tb1punitrecipient1234567890',
        amount: 1200,
        senderTaprootAddress: mockSenderAddress,
        createdAt: Date.now() - 1000,
        stage: 'mint_completed',
      };
      const satPending: PendingTurboSend = {
        quoteId: 'quote_sat',
        recipient: 'tb1psatrecipient1234567890',
        amount: 900,
        senderTaprootAddress: mockSenderAddress,
        createdAt: Date.now(),
        stage: 'mint_completed',
        unit: 'sat',
      };

      mockSendP2PKToken
        .mockResolvedValueOnce({ token: 'cashuBunit' })
        .mockResolvedValueOnce({ token: 'cashuBsat' });
      mockShortenToken.mockImplementation((token: string) =>
        Promise.resolve(token === 'cashuBunit' ? 'https://short.url/unit' : 'https://short.url/sat')
      );

      (SecureStore.getItemAsync as jest.Mock).mockImplementation((key: string) => {
        if (key === 'cashu_pending_turbo_sends_v1') {
          return Promise.resolve(JSON.stringify(['turbo_unit', 'turbo_sat']));
        }
        if (key === 'turbo_unit') return Promise.resolve(JSON.stringify(unitPending));
        if (key === 'turbo_sat') return Promise.resolve(JSON.stringify(satPending));
        return Promise.resolve(null);
      });

      const result = await recoverPendingTurboSend(
        mockSendP2PKToken,
        mockExtractPubkey,
        mockShortenToken,
        mockSaveToken
      );

      expect(result.recovered).toBe(true);
      expect(result.token).toBe('cashuBunit');
      expect(mockSendP2PKToken).toHaveBeenCalledTimes(2);
      expect(mockSendP2PKToken).toHaveBeenCalledWith(
        1200,
        '02abc123pubkey',
        {},
        undefined,
        unitPending.recipient
      );
      expect(mockSendP2PKToken).toHaveBeenCalledWith(
        900,
        '02abc123pubkey',
        {},
        undefined,
        satPending.recipient,
        'sat'
      );
      expect(mockSaveToken).toHaveBeenCalledWith(
        'cashuBunit',
        unitPending.recipient,
        1200,
        null,
        'https://short.url/unit',
        mockSenderAddress
      );
      expect(mockSaveToken).toHaveBeenCalledWith(
        'cashuBsat',
        satPending.recipient,
        900,
        null,
        'https://short.url/sat',
        mockSenderAddress,
        'sat'
      );
    });

    it('should not advance an issued mint until recovered proofs are spendable', async () => {
      const pending: PendingTurboSend = {
        quoteId: mockQuoteId,
        recipient: mockRecipient,
        amount: mockAmount,
        senderTaprootAddress: mockSenderAddress,
        createdAt: Date.now(),
        stage: 'waiting_for_mint',
      };
      (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(JSON.stringify(pending));
      mockCheckMintStatus.mockResolvedValue({ state: 'ISSUED', availableAmount: 0 });
      mockGetBalance.mockResolvedValue(mockAmount - 1);

      const result = await recoverPendingTurboSend(
        mockSendP2PKToken,
        mockExtractPubkey,
        mockShortenToken,
        mockSaveToken
      );

      expect(result.recovered).toBe(false);
      expect(result.error).toContain('not spendable');
      expect(mockSendP2PKToken).not.toHaveBeenCalled();
      expect(SecureStore.setItemAsync).not.toHaveBeenCalledWith(
        expect.any(String),
        expect.stringContaining('mint_completed'),
        expect.any(Object)
      );
    });

    it('should not spend existing balance when issued top-up proofs are not recovered', async () => {
      const pending: PendingTurboSend = {
        quoteId: mockQuoteId,
        recipient: mockRecipient,
        amount: mockAmount,
        mintAmount: 400,
        preMintBalance: 700,
        senderTaprootAddress: mockSenderAddress,
        createdAt: Date.now(),
        stage: 'waiting_for_mint',
        unit: 'sat',
      };
      (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(JSON.stringify(pending));
      mockCheckMintStatus.mockResolvedValue({ state: 'ISSUED', availableAmount: 0 });
      mockGetBalance.mockResolvedValue(1000);

      const result = await recoverPendingTurboSend(
        mockSendP2PKToken,
        mockExtractPubkey,
        mockShortenToken,
        mockSaveToken
      );

      expect(result.recovered).toBe(false);
      expect(result.error).toContain('not spendable');
      expect(mockSendP2PKToken).not.toHaveBeenCalled();
      expect(SecureStore.setItemAsync).not.toHaveBeenCalledWith(
        expect.any(String),
        expect.stringContaining('mint_completed'),
        expect.any(Object)
      );
    });

    it('should claim only the persisted mint amount when recovering a top-up send', async () => {
      const pending: PendingTurboSend = {
        quoteId: mockQuoteId,
        recipient: mockRecipient,
        amount: mockAmount,
        mintAmount: 400,
        senderTaprootAddress: mockSenderAddress,
        createdAt: Date.now(),
        stage: 'waiting_for_mint',
        unit: 'sat',
      };
      (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(JSON.stringify(pending));
      mockCheckMintStatus.mockResolvedValue({ state: 'PAID', availableAmount: 0 });
      mockGetBalance.mockResolvedValue(mockAmount);

      const result = await recoverPendingTurboSend(
        mockSendP2PKToken,
        mockExtractPubkey,
        mockShortenToken,
        mockSaveToken
      );

      expect(result.recovered).toBe(true);
      expect(mockCompleteMint).toHaveBeenCalledWith(mockQuoteId, 400, 'sat');
      expect(mockSendP2PKToken).toHaveBeenCalledWith(
        mockAmount,
        '02abc123pubkey',
        {},
        undefined,
        mockRecipient,
        'sat'
      );
    });

    it('should recover from mint_completed stage', async () => {
      const pending: PendingTurboSend = {
        quoteId: mockQuoteId,
        recipient: mockRecipient,
        amount: mockAmount,
        senderTaprootAddress: mockSenderAddress,
        createdAt: Date.now(),
        stage: 'mint_completed',
      };
      (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(JSON.stringify(pending));

      const result = await recoverPendingTurboSend(
        mockSendP2PKToken,
        mockExtractPubkey,
        mockShortenToken,
        mockSaveToken
      );

      expect(result.recovered).toBe(true);
      expect(result.token).toBe('cashuBtoken123');
      expect(result.deeplink).toBe('https://short.url/abc');
      expect(result.recipient).toBe(mockRecipient);
      expect(result.amount).toBe(mockAmount);

      expect(mockExtractPubkey).toHaveBeenCalledWith(mockRecipient);
      expect(mockSendP2PKToken).toHaveBeenCalledWith(
        mockAmount,
        '02abc123pubkey',
        {},
        undefined,
        mockRecipient
      );
      expect(mockShortenToken).toHaveBeenCalledWith('cashuBtoken123');
      expect(mockSaveToken).toHaveBeenCalledWith(
        'cashuBtoken123',
        mockRecipient,
        mockAmount,
        null,
        null,
        mockSenderAddress
      );
      expect(mockSaveToken).toHaveBeenCalledWith(
        'cashuBtoken123',
        mockRecipient,
        mockAmount,
        null,
        'https://short.url/abc',
        mockSenderAddress
      );
      expect(SecureStore.deleteItemAsync).toHaveBeenCalled();
    });

    it('should clear recovery with a direct deeplink when shortening fails after token creation', async () => {
      const pending: PendingTurboSend = {
        quoteId: mockQuoteId,
        recipient: mockRecipient,
        amount: mockAmount,
        senderTaprootAddress: mockSenderAddress,
        createdAt: Date.now(),
        stage: 'mint_completed',
        unit: 'sat',
      };
      (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(JSON.stringify(pending));
      mockShortenToken.mockRejectedValue(new Error('shortener down'));

      const result = await recoverPendingTurboSend(
        mockSendP2PKToken,
        mockExtractPubkey,
        mockShortenToken,
        mockSaveToken
      );

      expect(result.recovered).toBe(true);
      expect(result.deeplink).toBe('ducat://turbo/cashuBtoken123');
      expect(mockSaveToken).toHaveBeenCalledWith(
        'cashuBtoken123',
        mockRecipient,
        mockAmount,
        null,
        'ducat://turbo/cashuBtoken123',
        mockSenderAddress,
        'sat'
      );
      expect(SecureStore.deleteItemAsync).toHaveBeenCalled();
    });

    it('should re-save and clear for p2pk_created stage with persisted token', async () => {
      const pending: PendingTurboSend = {
        quoteId: mockQuoteId,
        recipient: mockRecipient,
        amount: mockAmount,
        senderTaprootAddress: mockSenderAddress,
        createdAt: Date.now(),
        stage: 'p2pk_created',
        token: 'cashuBpersisted',
        shortUrl: 'https://short.url/persisted',
      };
      (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(JSON.stringify(pending));

      const result = await recoverPendingTurboSend(
        mockSendP2PKToken,
        mockExtractPubkey,
        mockShortenToken,
        mockSaveToken
      );

      expect(result.recovered).toBe(true);
      expect(result.token).toBe('cashuBpersisted');
      expect(result.deeplink).toBe('https://short.url/persisted');
      expect(mockSaveToken).toHaveBeenCalledWith(
        'cashuBpersisted',
        mockRecipient,
        mockAmount,
        null,
        'https://short.url/persisted',
        mockSenderAddress
      );
      expect(SecureStore.deleteItemAsync).toHaveBeenCalled();
      expect(mockSendP2PKToken).not.toHaveBeenCalled();
    });

    it('should clear stale primary records when recovery completes from an advanced legacy fallback', async () => {
      const storageKey = 'cashu_pending_turbo_send_tb1psendersaddress1234567890_quote123456';
      const stalePrimary: PendingTurboSend = {
        quoteId: mockQuoteId,
        recipient: mockRecipient,
        amount: mockAmount,
        senderTaprootAddress: mockSenderAddress,
        createdAt: Date.now(),
        stage: 'mint_completed',
      };
      const advancedFallback: PendingTurboSend = {
        ...stalePrimary,
        stage: 'p2pk_created',
        token: 'cashuBpersisted',
        shortUrl: 'https://short.url/persisted',
      };

      (SecureStore.getItemAsync as jest.Mock).mockImplementation((key: string) => {
        if (key === 'cashu_pending_turbo_sends_v1') {
          return Promise.resolve(JSON.stringify([storageKey]));
        }
        if (key === storageKey) {
          return Promise.resolve(JSON.stringify(stalePrimary));
        }
        if (key === 'cashu_pending_turbo_send') {
          return Promise.resolve(JSON.stringify(advancedFallback));
        }
        return Promise.resolve(null);
      });

      const result = await recoverPendingTurboSend(
        mockSendP2PKToken,
        mockExtractPubkey,
        mockShortenToken,
        mockSaveToken
      );

      expect(result.recovered).toBe(true);
      expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith(storageKey);
      expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('cashu_pending_turbo_send');
      expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
        'cashu_pending_turbo_sends_v1',
        JSON.stringify([]),
        expect.any(Object)
      );
    });

    it('keeps p2pk_created recovery state when persisted token is missing', async () => {
      const pending: PendingTurboSend = {
        quoteId: mockQuoteId,
        recipient: mockRecipient,
        amount: mockAmount,
        senderTaprootAddress: mockSenderAddress,
        createdAt: Date.now(),
        stage: 'p2pk_created',
      };
      (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(JSON.stringify(pending));

      const result = await recoverPendingTurboSend(
        mockSendP2PKToken,
        mockExtractPubkey,
        mockShortenToken,
        mockSaveToken
      );

      expect(result).toEqual({
        recovered: false,
        error: 'P2PK token missing from recovery data',
      });
      expect(SecureStore.deleteItemAsync).not.toHaveBeenCalled();
      expect(mockSaveToken).not.toHaveBeenCalled();
    });

    it('should return error if pubkey extraction fails', async () => {
      mockExtractPubkey.mockReturnValue(null);

      const pending: PendingTurboSend = {
        quoteId: mockQuoteId,
        recipient: mockRecipient,
        amount: mockAmount,
        senderTaprootAddress: mockSenderAddress,
        createdAt: Date.now(),
        stage: 'mint_completed',
      };
      (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(JSON.stringify(pending));

      const result = await recoverPendingTurboSend(
        mockSendP2PKToken,
        mockExtractPubkey,
        mockShortenToken,
        mockSaveToken
      );

      expect(result.recovered).toBe(false);
      expect(result.error).toContain('Failed to extract pubkey');
    });

    it('should return error if sendP2PKToken fails', async () => {
      mockSendP2PKToken.mockResolvedValue(null);

      const pending: PendingTurboSend = {
        quoteId: mockQuoteId,
        recipient: mockRecipient,
        amount: mockAmount,
        senderTaprootAddress: mockSenderAddress,
        createdAt: Date.now(),
        stage: 'mint_completed',
      };
      (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(JSON.stringify(pending));

      const result = await recoverPendingTurboSend(
        mockSendP2PKToken,
        mockExtractPubkey,
        mockShortenToken,
        mockSaveToken
      );

      expect(result.recovered).toBe(false);
      expect(result.error).toContain('returned no token');
    });

    it('should return error if sendP2PKToken throws', async () => {
      mockSendP2PKToken.mockRejectedValue(new Error('Network error'));

      const pending: PendingTurboSend = {
        quoteId: mockQuoteId,
        recipient: mockRecipient,
        amount: mockAmount,
        senderTaprootAddress: mockSenderAddress,
        createdAt: Date.now(),
        stage: 'mint_completed',
      };
      (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(JSON.stringify(pending));

      const result = await recoverPendingTurboSend(
        mockSendP2PKToken,
        mockExtractPubkey,
        mockShortenToken,
        mockSaveToken
      );

      expect(result.recovered).toBe(false);
      expect(result.error).toBe('Network error');
    });

    it('should persist token and short URL while advancing to p2pk_created during recovery', async () => {
      const pending: PendingTurboSend = {
        quoteId: mockQuoteId,
        recipient: mockRecipient,
        amount: mockAmount,
        senderTaprootAddress: mockSenderAddress,
        createdAt: Date.now(),
        stage: 'mint_completed',
      };
      (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(JSON.stringify(pending));

      await recoverPendingTurboSend(
        mockSendP2PKToken,
        mockExtractPubkey,
        mockShortenToken,
        mockSaveToken
      );

      // Check that setItemAsync was called to update stage
      const setCalls = (SecureStore.setItemAsync as jest.Mock).mock.calls;
      const stageUpdateCall = setCalls.find((call: string[]) => {
        const data = JSON.parse(call[1]);
        return data.stage === 'p2pk_created' && data.token === 'cashuBtoken123';
      });
      expect(stageUpdateCall).toBeDefined();
      const shortUrlUpdateCall = setCalls.find((call: string[]) => {
        const data = JSON.parse(call[1]);
        return data.stage === 'p2pk_created' && data.shortUrl === 'https://short.url/abc';
      });
      expect(shortUrlUpdateCall).toBeDefined();
    });
  });
});
