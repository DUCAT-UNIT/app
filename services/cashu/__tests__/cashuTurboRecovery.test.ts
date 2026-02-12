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
  });

  describe('savePendingTurboSend', () => {
    it('should save pending turbo send', async () => {
      await savePendingTurboSend(mockQuoteId, mockRecipient, mockAmount, mockSenderAddress);

      expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
        'cashu_pending_turbo_send',
        expect.stringContaining(mockQuoteId)
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
    });

    it('should include timestamp', async () => {
      const beforeTime = Date.now();

      await savePendingTurboSend(mockQuoteId, mockRecipient, mockAmount, mockSenderAddress);

      const savedData = JSON.parse(
        (SecureStore.setItemAsync as jest.Mock).mock.calls[0][1]
      );
      expect(savedData.createdAt).toBeGreaterThanOrEqual(beforeTime);
    });

    it('should handle storage errors gracefully', async () => {
      (SecureStore.setItemAsync as jest.Mock).mockRejectedValue(new Error('Storage error'));

      await expect(
        savePendingTurboSend(mockQuoteId, mockRecipient, mockAmount, mockSenderAddress)
      ).resolves.not.toThrow();
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
      (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(JSON.stringify(pending));

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
      mockSendP2PKToken.mockResolvedValue({ token: 'cashuAtoken123' });
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
      expect(result.token).toBe('cashuAtoken123');
      expect(result.deeplink).toBe('https://short.url/abc');
      expect(result.recipient).toBe(mockRecipient);
      expect(result.amount).toBe(mockAmount);

      expect(mockExtractPubkey).toHaveBeenCalledWith(mockRecipient);
      expect(mockSendP2PKToken).toHaveBeenCalledWith(mockAmount, '02abc123pubkey', {});
      expect(mockShortenToken).toHaveBeenCalledWith('cashuAtoken123');
      expect(mockSaveToken).toHaveBeenCalledWith(
        'cashuAtoken123',
        mockRecipient,
        mockAmount,
        null,
        'https://short.url/abc',
        mockSenderAddress
      );
      expect(SecureStore.deleteItemAsync).toHaveBeenCalled();
    });

    it('should clear for p2pk_created stage', async () => {
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

      expect(result.recovered).toBe(true);
      expect(SecureStore.deleteItemAsync).toHaveBeenCalled();
      expect(mockSendP2PKToken).not.toHaveBeenCalled();
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

    it('should update stage to p2pk_created during recovery', async () => {
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
        return data.stage === 'p2pk_created';
      });
      expect(stageUpdateCall).toBeDefined();
    });
  });
});
