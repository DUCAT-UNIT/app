import { useCallback } from 'react';
import { Alert, Share } from 'react-native';
import { logger } from '../utils/logger';

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
}) {
  const handleSendToken = useCallback(async () => {
    const amountNum = parseInt(amount);
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
    } catch (error) {
      Alert.alert('Error', error.message || 'Failed to create token');
    } finally {
      setIsLoading(false);
    }
  }, [amount, balance, send, setGeneratedToken, setIsLoading]);

  const handleShareToken = useCallback(async (token) => {
    if (!token) return;

    try {
      await Share.share({
        message: token,
        title: 'Cashu Token',
      });
    } catch (error) {
      logger.error('[useCashuSendHandlers] Error sharing:', error);
    }
  }, []);

  const handleStartRedeem = useCallback(async () => {
    const amountNum = parseInt(amount);
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
    } catch (error) {
      Alert.alert('Error', error.message || 'Failed to create melt quote');
    } finally {
      setIsLoading(false);
    }
  }, [amount, balance, redeemAddress, startMelt, setMeltQuote, setIsLoading]);

  const handleConfirmRedeem = useCallback(async () => {
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
    } catch (error) {
      Alert.alert('Error', error.message || 'Failed to redeem tokens');
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
