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
import { getRunesAmount } from '../../utils/runesHelper';

/**
 * Props for AssetDetailScreen component
 */
interface AssetDetailScreenProps {
  /** Route object from React Navigation containing navigation params */
  route?: {
    /** Route parameters */
    params?: {
      /** Type of asset to display (BTC or UNIT) */
      assetType?: 'BTC' | 'UNIT';
      /** Whether advanced mode is enabled for additional features */
      advancedMode?: boolean;
    };
  };
  /** Navigation object from React Navigation */
  navigation: {
    /** Navigate to a new screen */
    navigate: (screen: string, params?: object) => void;
    /** Go back to previous screen */
    goBack: () => void;
  };
}

/**
 * Token data structure for ecash tokens
 */
interface TokenData {
  /** Recipient address */
  recipient: string;
  /** Short URL for the token */
  shortUrl: string;
  /** The cashu token string */
  token: string;
  /** Whether the token has been claimed */
  claimed: boolean;
  /** Whether this is a self-claim */
  isSelfClaim?: boolean;
}

function AssetDetailScreen({ route = {}, navigation }: AssetDetailScreenProps): React.JSX.Element {
  const { assetType = 'BTC', advancedMode = false } = route?.params || {};

  const { segwitBalance, runesBalance, loadingBalance } = useBalance();
  const { btcPrice } = usePrice();
  const wallet = useWallet().wallet;
  const { balance: cashuBalance, isLoading: loadingCashu } = useCashu();
  const { transactionHistory, loadingTransactionHistory, fetchTransactionHistory } = useTransactionHistory();
  const { getSpentUtxos, unmarkUtxosAsSpent } = usePendingTransactions();

  const [selectedTab, setSelectedTab] = useState<'ACTIVITY' | 'ABOUT' | 'TURBO'>('ACTIVITY');
  const [selectedTimeframe, setSelectedTimeframe] = useState<'1D' | '1W' | '1M' | '1Y'>('1M');
  const [selectedToken, setSelectedToken] = useState<TokenData | null>(null);
  const [showTokenDetails, setShowTokenDetails] = useState<boolean>(false);
  const scrollY = useRef(new Animated.Value(0)).current;
  const { showToast } = useNotifications();

  // Track if balance has ever loaded (prevents spinner on background updates)
  const balanceLoadedRef = useRef(false);

  // Price chart hook
  const { priceData, priceDirection, priceLoading, priceError, setPriceError } = usePriceChart(assetType, selectedTimeframe);

  // Calculate balances
  // Runes from ord comes in display units (already divided)
  // Ecash is stored in smallest units (needs /100 for display)
  const unitRunesAmount = getRunesAmount(runesBalance);
  const cashuDisplayAmount = (cashuBalance || 0) / 100;
  const totalUnitAmount = unitRunesAmount + cashuDisplayAmount;
  const balance = assetType === 'BTC' ? segwitBalance : totalUnitAmount;
  const fiatValue = assetType === 'BTC' ? balance * (btcPrice ?? 0) : balance * 1;

  // Loading states - only show loading on initial load, not background updates
  const hasRunesData = runesBalance !== null && runesBalance !== undefined;
  const hasCashuData = cashuBalance !== null && cashuBalance !== undefined;
  const hasUnitData = hasRunesData || hasCashuData;
  const hasBtcData = segwitBalance !== null && segwitBalance !== undefined;

  // Mark as loaded once we have data
  if ((assetType === 'UNIT' && hasUnitData) || (assetType === 'BTC' && hasBtcData)) {
    balanceLoadedRef.current = true;
  }

  // Only show loading if we haven't loaded yet
  const isBalanceLoading = !balanceLoadedRef.current && (
    assetType === 'UNIT'
      ? loadingBalance || loadingCashu
      : loadingBalance
  );

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

  // Transaction filtering hook - cast transactionHistory to expected type
  const { transactions: filteredTransactions, isLoading: ecashLoading } = useAssetTransactions(
    (transactionHistory || []) as unknown as Parameters<typeof useAssetTransactions>[0],
    assetType,
    segwitAddress,
    taprootAddress,
    advancedMode
  );

  // For activity list loading - useAssetTransactions handles all the logic
  const isActivityLoading = ecashLoading;

  // Extracted operation hooks
  const { handleFusePress } = useFuseEcash({
    cashuBalance,
    taprootAddress: taprootAddress || '',
    transactionHistory: transactionHistory || [],
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
  const handleActionPress = useCallback((action: string) => {
    switch (action) {
      case 'send':
        navigation.navigate('SendFlow', {
          screen: 'AddressInput',
          params: { assetType: assetType.toLowerCase() }
        });
        break;
      case 'receive':
        navigation.navigate('ReceiveQR', {
          address: assetType === 'BTC' ? segwitAddress : taprootAddress,
          addressType: assetType === 'BTC' ? 'Native SegWit' : 'Taproot',
        });
        break;
      case 'consolidate':
        handleFusePress();
        break;
      case 'turbo':
        handleTurboPress();
        break;
    }
  }, [assetType, navigation, segwitAddress, taprootAddress, handleFusePress, handleTurboPress]);

  const handleCopyNotification = useCallback((message: string) => {
    showToast(message, 'success');
  }, [showToast]);

  const handleTransactionPress = useCallback(async (tx: { ecashToken?: boolean; isAutoclaim?: boolean; tokenData?: { recipient: string; shortUrl: string; token: string; claimed: boolean }; txid: string }) => {
    if (tx.ecashToken) {
      setSelectedToken(tx.tokenData ? { ...tx.tokenData, isSelfClaim: tx.isAutoclaim } : null);
      setShowTokenDetails(true);
      return;
    }

    try {
      const url = assetType === 'UNIT' ? getOrdTxUrl(tx.txid) : getTxUrl(tx.txid);
      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
      }
    } catch (error: unknown) {
      // Silently fail - error is intentionally caught and ignored
      void error;
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
            onTabChange={(tab: string) => setSelectedTab(tab as 'ACTIVITY' | 'TURBO' | 'ABOUT')}
            assetType={assetType}
            advancedMode={advancedMode}
          />

          {selectedTab === 'ACTIVITY' ? (
            <AssetActivityList
              transactions={filteredTransactions}
              isLoading={isActivityLoading}
              onTransactionPress={handleTransactionPress as (tx: { txid: string; ecashToken?: boolean }) => void}
              advancedMode={advancedMode}
            />
          ) : selectedTab === 'TURBO' ? (
            <AssetTurboList />
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
          isSelfClaim={selectedToken.isSelfClaim}
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
