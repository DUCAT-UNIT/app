/**
 * useCashuReceive Hook
 * Handles Cashu receive operations (mint and token receive)
 */

import { useState, useCallback, useEffect, useRef, Dispatch, SetStateAction } from 'react';
import { Alert } from 'react-native';
import { CommonActions, NavigationProp } from '@react-navigation/native';
import { logger } from '../utils/logger';
import {
  decodeTokenMetadata,
  type MintQuoteResult,
  type ReceiveTokenResult,
} from '../services/cashu/cashuWalletService';
import {
  DEFAULT_CASHU_UNIT,
  cashuUnitTokenSymbol,
  normalizeCashuUnit,
  type CashuUnit,
} from '../services/cashu/cashuUnits';

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
  cashuUnit?: CashuUnit;
  senderTaprootAddress?: string;
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

const formatCashuAmount = (amount: number, unit: CashuUnit): string =>
  unit === 'sat'
    ? (amount / 100_000_000).toFixed(8).replace(/0+$/, '').replace(/\.$/, '')
    : (amount / 100).toFixed(2);

const formatOnchainFundingAmount = (amountSmallestUnits: number, unit: CashuUnit): string =>
  unit === 'sat'
    ? (amountSmallestUnits / 100_000_000).toFixed(8).replace(/0+$/, '').replace(/\.$/, '')
    : (amountSmallestUnits / 100).toString();

export function useCashuReceive({
  startMint,
  checkAndCompleteMint,
  receive,
  navigation,
  initialMode,
  cashuUnit = DEFAULT_CASHU_UNIT,
  senderTaprootAddress,
}: UseCashuReceiveParams): UseCashuReceiveReturn {
  const [mode, setMode] = useState<ReceiveMode>(initialMode ?? 'choose');
  const [amount, setAmount] = useState('');
  const [mintQuote, setMintQuote] = useState<MintQuoteResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [pasteValue, setPasteValue] = useState('');
  const [justCopied, setJustCopied] = useState(false);
  const mountedRef = useRef(true);
  const copyResetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tokenSymbol = cashuUnitTokenSymbol(cashuUnit);
  const formatMintedMessage = useCallback((mintedAmount: number) =>
    `Minted ${formatCashuAmount(mintedAmount, cashuUnit)} ${tokenSymbol} worth of Cashu tokens`,
  [cashuUnit, tokenSymbol]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (copyResetTimerRef.current) {
        clearTimeout(copyResetTimerRef.current);
        copyResetTimerRef.current = null;
      }
    };
  }, []);

  // Poll for deposit confirmation
  useEffect(() => {
    if (!mintQuote || mode !== 'mint') return;

    let stopped = false;
    let checkInFlight = false;
    const interval = setInterval(async () => {
      if (checkInFlight) {
        return;
      }

      checkInFlight = true;
      try {
        const result = await checkAndCompleteMint(mintQuote.quoteId);
        if (!stopped && result.completed) {
          clearInterval(interval);
          stopped = true;
          Alert.alert(
            'Success!',
            formatMintedMessage(result.amount ?? 0),
            [{ text: 'OK', onPress: () => navigation.goBack() }]
          );
        }
      } catch (error: unknown) {
        logger.error('Error checking mint:', { error: error instanceof Error ? error.message : String(error) });
      } finally {
        checkInFlight = false;
      }
    }, 3000);
    (interval as { unref?: () => void }).unref?.();

    return () => {
      stopped = true;
      clearInterval(interval);
    };
  }, [mintQuote, mode, checkAndCompleteMint, navigation, formatMintedMessage]);

  const handleStartMint = useCallback(async (): Promise<void> => {
    const amountNum = parseInt(amount, 10);
    if (!amountNum || amountNum <= 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid amount');
      return;
    }

    setIsLoading(true);
    try {
      const quote = await startMint(amountNum);
      if (mountedRef.current) {
        setMintQuote(quote);
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      Alert.alert('Error', errorMessage || 'Failed to create mint quote');
    } finally {
      if (mountedRef.current) {
        setIsLoading(false);
      }
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
      let receivedUnit = cashuUnit;
      try {
        const metadata = decodeTokenMetadata(tokenToReceive);
        receivedUnit = metadata.unit
          ? normalizeCashuUnit(metadata.unit)
          : DEFAULT_CASHU_UNIT;
      } catch (decodeError) {
        const decodeErrorMessage = decodeError instanceof Error ? decodeError.message : String(decodeError);
        if (decodeErrorMessage.includes('Unsupported Cashu unit')) {
          throw decodeError;
        }
        logger.warn('Unable to decode token unit before receive; using screen unit', {
          error: decodeErrorMessage,
        });
      }
      const result = await receive(tokenToReceive);
      Alert.alert(
        'Success!',
        `Received ${formatCashuAmount(result.amount, receivedUnit)} ${cashuUnitTokenSymbol(receivedUnit)} worth of Cashu tokens`,
        [{ text: 'OK', onPress: () => navigation.goBack() }]
      );
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      Alert.alert('Error', errorMessage || 'Failed to receive token');
    } finally {
      if (mountedRef.current) {
        setIsLoading(false);
      }
    }
  }, [pasteValue, receive, navigation, cashuUnit]);

  const handleAutoMint = useCallback(async (): Promise<void> => {
    const amountNum = parseInt(amount, 10);
    if (!amountNum || amountNum <= 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid amount');
      return;
    }

    setIsLoading(true);
    try {
      const quote = await startMint(amountNum);
      const fundingAmountSmallestUnits = quote.amount ?? amountNum;

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
              mintAmount: quote.amount ?? amountNum,
              cashuUnit,
              senderTaprootAddress,
              assetType: cashuUnit === 'sat' ? 'btc' : 'unit',
              amount: formatOnchainFundingAmount(fundingAmountSmallestUnits, cashuUnit),
              recipient: quote.depositAddress,
            },
          },
        })
      );
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      Alert.alert('Error', errorMessage || 'Failed to create mint quote');
    } finally {
      if (mountedRef.current) {
        setIsLoading(false);
      }
    }
  }, [amount, startMint, navigation, cashuUnit, senderTaprootAddress]);

  const handleCopyAddress = useCallback(async (address: string | undefined, setStringAsync: (value: string) => Promise<boolean>): Promise<void> => {
    if (address) {
      await setStringAsync(address);
      if (!mountedRef.current) {
        return;
      }
      setJustCopied(true);
      if (copyResetTimerRef.current) {
        clearTimeout(copyResetTimerRef.current);
      }
      copyResetTimerRef.current = setTimeout(() => {
        copyResetTimerRef.current = null;
        if (mountedRef.current) {
          setJustCopied(false);
        }
      }, 2000);
      (copyResetTimerRef.current as { unref?: () => void }).unref?.();
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
