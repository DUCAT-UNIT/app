/**
 * ConfirmationScreen - Full screen showing successful transaction confirmation
 * Features: success checkmark, explorer link, Done button
 */

import React, { useEffect, useState, useRef } from 'react';
import { Text, View, TouchableOpacity, Linking, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { COLORS } from '../../theme';
import Icon from '../../components/icons';
import { getTxUrl } from '../../utils/constants';
import { useTransactionExecution } from '../../contexts/TransactionExecutionContext';
import { useTransactionHistory } from '../../contexts/WalletDataContext';

export default function ConfirmationScreen({ navigation, route }) {
  const { broadcastedTxid } = useTransactionExecution();
  const { fetchTransactionHistory } = useTransactionHistory();
  const isSpectre = route?.params?.isSpectre === true;
  const mintQuoteId = route?.params?.mintQuoteId;
  const mintAmount = route?.params?.mintAmount;
  const [isCompletingMint, setIsCompletingMint] = useState(false);
  const hasMintCompleted = useRef(false);

  // Refresh transaction history when confirmation screen appears
  useEffect(() => {
    if (fetchTransactionHistory) {
      fetchTransactionHistory();
    }
  }, [fetchTransactionHistory]);

  // Handle Spectre mint completion
  useEffect(() => {
    console.log('[ConfirmationScreen] Checking mint completion:', {
      isSpectre,
      mintQuoteId,
      mintAmount,
      hasMintCompleted: hasMintCompleted.current
    });

    if (isSpectre && mintQuoteId && mintAmount && !hasMintCompleted.current) {
      hasMintCompleted.current = true;
      console.log('[ConfirmationScreen] Starting mint completion process');

      const completeMintProcess = async () => {
        setIsCompletingMint(true);
        try {
          const { completeMint } = await import('../../services/cashu/cashuWalletService');
          const { checkMintQuote } = await import('../../services/cashu/cashuMintClient');
          console.log('[ConfirmationScreen] Starting to poll for payment confirmation');

          // Poll for payment confirmation
          let paidQuote = null;
          let attempts = 0;
          const maxAttempts = 30; // 30 seconds

          while (!paidQuote && attempts < maxAttempts) {
            await new Promise(resolve => setTimeout(resolve, 1000));
            const quote = await checkMintQuote(mintQuoteId);
            console.log(`[ConfirmationScreen] Check ${attempts + 1}/${maxAttempts}:`, quote);
            if (quote.state === 'PAID' || quote.state === 'ISSUED') {
              paidQuote = quote;
              break;
            }
            attempts++;
          }

          if (paidQuote) {
            console.log('[ConfirmationScreen] Payment confirmed! Completing mint with amount:', paidQuote.amount);
            // Complete mint to get e-cash tokens - use the amount from the quote (already in smallest units)
            await completeMint(mintQuoteId, paidQuote.amount);
            console.log('[ConfirmationScreen] Mint completed successfully');

            // Refresh balance
            await fetchTransactionHistory();

            setIsCompletingMint(false);
            Alert.alert('Success', 'On-chain UNIT converted to eUNIT!');
          } else {
            console.log('[ConfirmationScreen] Payment not confirmed after 30 seconds');
            setIsCompletingMint(false);
            Alert.alert('Pending', 'Payment sent. E-cash will be available once confirmed.');
          }
        } catch (error) {
          console.error('[ConfirmationScreen] Error during mint completion:', error);
          setIsCompletingMint(false);
          Alert.alert('Error', `Failed to complete conversion: ${error.message}`);
        }
      };

      completeMintProcess();
    }
  }, [isSpectre, mintQuoteId, mintAmount, fetchTransactionHistory]);

  const handleViewExplorer = () => {
    if (broadcastedTxid) {
      Linking.openURL(getTxUrl(broadcastedTxid));
    }
  };

  const handleDone = () => {
    // Refresh transaction history one more time before closing
    if (fetchTransactionHistory) {
      fetchTransactionHistory();
    }

    // Dismiss the send flow modal
    // Add a small delay to allow the fetch to start
    setTimeout(() => {
      navigation.getParent()?.goBack();
    }, 100);
  };

  return (
    <View style={localStyles.container}>
      {/* Content */}
      <View style={localStyles.content}>
        {/* Success checkmark */}
        <View style={localStyles.checkmarkContainer}>
          <Icon name="done" size={100} color={COLORS.TEAL} />
        </View>

        <Text style={localStyles.title}>
          {isCompletingMint ? 'Converting to eUNIT...' : 'Transaction Sent'}
        </Text>
        <Text style={localStyles.subtitle}>
          {isCompletingMint
            ? 'Waiting for payment confirmation and minting e-cash tokens...'
            : 'Your transaction has been successfully broadcast to the network'
          }
        </Text>

        {isCompletingMint && (
          <ActivityIndicator
            size="large"
            color={COLORS.PRIMARY_BLUE}
            style={{ marginTop: 20 }}
          />
        )}

        {/* View Explorer Button */}
        <TouchableOpacity
          style={localStyles.explorerButton}
          activeOpacity={0.7}
          onPress={handleViewExplorer}
        >
          <Text style={localStyles.explorerButtonText}>View on Explorer</Text>
          <Icon name="arrow_right" size={16} color={COLORS.PRIMARY_BLUE} />
        </TouchableOpacity>
      </View>

      {/* Done Button - Fixed at bottom */}
      <View style={localStyles.buttonContainer}>
        <TouchableOpacity
          style={localStyles.doneButton}
          onPress={handleDone}
          activeOpacity={0.7}
        >
          <Text style={localStyles.doneButtonText}>Done</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const localStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.DARK_BG,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
  },
  checkmarkContainer: {
    marginBottom: 32,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: COLORS.VERY_LIGHT_GRAY,
    fontFamily: 'CabinetGrotesk-Bold',
    textAlign: 'center',
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 16,
    color: COLORS.SECONDARY_TEXT,
    fontFamily: 'CabinetGrotesk-Regular',
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 24,
  },
  explorerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.CARD_BG,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderWidth: 1,
    borderColor: COLORS.PRIMARY_BLUE,
    gap: 8,
  },
  explorerButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.PRIMARY_BLUE,
    fontFamily: 'CabinetGrotesk-Bold',
  },
  buttonContainer: {
    paddingHorizontal: 20,
    paddingBottom: 40,
    paddingTop: 20,
  },
  doneButton: {
    backgroundColor: COLORS.PRIMARY_BLUE,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  doneButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.WHITE,
    fontFamily: 'CabinetGrotesk-Bold',
  },
});
