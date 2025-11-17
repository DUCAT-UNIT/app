/**
 * AssetDetailScreen Component
 * Displays detailed information about a specific asset (BTC or UNIT)
 */

import React, { useState, useRef, useMemo } from 'react';
import {
  StyleSheet,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS } from '../../theme';
import { useBalance, useTransactionHistory } from '../../contexts/WalletDataContext';
import { usePrice } from '../../contexts/PriceContext';
import { useWallet } from '../../contexts/WalletContext';
import {
  AssetHeader,
  AssetInfo,
  AssetActionButtons,
  AssetPriceChart,
  AssetTabs,
  AssetAbout,
  AssetActivityList
} from '../../components/assetDetail';
import { usePriceChart } from '../../hooks/usePriceChart';
import { useAssetTransactions } from '../../hooks/useAssetTransactions';

function AssetDetailScreen({ route = {}, navigation }) {
  const { assetType = 'BTC' } = route?.params || {};

  const { segwitBalance, runesBalance } = useBalance();
  const { btcPrice } = usePrice();
  const wallet = useWallet().wallet;
  const { transactionHistory, loadingTransactionHistory } = useTransactionHistory();

  const [selectedTab, setSelectedTab] = useState('ACTIVITY');
  const [selectedTimeframe, setSelectedTimeframe] = useState('1M');
  const scrollY = useRef(new Animated.Value(0)).current;

  // Use extracted price chart hook
  const { priceData, priceDirection, priceLoading, priceError, setPriceError } = usePriceChart(assetType, selectedTimeframe);

  // Get balance based on asset type
  // For UNIT, use runesBalance which contains the actual UNIT amount
  const unitAmount = runesBalance && runesBalance.length > 0 ? parseFloat(runesBalance[0][1]) : 0;
  const balance = assetType === 'BTC' ? segwitBalance : unitAmount;
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
        const sendAssetType = assetType.toLowerCase(); // Convert BTC -> btc, UNIT -> unit
        navigation.navigate('SendFlow', {
          screen: 'AddressInput',
          params: { assetType: sendAssetType }
        });
        break;
      case 'receive':
        // Navigate to ReceiveQR screen with the appropriate address
        const receiveAddress = assetType === 'BTC' ? segwitAddress : taprootAddress;
        const addressType = assetType === 'BTC' ? 'Native SegWit' : 'Taproot';
        navigation.navigate('ReceiveQR', {
          address: receiveAddress,
          addressType: addressType,
        });
        break;
    }
  };

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
    />
  );

  const renderActionButtons = () => (
    <AssetActionButtons
      onSendPress={() => handleActionPress('send')}
      onReceivePress={() => handleActionPress('receive')}
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
          />

          {selectedTab === 'ACTIVITY' ? (
            <AssetActivityList
              transactions={filteredTransactions}
              isLoading={loadingTransactionHistory}
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