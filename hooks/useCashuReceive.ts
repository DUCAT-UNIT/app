/**
 * useCashuReceive Hook
 * Handles Cashu receive operations (mint and token receive)
 */

import { useState, useCallback, useEffect, Dispatch, SetStateAction } from 'react';
import { Alert } from 'react-native';
import { CommonActions, NavigationProp } from '@react-navigation/native';
import { logger } from '../utils/logger';
import type { MintQuoteResult } from '../services/cashu/operations/cashuMintOperations';
import type { ReceiveTokenResult } from '../services/cashu/operations/cashuReceiveToken';

type ReceiveMode = 'choose' | 'mint' | 'receive';

interface MintCheckResult {
  completed: boolean;
  amount?: number;
  state?: string;
}

interface UseCashuReceiveParams {
  startMint: (amount: number) => Promise<MintQuoteResult>;
  checkAndCompleteMint: (quoteId: string) => Promise<MintCheckResult>;
  receive: (token: string) => Promise<ReceiveTokenResult>;
  navigation: NavigationProp<Record<string, object | undefined>>;
  initialMode?: ReceiveMode;
}

interface UseCashuReceiveReturn {
  mode: ReceiveMode;
  setMode: Dispatch<SetStateAction<ReceiveMode>>;
  amount: string;
  setAmount: Dispatch<SetStateAction<string>>;
  mintQuote: MintQuoteResult | null;
  isLoading: boolean;
  pasteValue: string;
  setPasteValue: Dispatch<SetStateAction<string>>;
  justCopied: boolean;
  handleStartMint: () => Promise<void>;
  handleReceiveToken: () => Promise<void>;
  handleAutoMint: () => Promise<void>;
  handleCopyAddress: (address: string | undefined, setStringAsync: (value: string) => Promise<boolean>) => Promise<void>;
  resetMintQuote: () => void;
}

export function useCashuReceive({
  startMint,
  checkAndCompleteMint,
  receive,
  navigation,
  initialMode,
}: UseCashuReceiveParams): UseCashuReceiveReturn {
  const [mode, setMode] = useState<ReceiveMode>(initialMode ?? 'choose');
  const [amount, setAmount] = useState('');
  const [mintQuote, setMintQuote] = useState<MintQuoteResult | null>(null);
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
        logger.error('Error checking mint:', { error: error instanceof Error ? error.message : String(error) });
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [mintQuote, mode, checkAndCompleteMint, navigation]);

  const handleStartMint = useCallback(async (): Promise<void> => {
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
      const errorMessage = error instanceof Error ? error.message : String(error);
      Alert.alert('Error', errorMessage || 'Failed to create mint quote');
    } finally {
      setIsLoading(false);
    }
  }, [amount, startMint]);

  const handleReceiveToken = useCallback(async (): Promise<void> => {
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
      const errorMessage = error instanceof Error ? error.message : String(error);
      Alert.alert('Error', errorMessage || 'Failed to receive token');
    } finally {
      setIsLoading(false);
    }
  }, [pasteValue, receive, navigation]);

  const handleAutoMint = useCallback(async (): Promise<void> => {
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
      const errorMessage = error instanceof Error ? error.message : String(error);
      Alert.alert('Error', errorMessage || 'Failed to create mint quote');
    } finally {
      setIsLoading(false);
    }
  }, [amount, startMint, navigation]);

  const handleCopyAddress = useCallback(async (address: string | undefined, setStringAsync: (value: string) => Promise<boolean>): Promise<void> => {
    if (address) {
      await setStringAsync(address);
      setJustCopied(true);
      setTimeout(() => setJustCopied(false), 2000);
    }
  }, []);

  const resetMintQuote = useCallback((): void => {
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
