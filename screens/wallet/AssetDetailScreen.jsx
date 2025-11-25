/**
 * AssetDetailScreen Component
 * Displays detailed information about a specific asset (BTC or UNIT)
 */

import React, { useState, useRef, useMemo, useCallback } from 'react';
import {
  StyleSheet,
  Animated,
  Linking,
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
import { useFuseEcash } from '../../hooks/useFuseEcash';
import { useTurboConvert } from '../../hooks/useTurboConvert';
import { useRedeemCashuToken } from '../../hooks/useRedeemCashuToken';
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

  // Price chart hook
  const { priceData, priceDirection, priceLoading, priceError, setPriceError } = usePriceChart(assetType, selectedTimeframe);

  // Calculate balances
  const unitRunesAmount = runesBalance && runesBalance.length > 0 ? parseFloat(runesBalance[0][1]) : 0;
  const totalUnitAmount = unitRunesAmount + cashuBalance;
  const balance = assetType === 'BTC' ? segwitBalance : totalUnitAmount;
  const fiatValue = assetType === 'BTC' ? balance * btcPrice : balance * 1;

  // Loading states
  const hasRunesData = runesBalance !== null && runesBalance !== undefined;
  const hasCashuData = cashuBalance !== null && cashuBalance !== undefined;
  const isBalanceLoading = assetType === 'UNIT'
    ? (!hasRunesData && loadingBalance) || (!hasCashuData && loadingCashu)
    : (!segwitBalance && loadingBalance);

  // Extract stable wallet addresses using refs
  const segwitAddressRef = useRef(wallet?.segwitAddress);
  const taprootAddressRef = useRef(wallet?.taprootAddress);

  if (wallet?.segwitAddress && wallet.segwitAddress !== segwitAddressRef.current) {
    segwitAddressRef.current = wallet.segwitAddress;
  }
  if (wallet?.taprootAddress && wallet.taprootAddress !== taprootAddressRef.current) {
    taprootAddressRef.current = wallet.taprootAddress;
  }

  const segwitAddress = segwitAddressRef.current;
  const taprootAddress = taprootAddressRef.current;

  const isPositive = useMemo(() => priceDirection.isPositive, [priceDirection.isPositive]);

  // Transaction filtering hook
  const { transactions: filteredTransactions, isLoading: ecashLoading } = useAssetTransactions(
    transactionHistory, assetType, segwitAddress, taprootAddress, advancedMode
  );

  const isActivityLoading = assetType === 'UNIT'
    ? loadingTransactionHistory || loadingCashu || ecashLoading
    : loadingTransactionHistory;

  // Extracted operation hooks
  const { handleFusePress } = useFuseEcash({
    cashuBalance,
    taprootAddress,
    transactionHistory,
    fetchTransactionHistory,
  });

  const { handleTurboPress } = useTurboConvert({
    runesBalance,
    navigation,
    getSpentUtxos,
    unmarkUtxosAsSpent,
  });

  useRedeemCashuToken({ fetchTransactionHistory });

  // Action handlers
  const handleActionPress = useCallback((action) => {
    switch (action) {
      case 'send':
        if (assetType === 'CASHU') {
          navigation.navigate('CashuSend');
        } else {
          navigation.navigate('SendFlow', {
            screen: 'AddressInput',
            params: { assetType: assetType.toLowerCase() }
          });
        }
        break;
      case 'receive':
        if (assetType === 'CASHU') {
          navigation.navigate('CashuReceive');
        } else {
          navigation.navigate('ReceiveQR', {
            address: assetType === 'BTC' ? segwitAddress : taprootAddress,
            addressType: assetType === 'BTC' ? 'Native SegWit' : 'Taproot',
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
  }, [assetType, navigation, segwitAddress, taprootAddress, handleFusePress, handleTurboPress]);

  const handleCopyNotification = useCallback((message) => {
    showToast(message, 'success');
  }, [showToast]);

  const handleTransactionPress = useCallback(async (tx) => {
    if (tx.ecashToken) {
      setSelectedToken(tx.tokenData);
      setShowTokenDetails(true);
      return;
    }

    try {
      const url = assetType === 'UNIT' ? getOrdTxUrl(tx.txid) : getTxUrl(tx.txid);
      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
      }
    } catch (error) {
      // Silently fail
    }
  }, [assetType]);

  return (
    <>
      <SafeAreaView style={styles.container}>
        <AssetHeader onBackPress={() => navigation.goBack()} />

        <Animated.ScrollView
          style={styles.scrollView}
          onScroll={Animated.event(
            [{ nativeEvent: { contentOffset: { y: scrollY } } }],
            { useNativeDriver: false }
          )}
          scrollEventThrottle={16}
        >
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

          {assetType === 'UNIT' && (
            <UnitBalanceBreakdown
              ecashBalance={cashuBalance}
              runesBalance={unitRunesAmount}
            />
          )}

          <AssetActionButtons
            onSendPress={() => handleActionPress('send')}
            onReceivePress={() => handleActionPress('receive')}
            onConsolidatePress={() => handleActionPress('consolidate')}
            onTurboPress={() => handleActionPress('turbo')}
            showConsolidate={assetType === 'UNIT'}
            advancedMode={advancedMode}
          />

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
  scrollView: {
    flex: 1,
  },
});

export default React.memo(AssetDetailScreen);
