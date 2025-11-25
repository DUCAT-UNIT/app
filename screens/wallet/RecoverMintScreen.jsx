/**
 * RecoverMintScreen - Temporary screen to manually recover a failed mint
 * Usage: Navigate to this screen and enter the quote ID
 */

import React, { useState } from 'react';
import { Text, TextInput, TouchableOpacity, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS } from '../../theme';

export default function RecoverMintScreen({ navigation }) {
  const [quoteId, setQuoteId] = useState('4e2ceef0dfbbba3a6534b0919f369c622694b6b88ce1b8283a8da6669d7920b2');
  const [amount, setAmount] = useState('921.43');
  const [isProcessing, setIsProcessing] = useState(false);

  const handleRecover = async () => {
    if (!quoteId || !amount) {
      Alert.alert('Error', 'Please enter both quote ID and amount');
      return;
    }

    setIsProcessing(true);
    try {
      const { completeMint } = await import('../../services/cashu/cashuWalletService');

      // Check status and get the actual quote
      const { checkMintQuote } = await import('../../services/cashu/cashuMintClient');
      const quote = await checkMintQuote(quoteId);
      logger.debug('Quote:', quote);

      if (quote.state === 'PAID' || quote.state === 'ISSUED') {
        Alert.alert('Status', 'Quote is PAID! Completing mint...');

        // Complete mint with the amount from the quote (already in smallest units)
        const proofs = await completeMint(quoteId, quote.amount);

        setIsProcessing(false);
        Alert.alert(
          'Success!',
          `Mint completed successfully!\nReceived ${proofs.length} proofs\nTotal: ${proofs.reduce((sum, p) => sum + p.amount, 0) / 100} UNIT`,
          [
            {
              text: 'OK',
              onPress: () => navigation.goBack()
            }
          ]
        );
      } else {
        setIsProcessing(false);
        Alert.alert('Status', `Quote is not yet paid. State: ${status.state}`);
      }

    } catch (error) {
      setIsProcessing(false);
      Alert.alert('Error', `Failed to recover mint: ${error.message}`);
      logger.error('Recovery error:', error);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Recover Mint</Text>
      <Text style={styles.subtitle}>
        Enter the quote ID and amount to recover a failed mint
      </Text>

      <Text style={styles.label}>Quote ID</Text>
      <TextInput
        style={styles.input}
        value={quoteId}
        onChangeText={setQuoteId}
        placeholder="Enter quote ID"
        placeholderTextColor={COLORS.MEDIUM_GRAY}
        autoCapitalize="none"
        multiline
      />

      <Text style={styles.label}>Amount (UNIT)</Text>
      <TextInput
        style={styles.input}
        value={amount}
        onChangeText={setAmount}
        placeholder="Enter amount"
        placeholderTextColor={COLORS.MEDIUM_GRAY}
        keyboardType="decimal-pad"
      />

      <TouchableOpacity
        style={[styles.button, isProcessing && styles.buttonDisabled]}
        onPress={handleRecover}
        disabled={isProcessing}
      >
        {isProcessing ? (
          <ActivityIndicator color={COLORS.WHITE} />
        ) : (
          <Text style={styles.buttonText}>Recover Mint</Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.cancelButton}
        onPress={() => navigation.goBack()}
      >
        <Text style={styles.cancelButtonText}>Cancel</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.DARK_BG,
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.WHITE,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: COLORS.SECONDARY_TEXT,
    marginBottom: 24,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.VERY_LIGHT_GRAY,
    marginBottom: 8,
    marginTop: 16,
  },
  input: {
    backgroundColor: COLORS.CARD_BG,
    borderRadius: 8,
    padding: 12,
    color: COLORS.WHITE,
    fontSize: 14,
    borderWidth: 1,
    borderColor: COLORS.BORDER_COLOR,
  },
  button: {
    backgroundColor: COLORS.PRIMARY_BLUE,
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    marginTop: 32,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.WHITE,
  },
  cancelButton: {
    padding: 16,
    alignItems: 'center',
    marginTop: 12,
  },
  cancelButtonText: {
    fontSize: 16,
    color: COLORS.SECONDARY_TEXT,
  },
});
