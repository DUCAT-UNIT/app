/**
 * AssetDetailScreen Component
 * Displays detailed information about a specific asset (BTC or UNIT)
 */

import React, { useState, useRef, useMemo, useCallback, useEffect } from 'react';
import {
  StyleSheet,
  Animated,
  Linking,
  Alert,
  View,
  Text,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { COLORS } from '../../theme';
import { useBalance, useTransactionHistory } from '../../contexts/WalletDataContext';
import { usePrice } from '../../contexts/PriceContext';
import { useWallet } from '../../contexts/WalletContext';
import { useCashu } from '../../contexts/CashuContext';
import { usePendingTransactions } from '../../contexts/PendingTransactionsContext';
import {
  AssetHeader,
  AssetInfo,
  AssetActionButtons,
  AssetPriceChart,
  AssetTabs,
  AssetAbout,
  AssetActivityList
} from '../../components/assetDetail';
import UnitBalanceBreakdown from '../../components/wallet/UnitBalanceBreakdown';
import { usePriceChart } from '../../hooks/usePriceChart';
import { useAssetTransactions } from '../../hooks/useAssetTransactions';
import { getTxUrl, getOrdTxUrl } from '../../utils/constants';

function AssetDetailScreen({ route = {}, navigation }) {
  const { assetType = 'BTC' } = route?.params || {};

  const { segwitBalance, runesBalance } = useBalance();
  const { btcPrice } = usePrice();
  const wallet = useWallet().wallet;
  const { balance: cashuBalance } = useCashu();
  const { transactionHistory, loadingTransactionHistory, fetchTransactionHistory } = useTransactionHistory();
  const { getSpentUtxos, unmarkUtxosAsSpent } = usePendingTransactions();

  const [selectedTab, setSelectedTab] = useState('ACTIVITY');
  const [selectedTimeframe, setSelectedTimeframe] = useState('1M');
  const scrollY = useRef(new Animated.Value(0)).current;

  // Refresh transaction history when screen comes into focus
  // This will also trigger when returning from the SendFlow modal
  useFocusEffect(
    useCallback(() => {
      fetchTransactionHistory();
    }, [fetchTransactionHistory])
  );

  // Use extracted price chart hook
  const { priceData, priceDirection, priceLoading, priceError, setPriceError } = usePriceChart(assetType, selectedTimeframe);

  // Get balance based on asset type
  // For UNIT, combine runesBalance + cashuBalance and divide by 100 for display
  const unitRunesAmount = runesBalance && runesBalance.length > 0 ? parseFloat(runesBalance[0][1]) : 0;
  const totalUnitAmount = unitRunesAmount + cashuBalance;
  const balance = assetType === 'BTC' ? segwitBalance : totalUnitAmount / 100;
  const fiatValue = assetType === 'BTC' ? balance * btcPrice : balance * 1;

  // Extract stable wallet addresses using refs to prevent re-renders
  const segwitAddressRef = useRef(wallet?.segwitAddress);
  const taprootAddressRef = useRef(wallet?.taprootAddress);

  // Only update refs if values actually changed
  if (wallet?.segwitAddress && wallet.segwitAddress !== segwitAddressRef.current) {
    segwitAddressRef.current = wallet.segwitAddress;
  }
  if (wallet?.taprootAddress && wallet.taprootAddress !== taprootAddressRef.current) {
    taprootAddressRef.current = wallet.taprootAddress;
  }

  const segwitAddress = segwitAddressRef.current;
  const taprootAddress = taprootAddressRef.current;

  // Memoize isPositive to prevent chart re-renders
  const isPositive = useMemo(() => priceDirection.isPositive, [priceDirection.isPositive]);

  // Use extracted transaction filtering hook
  const filteredTransactions = useAssetTransactions(transactionHistory, assetType, segwitAddress, taprootAddress);

  const handleActionPress = (action) => {
    switch (action) {
      case 'send':
        if (assetType === 'CASHU') {
          // Navigate to Cashu send screen
          navigation.navigate('CashuSend');
        } else {
          const sendAssetType = assetType.toLowerCase(); // Convert BTC -> btc, UNIT -> unit
          navigation.navigate('SendFlow', {
            screen: 'AddressInput',
            params: { assetType: sendAssetType }
          });
        }
        break;
      case 'receive':
        if (assetType === 'CASHU') {
          // Navigate to Cashu receive screen
          navigation.navigate('CashuReceive');
        } else {
          // Navigate to ReceiveQR screen with the appropriate address
          const receiveAddress = assetType === 'BTC' ? segwitAddress : taprootAddress;
          const addressType = assetType === 'BTC' ? 'Native SegWit' : 'Taproot';
          navigation.navigate('ReceiveQR', {
            address: receiveAddress,
            addressType: addressType,
          });
        }
        break;
      case 'consolidate':
        handleFusePress();
        break;
      case 'spectre':
        handleSpectrePress();
        break;
    }
  };

  // Handle fuse (convert all e-cash to runes)
  const handleFusePress = useCallback(async () => {
    if (cashuBalance === 0) {
      Alert.alert('No E-cash', 'You don\'t have any e-cash to fuse.');
      return;
    }

    Alert.alert(
      'Fuse E-cash to UNIT?',
      `Convert all ${cashuBalance.toFixed(2)} eUNIT to on-chain UNIT?`,
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Fuse',
          onPress: async () => {
            try {
              // Import cashu functions
              const { requestMelt, completeMelt } = await import('../../services/cashu/cashuWalletService');

              // Get taproot address for receiving runes
              const receiveAddress = taprootAddress;

              // Request melt quote
              const quote = await requestMelt(receiveAddress, cashuBalance);

              // Complete melt in background
              await completeMelt(quote.quoteId, quote.total);

              // Refresh balance
              await fetchTransactionHistory();

              Alert.alert('Success', 'E-cash successfully fused to on-chain UNIT!');
            } catch (error) {
              Alert.alert('Error', `Failed to fuse e-cash: ${error.message}`);
            }
          },
        },
      ]
    );
  }, [cashuBalance, taprootAddress, fetchTransactionHistory]);

  // Handle spectre (convert all on-chain runes to e-cash)
  const handleSpectrePress = useCallback(async () => {
    const unitRunesAmount = runesBalance && runesBalance.length > 0 ? parseFloat(runesBalance[0][1]) : 0;

    if (unitRunesAmount === 0) {
      Alert.alert('No On-chain UNIT', 'You don\'t have any on-chain UNIT to convert.');
      return;
    }

    // Clear any stuck spent UTXOs before starting
    const currentSpent = getSpentUtxos();
    if (currentSpent.size > 0) {
      await unmarkUtxosAsSpent(Array.from(currentSpent).map(key => {
        const [txid, vout] = key.split(':');
        return { txid, vout: parseInt(vout) };
      }));
    }

    try {
      // Import cashu functions
      const { requestMint, checkMintStatus, completeMint } = await import('../../services/cashu/cashuWalletService');

      // Step 1: Request mint quote
      const mintQuote = await requestMint(unitRunesAmount);

      // Navigate directly to SpectreLoading screen
      // Convert unitRunesAmount from smallest units to display units (divide by 100)
      navigation.navigate('SendFlow', {
        screen: 'SpectreLoading',
        params: {
          assetType: 'unit',
          prefillAddress: mintQuote.depositAddress,
          prefillAmount: unitRunesAmount / 100,
          mintQuoteId: mintQuote.quoteId,
          mintAmount: unitRunesAmount,
          isSpectre: true,
        }
      });
    } catch (error) {
      Alert.alert('Error', `Failed to convert: ${error.message}`);
    }
  }, [runesBalance, navigation, fetchTransactionHistory, getSpentUtxos, unmarkUtxosAsSpent]);

  // Handle recovery button
  const handleRecoverMint = () => {
    navigation.navigate('RecoverMint');
  };

  // Open transaction in blockchain explorer
  const handleTransactionPress = useCallback(async (tx) => {
    try {
      // Use ord explorer for UNIT transactions, regular explorer for BTC
      const url = assetType === 'UNIT' ? getOrdTxUrl(tx.txid) : getTxUrl(tx.txid);

      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
      }
    } catch (error) {
      // Silently fail
    }
  }, [assetType]);

  // Component render functions now use extracted components
  const renderHeader = () => <AssetHeader onBackPress={() => navigation.goBack()} />;

  const renderAssetInfo = () => (
    <AssetInfo
      assetType={assetType}
      balance={balance}
      fiatValue={fiatValue}
      btcPrice={btcPrice}
      priceData={priceData}
      priceDirection={priceDirection}
      runesBalance={unitRunesAmount}
      cashuBalance={cashuBalance}
    />
  );

  const renderActionButtons = () => (
    <AssetActionButtons
      onSendPress={() => handleActionPress('send')}
      onReceivePress={() => handleActionPress('receive')}
      onConsolidatePress={() => handleActionPress('consolidate')}
      onSpectrePress={() => handleActionPress('spectre')}
      showConsolidate={assetType === 'UNIT'}
    />
  );


  return (
    <>
      <SafeAreaView style={styles.container}>
        {renderHeader()}

        <Animated.ScrollView
          style={styles.scrollView}
          onScroll={Animated.event(
            [{ nativeEvent: { contentOffset: { y: scrollY } } }],
            { useNativeDriver: false }
          )}
          scrollEventThrottle={16}
        >
          {renderAssetInfo()}

          {/* Show balance breakdown for UNIT */}
          {assetType === 'UNIT' && (
            <UnitBalanceBreakdown
              ecashBalance={cashuBalance / 100}
              runesBalance={unitRunesAmount / 100}
            />
          )}

          {renderActionButtons()}

          {/* Temporary Recover Mint Button */}
          {assetType === 'UNIT' && (
            <View style={{ paddingHorizontal: 20, paddingVertical: 12 }}>
              <TouchableOpacity
                style={{
                  backgroundColor: COLORS.WARNING_ORANGE,
                  borderRadius: 8,
                  padding: 12,
                  alignItems: 'center',
                }}
                onPress={handleRecoverMint}
              >
                <Text style={{ color: COLORS.WHITE, fontWeight: '600' }}>
                  Recover Failed Mint (Temporary)
                </Text>
              </TouchableOpacity>
            </View>
          )}

          <AssetPriceChart
            assetType={assetType}
            priceData={priceData}
            priceError={priceError}
            priceLoading={priceLoading}
            isPositive={isPositive}
            selectedTimeframe={selectedTimeframe}
            onTimeframeChange={setSelectedTimeframe}
            onRetry={() => setPriceError(null)}
          />

          <AssetTabs
            selectedTab={selectedTab}
            onTabChange={setSelectedTab}
          />

          {selectedTab === 'ACTIVITY' ? (
            <AssetActivityList
              transactions={filteredTransactions}
              isLoading={loadingTransactionHistory}
              onTransactionPress={handleTransactionPress}
            />
          ) : (
            <AssetAbout assetType={assetType} />
          )}
        </Animated.ScrollView>
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.DARK_BG,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backButton: {
    padding: 8,
  },
  scrollView: {
    flex: 1,
  },
  assetInfoContainer: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  assetName: {
    fontSize: 16,
    fontWeight: '400',
    color: COLORS.SECONDARY_TEXT,
    marginBottom: 12,
  },
  balanceAmount: {
    fontSize: 31,
    fontWeight: '700',
    color: COLORS.WHITE,
    marginBottom: 8,
  },
  balanceFiat: {
    fontSize: 20,
    fontWeight: '400',
    color: COLORS.SECONDARY_TEXT,
    marginBottom: 12,
  },
  priceChange: {
    fontSize: 16,
    fontWeight: '400',
    color: COLORS.SUCCESS_GREEN,
  },
  actionButtonsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    paddingHorizontal: 5,
    paddingVertical: 12,
    gap: 12,
  },
  actionButton: {
    alignItems: 'center',
    minWidth: 62,
  },
  actionButtonIcon: {
    width: 50,
    height: 50,
    borderRadius: 8,
    backgroundColor: COLORS.CARD_BG,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 2,
    borderWidth: 1.2,
    borderColor: COLORS.BORDER_COLOR,
  },
  actionButtonLabel: {
    fontSize: 13,
    color: COLORS.SECONDARY_TEXT,
    fontWeight: '600',
  },
});

export default React.memo(AssetDetailScreen);