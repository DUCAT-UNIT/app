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
  AssetActivityList,
  AssetTurboList
} from '../../components/assetDetail';
import UnitBalanceBreakdown from '../../components/wallet/UnitBalanceBreakdown';
import { usePriceChart } from '../../hooks/usePriceChart';
import { useAssetTransactions } from '../../hooks/useAssetTransactions';
import { getTxUrl, getOrdTxUrl } from '../../utils/constants';
import TokenDetailsSheet from '../../components/ecash/TokenDetailsSheet';
import { useNotifications } from '../../contexts/NotificationContext';

function AssetDetailScreen({ route = {}, navigation }) {
  const { assetType = 'BTC', advancedMode = false } = route?.params || {};

  const { segwitBalance, runesBalance, loadingBalance } = useBalance();
  const { btcPrice } = usePrice();
  const wallet = useWallet().wallet;
  const { balance: cashuBalance, isLoading: loadingCashu } = useCashu();
  const { transactionHistory, loadingTransactionHistory, fetchTransactionHistory } = useTransactionHistory();
  const { getSpentUtxos, unmarkUtxosAsSpent } = usePendingTransactions();

  const [selectedTab, setSelectedTab] = useState('ACTIVITY');
  const [selectedTimeframe, setSelectedTimeframe] = useState('1M');
  const [selectedToken, setSelectedToken] = useState(null);
  const [showTokenDetails, setShowTokenDetails] = useState(false);
  const scrollY = useRef(new Animated.Value(0)).current;
  const { showToast } = useNotifications();

  // Use extracted price chart hook
  const { priceData, priceDirection, priceLoading, priceError, setPriceError } = usePriceChart(assetType, selectedTimeframe);

  // Get balance based on asset type
  // For UNIT, combine runesBalance + cashuBalance
  const unitRunesAmount = runesBalance && runesBalance.length > 0 ? parseFloat(runesBalance[0][1]) : 0;
  const totalUnitAmount = unitRunesAmount + cashuBalance;
  const balance = assetType === 'BTC' ? segwitBalance : totalUnitAmount;
  const fiatValue = assetType === 'BTC' ? balance * btcPrice : balance * 1;

  // For UNIT, only show loading if we don't have data yet
  // If we have cached values, show them immediately even if a refresh is in progress
  const hasRunesData = runesBalance !== null && runesBalance !== undefined;
  const hasCashuData = cashuBalance !== null && cashuBalance !== undefined;

  const isBalanceLoading = assetType === 'UNIT'
    ? (!hasRunesData && loadingBalance) || (!hasCashuData && loadingCashu)
    : (!segwitBalance && loadingBalance);

  // Debug logging for loading states
  useEffect(() => {
    if (assetType === 'UNIT') {
      console.log('[AssetDetailScreen] Loading states:', {
        loadingBalance,
        loadingCashu,
        hasRunesData,
        hasCashuData,
        isBalanceLoading,
        runesBalance,
        cashuBalance,
      });
    }
  }, [assetType, loadingBalance, loadingCashu, hasRunesData, hasCashuData, isBalanceLoading, runesBalance, cashuBalance]);

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
  const { transactions: filteredTransactions, isLoading: ecashLoading } = useAssetTransactions(transactionHistory, assetType, segwitAddress, taprootAddress, advancedMode);

  // For UNIT assets, show loading when refreshing data (even with cached data)
  const isActivityLoading = assetType === 'UNIT'
    ? loadingTransactionHistory || loadingCashu || ecashLoading
    : loadingTransactionHistory;

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
      case 'turbo':
        handleTurboPress();
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
              const { requestMelt, completeMeltWithoutCleanup, cleanupMeltProofs } = await import('../../services/cashu/cashuWalletService');

              // Get taproot address for receiving runes
              const receiveAddress = taprootAddress;

              // Request melt quote
              const quote = await requestMelt(receiveAddress, cashuBalance);

              // Complete melt but keep proofs until we see the tx
              const meltResult = await completeMeltWithoutCleanup(quote.quoteId, quote.total);

              // IMPORTANT: Clean up proofs immediately after successful melt
              // The mint has already accepted the melt, so the proofs are spent
              console.log('[Fuse] Melt successful, cleaning up proofs immediately');
              console.log('[Fuse] Proofs to remove:', meltResult.proofsToRemove?.length);
              console.log('[Fuse] Change proofs:', meltResult.changeProofs?.length || 0);
              await cleanupMeltProofs(meltResult.proofsToRemove, meltResult.changeProofs);
              console.log('[Fuse] Proofs cleaned up');

              Alert.alert('Processing', 'Waiting for transaction to appear on-chain...');

              // Poll transaction history to check for the transaction
              let txFound = false;
              let attempts = 0;
              const maxAttempts = 30; // 30 attempts * 2 seconds = 60 seconds max wait

              while (!txFound && attempts < maxAttempts) {
                attempts++;
                console.log(`[Fuse] Polling attempt ${attempts}/${maxAttempts} for transaction...`);
                await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds

                // Refresh transaction history
                await fetchTransactionHistory();

                console.log(`[Fuse] Checking ${transactionHistory.length} transactions`);

                // Look for a transaction that includes our taproot address in outputs
                // Check ALL transactions, not just recent ones, because new transactions
                // may not have a block_time yet if they're still in mempool
                txFound = transactionHistory.some(tx => {
                  // Must have outputs to our taproot address
                  const hasOurAddress = tx.vout?.some(output =>
                    output.scriptpubkey_address === taprootAddress
                  );

                  if (!hasOurAddress) return false;

                  // Accept if either:
                  // 1. Transaction has no block_time (mempool/unconfirmed)
                  // 2. Transaction was confirmed within last 2 minutes
                  const txTime = tx.status?.block_time;
                  if (!txTime) {
                    // Unconfirmed transaction in mempool - this is what we're looking for!
                    console.log(`[Fuse] Found unconfirmed transaction: ${tx.txid}`);
                    return true;
                  }

                  // For confirmed transactions, check if recent
                  const now = Math.floor(Date.now() / 1000);
                  const isRecent = (now - txTime) < 120;
                  if (isRecent) {
                    console.log(`[Fuse] Found recent confirmed transaction: ${tx.txid}`);
                  }
                  return isRecent;
                });

                if (txFound) {
                  console.log('[Fuse] Transaction found on-chain!');
                  break;
                }
              }

              if (txFound) {
                await fetchTransactionHistory();
                Alert.alert('Success', 'E-cash successfully fused to on-chain UNIT!');
              } else {
                console.log('[Fuse] Transaction not found after 60s');
                await fetchTransactionHistory();
                Alert.alert(
                  'Pending',
                  'Melt completed successfully. Transaction will appear on-chain shortly.'
                );
              }
            } catch (error) {
              Alert.alert('Error', `Failed to fuse e-cash: ${error.message}`);
            }
          },
        },
      ]
    );
  }, [cashuBalance, taprootAddress, fetchTransactionHistory, transactionHistory]);

  // Handle turbo (convert all on-chain runes to e-cash)
  const handleTurboPress = useCallback(async () => {
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

      // Navigate directly to TurboLoading screen
      // unitRunesAmount is already in display format from the API (e.g., "1714.28")
      // parseRuneAmount will multiply by 100 to get the smallest unit for the runestone
      navigation.navigate('SendFlow', {
        screen: 'TurboLoading',
        params: {
          assetType: 'unit',
          prefillAddress: mintQuote.depositAddress,
          prefillAmount: unitRunesAmount,
          mintQuoteId: mintQuote.quoteId,
          mintAmount: unitRunesAmount,
          isTurbo: true,
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

  // Handle redeem Cashu token
  const handleRedeemToken = () => {
    Alert.prompt(
      'Redeem Cashu Token',
      'Paste your Cashu token to redeem:',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Redeem',
          onPress: async (tokenString) => {
            if (!tokenString || !tokenString.trim()) {
              Alert.alert('Error', 'Please enter a valid token');
              return;
            }

            try {
              // Check if token contains P2PK-locked proofs
              const { decodeToken } = await import('../../services/cashu/cashuCrypto');
              const { isP2PKSecret } = await import('../../services/cashu/cashuP2PK');
              const decoded = decodeToken(tokenString.trim());

              if (!decoded || !decoded.proofs || !Array.isArray(decoded.proofs)) {
                Alert.alert('Error', 'Invalid token format');
                return;
              }

              const hasP2PKProofs = decoded.proofs.some(p => isP2PKSecret(p.secret));

              if (hasP2PKProofs) {
                // Token is P2PK-locked, get private key from wallet
                const taprootAddress = taprootAddressRef.current;
                if (!taprootAddress) {
                  Alert.alert('Error', 'Taproot address not available');
                  return;
                }

                // Get private key and x-only pubkey for the taproot address
                const { getPrivateKeyForAddress } = await import('../../utils/wallet');
                const { privateKey } = await getPrivateKeyForAddress(taprootAddress);

                console.log('[AssetDetailScreen] Got private key:', {
                  privateKeyLength: privateKey?.length,
                  privateKeyPreview: privateKey?.substring(0, 16) + '...',
                  privateKeyType: typeof privateKey,
                });

                // Redeem P2PK token with private key
                const { receiveP2PKToken } = await import('../../services/cashu/cashuWalletService');
                await receiveP2PKToken(tokenString.trim(), privateKey);
                await fetchTransactionHistory();
                Alert.alert('Success', 'P2PK token redeemed successfully!');
              } else {
                // Regular token, redeem directly
                const { receiveToken } = await import('../../services/cashu/cashuWalletService');
                await receiveToken(tokenString.trim());
                await fetchTransactionHistory();
                Alert.alert('Success', 'Token redeemed successfully!');
              }
            } catch (error) {
              Alert.alert('Error', `Failed to redeem token: ${error.message}`);
            }
          },
        },
      ],
      'plain-text'
    );
  };

  // Handle ecash token details copy notification
  const handleCopyNotification = useCallback((message) => {
    showToast(message, 'success');
  }, [showToast]);

  // Open transaction in blockchain explorer or show token details for ecash
  const handleTransactionPress = useCallback(async (tx) => {
    // Handle ecash token clicks
    if (tx.ecashToken) {
      setSelectedToken(tx.tokenData);
      setShowTokenDetails(true);
      return;
    }

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
      isLoading={isBalanceLoading}
    />
  );

  const renderActionButtons = () => (
    <AssetActionButtons
      onSendPress={() => handleActionPress('send')}
      onReceivePress={() => handleActionPress('receive')}
      onConsolidatePress={() => handleActionPress('consolidate')}
      onTurboPress={() => handleActionPress('turbo')}
      showConsolidate={assetType === 'UNIT'}
      advancedMode={advancedMode}
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
              ecashBalance={cashuBalance}
              runesBalance={unitRunesAmount}
            />
          )}

          {renderActionButtons()}

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
            assetType={assetType}
            advancedMode={advancedMode}
          />

          {selectedTab === 'ACTIVITY' ? (
            <AssetActivityList
              transactions={filteredTransactions}
              isLoading={isActivityLoading}
              onTransactionPress={handleTransactionPress}
              advancedMode={advancedMode}
            />
          ) : selectedTab === 'TURBO' ? (
            <AssetTurboList navigation={navigation} />
          ) : (
            <AssetAbout assetType={assetType} />
          )}
        </Animated.ScrollView>
      </SafeAreaView>

      {/* Token Details Sheet */}
      {selectedToken && (
        <TokenDetailsSheet
          visible={showTokenDetails}
          onClose={() => setShowTokenDetails(false)}
          recipientAddress={selectedToken.recipient}
          shortUrl={selectedToken.shortUrl}
          cashuToken={selectedToken.token}
          onCopy={handleCopyNotification}
          advancedMode={advancedMode}
          claimed={selectedToken.claimed}
        />
      )}
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