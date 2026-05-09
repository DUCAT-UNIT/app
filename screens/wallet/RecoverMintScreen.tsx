/**
 * RecoverMintScreen - Temporary screen to manually recover a failed mint
 * Usage: Navigate to this screen and enter the quote ID
 */

import React, { useState } from 'react';
import { Text, TextInput, TouchableOpacity, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { NavigationProp } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS } from '../../theme';
import { formatUnitAmount } from '../../utils/formatters/amounts';
import { formatBalance } from '../../utils/formatters';
import { logger } from '../../utils/logger';
import {
  cashuUnitDisplayName,
  DEFAULT_CASHU_UNIT,
  normalizeCashuUnit,
  type CashuUnit,
} from '../../services/cashu/cashuUnits';

/**
 * Props for RecoverMintScreen
 */
interface RecoverMintScreenProps {
  navigation: NavigationProp<Record<string, object | undefined>>;
  route?: {
    params?: {
      cashuUnit?: CashuUnit;
    };
  };
}

export default function RecoverMintScreen({ navigation, route }: RecoverMintScreenProps): React.JSX.Element {
  const cashuUnit = normalizeCashuUnit(route?.params?.cashuUnit, DEFAULT_CASHU_UNIT);
  const tokenLabel = cashuUnitDisplayName(cashuUnit);
  const [quoteId, setQuoteId] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  const handleRecover = async (): Promise<void> => {
    if (!quoteId) {
      Alert.alert('Error', 'Please enter a quote ID');
      return;
    }

    setIsProcessing(true);
    try {
      const { checkMintQuote, completeMint, getMintQuoteAvailableAmount } = await import('../../services/cashu/cashuWalletService');
      const { saveMintQuote } = await import('../../services/cashu/cashuMintQuoteRecovery');

      // Check status and get the actual quote
      const quote = await checkMintQuote(quoteId);
      logger.debug('Quote:', quote);

      const availableAmount = getMintQuoteAvailableAmount(quote);
      const claimAmount = availableAmount > 0 ? availableAmount : quote.amount;

      if ((quote.state === 'PAID' || quote.state === 'ISSUED') && claimAmount !== undefined && claimAmount > 0) {
        Alert.alert('Status', 'Quote is PAID! Completing mint...');

        const persistedQuoteUnit = (quote as { unit?: string }).unit;
        const quoteUnit = persistedQuoteUnit
          ? normalizeCashuUnit(persistedQuoteUnit)
          : cashuUnit;

        await saveMintQuote({
          quoteId,
          amount: claimAmount,
          depositAddress: quote.request ?? '',
          unit: quoteUnit,
        });

        // Complete mint with the mint's currently claimable amount.
        const proofs = await completeMint(quoteId, claimAmount, quoteUnit);
        const recoveredAmount = proofs.reduce((sum, p) => sum + p.amount, 0);
        const formattedRecovered = quoteUnit === 'sat'
          ? `${formatBalance(recoveredAmount / 100_000_000)} BTC (${recoveredAmount.toLocaleString()} sats)`
          : `${formatUnitAmount(recoveredAmount)} UNIT`;

        setIsProcessing(false);
        Alert.alert(
          'Success!',
          `Mint completed successfully!\nReceived ${proofs.length} proofs\nTotal: ${formattedRecovered}`,
          [
            {
              text: 'OK',
              onPress: () => navigation.goBack()
            }
          ]
        );
      } else {
        setIsProcessing(false);
        Alert.alert('Status', `Quote has no claimable amount. State: ${quote.state}`);
      }

    } catch (error: unknown) {
      setIsProcessing(false);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      Alert.alert('Error', `Failed to recover mint: ${errorMessage}`);
      logger.error('Recovery error:', { error: errorMessage });
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Recover {tokenLabel} Mint</Text>
      <Text style={styles.subtitle}>
        Enter the quote ID to recover a failed {tokenLabel} mint
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

      <TouchableOpacity
        style={[styles.button, isProcessing && styles.buttonDisabled]}
        onPress={handleRecover}
        disabled={isProcessing}
      >
        {isProcessing ? (
          <ActivityIndicator color={COLORS.WHITE} />
        ) : (
          <Text style={styles.buttonText}>Recover {tokenLabel} Mint</Text>
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
