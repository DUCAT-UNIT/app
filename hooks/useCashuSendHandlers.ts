import { useCallback, Dispatch, SetStateAction } from 'react';
import { Alert, Share } from 'react-native';
import { NavigationProp } from '@react-navigation/native';
import { logger } from '../utils/logger';
import type { SendTokenResult } from '../services/cashu/operations/cashuSendToken';
import type { MeltQuoteResult, MeltResult } from '../services/cashu/operations/cashuMeltOperations';

interface UseCashuSendHandlersParams {
  amount: string;
  balance: number;
  redeemAddress: string;
  meltQuote: MeltQuoteResult | null;
  send: (amount: number) => Promise<SendTokenResult>;
  startMelt: (address: string, amount: number) => Promise<MeltQuoteResult>;
  finishMelt: (quoteId: string, totalAmount: number) => Promise<MeltResult>;
  navigation: NavigationProp<Record<string, object | undefined>>;
  setGeneratedToken: Dispatch<SetStateAction<string | null>>;
  setMeltQuote: Dispatch<SetStateAction<MeltQuoteResult | null>>;
  setIsLoading: Dispatch<SetStateAction<boolean>>;
}

interface UseCashuSendHandlersReturn {
  handleSendToken: () => Promise<void>;
  handleShareToken: (token: string | null) => Promise<void>;
  handleStartRedeem: () => Promise<void>;
  handleConfirmRedeem: () => Promise<void>;
}

/**
 * Hook to manage Cashu send screen handlers
 * - Send token generation
 * - Share token
 * - Redeem/melt operations
 */
export function useCashuSendHandlers({
  amount,
  balance,
  redeemAddress,
  meltQuote,
  send,
  startMelt,
  finishMelt,
  navigation,
  setGeneratedToken,
  setMeltQuote,
  setIsLoading,
}: UseCashuSendHandlersParams): UseCashuSendHandlersReturn {
  const handleSendToken = useCallback(async (): Promise<void> => {
    const amountNum = parseInt(amount, 10);
    if (!amountNum || amountNum <= 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid amount');
      return;
    }

    if (amountNum > balance) {
      Alert.alert('Insufficient Balance', `You only have ${balance} sats`);
      return;
    }

    setIsLoading(true);
    try {
      const result = await send(amountNum);
      setGeneratedToken(result.token);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      Alert.alert('Error', errorMessage || 'Failed to create token');
    } finally {
      setIsLoading(false);
    }
  }, [amount, balance, send, setGeneratedToken, setIsLoading]);

  const handleShareToken = useCallback(async (token: string | null): Promise<void> => {
    if (!token) return;

    try {
      await Share.share({
        message: token,
        title: 'Cashu Token',
      });
    } catch (error: unknown) {
      logger.error('[useCashuSendHandlers] Error sharing:', { error: error instanceof Error ? error.message : String(error) });
    }
  }, []);

  const handleStartRedeem = useCallback(async (): Promise<void> => {
    const amountNum = parseInt(amount, 10);
    if (!amountNum || amountNum <= 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid amount');
      return;
    }

    if (amountNum > balance) {
      Alert.alert('Insufficient Balance', `You only have ${balance} sats`);
      return;
    }

    if (!redeemAddress.trim()) {
      Alert.alert('Error', 'No taproot address found in wallet');
      return;
    }

    setIsLoading(true);
    try {
      const quote = await startMelt(redeemAddress.trim(), amountNum);
      setMeltQuote(quote);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      Alert.alert('Error', errorMessage || 'Failed to create melt quote');
    } finally {
      setIsLoading(false);
    }
  }, [amount, balance, redeemAddress, startMelt, setMeltQuote, setIsLoading]);

  const handleConfirmRedeem = useCallback(async (): Promise<void> => {
    if (!meltQuote) return;

    setIsLoading(true);
    try {
      const result = await finishMelt(meltQuote.quoteId, meltQuote.total);

      Alert.alert(
        'Success!',
        `Redeemed ${meltQuote.amount} sats to Runes\nTransaction: ${result.txid}`,
        [
          {
            text: 'OK',
            onPress: () => navigation.goBack(),
          },
        ]
      );
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      Alert.alert('Error', errorMessage || 'Failed to redeem tokens');
      setMeltQuote(null);
    } finally {
      setIsLoading(false);
    }
  }, [meltQuote, finishMelt, navigation, setMeltQuote, setIsLoading]);

  return {
    handleSendToken,
    handleShareToken,
    handleStartRedeem,
    handleConfirmRedeem,
  };
}
