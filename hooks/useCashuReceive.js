/**
 * useCashuReceive Hook
 * Handles Cashu receive operations (mint and token receive)
 */

import { useState, useCallback, useEffect } from 'react';
import { Alert } from 'react-native';
import { CommonActions } from '@react-navigation/native';
import { logger } from '../utils/logger';

export function useCashuReceive({
  startMint,
  checkAndCompleteMint,
  receive,
  navigation,
}) {
  const [mode, setMode] = useState('choose');
  const [amount, setAmount] = useState('');
  const [mintQuote, setMintQuote] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [pasteValue, setPasteValue] = useState('');
  const [justCopied, setJustCopied] = useState(false);

  // Poll for deposit confirmation
  useEffect(() => {
    if (!mintQuote || mode !== 'mint') return;

    const interval = setInterval(async () => {
      try {
        const result = await checkAndCompleteMint(mintQuote.quoteId);
        if (result.completed) {
          clearInterval(interval);
          Alert.alert(
            'Success!',
            `Minted ${result.amount} sats worth of Cashu tokens`,
            [{ text: 'OK', onPress: () => navigation.goBack() }]
          );
        }
      } catch (error) {
        logger.error('Error checking mint:', error);
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [mintQuote, mode, checkAndCompleteMint, navigation]);

  const handleStartMint = useCallback(async () => {
    const amountNum = parseInt(amount, 10);
    if (!amountNum || amountNum <= 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid amount');
      return;
    }

    setIsLoading(true);
    try {
      const quote = await startMint(amountNum);
      setMintQuote(quote);
    } catch (error) {
      Alert.alert('Error', error.message || 'Failed to create mint quote');
    } finally {
      setIsLoading(false);
    }
  }, [amount, startMint]);

  const handleReceiveToken = useCallback(async () => {
    if (!pasteValue.trim()) {
      Alert.alert('Invalid Token', 'Please paste a Cashu token');
      return;
    }

    setIsLoading(true);
    try {
      const tokenToReceive = pasteValue.trim();
      const result = await receive(tokenToReceive);
      Alert.alert(
        'Success!',
        `Received ${result.amount} sats worth of Cashu tokens`,
        [{ text: 'OK', onPress: () => navigation.goBack() }]
      );
    } catch (error) {
      Alert.alert('Error', error.message || 'Failed to receive token');
    } finally {
      setIsLoading(false);
    }
  }, [pasteValue, receive, navigation]);

  const handleAutoMint = useCallback(async () => {
    const amountNum = parseInt(amount, 10);
    if (!amountNum || amountNum <= 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid amount');
      return;
    }

    setIsLoading(true);
    try {
      const quote = await startMint(amountNum);

      navigation.dispatch(
        CommonActions.navigate({
          name: 'SendFlow',
          params: {
            screen: 'Processing',
            params: {
              fromScreen: 'CashuReceive',
              action: 'create_intent',
              cashuMint: true,
              quoteId: quote.quoteId,
              assetType: 'unit',
              amount: amountNum.toString(),
              recipient: quote.depositAddress,
            },
          },
        })
      );
    } catch (error) {
      Alert.alert('Error', error.message || 'Failed to create mint quote');
    } finally {
      setIsLoading(false);
    }
  }, [amount, startMint, navigation]);

  const handleCopyAddress = useCallback(async (address, setStringAsync) => {
    if (address) {
      await setStringAsync(address);
      setJustCopied(true);
      setTimeout(() => setJustCopied(false), 2000);
    }
  }, []);

  const resetMintQuote = useCallback(() => {
    setMintQuote(null);
    setMode('choose');
  }, []);

  return {
    mode,
    setMode,
    amount,
    setAmount,
    mintQuote,
    isLoading,
    pasteValue,
    setPasteValue,
    justCopied,
    handleStartMint,
    handleReceiveToken,
    handleAutoMint,
    handleCopyAddress,
    resetMintQuote,
  };
}
