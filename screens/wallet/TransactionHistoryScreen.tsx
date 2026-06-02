/**
 * Transaction History Screen
 * Displays user's transaction history in a bottom sheet
 */

import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Animated,
  FlatList,
  Modal,
  ViewStyle,
  TextStyle,
} from 'react-native';
import TransactionItem, {
  TransactionItemStyles,
  Transaction as TransactionItemType,
} from '../../components/transaction/TransactionItem';
import { TransactionHistorySkeleton } from '../../components/transaction/TransactionHistorySkeleton';
import { useBottomSheetAnimation } from '../../hooks/useBottomSheetAnimation';
import {
  useTransactionHistoryData,
  DisplayTransaction,
} from '../../hooks/useTransactionHistoryData';
import TokenDetailsSheet from '../../components/ecash/TokenDetailsSheet';
import VaultTransactionDetailsSheet from '../../components/vaultDetail/VaultTransactionDetailsSheet';
import TransactionDetailsSheet from '../../components/transaction/TransactionDetailsSheet';
import { useNotifications } from '../../stores/notificationStore';
import {
  saveSentLockedToken,
  type TokenRecord,
  type EcashTokenRecord,
} from '../../services/cashu/cashuLockedTokensService';
import type { VaultHistoryTransaction } from '../../services/vaultService';
import type { DisplayAssetType } from '../../types/assets';
import type { CashuUnit } from '../../services/cashu/cashuUnits';
import { isE2E } from '../../utils/e2e';

/** Type guard to check if token is a sent token (TokenRecord) */
function isSentToken(token: EcashTokenRecord): token is TokenRecord {
  return 'recipient' in token;
}

/**
 * Token data for ecash tokens
 */
interface TokenData {
  recipient: string;
  shortUrl?: string | null;
  token: string;
  claimed: boolean;
  isSelfClaim: boolean;
  cashuUnit?: CashuUnit;
}

/**
 * Style object for TransactionHistoryScreen
 * Extends TransactionItemStyles to include all required transaction item styles
 */
interface TransactionHistoryStyles extends TransactionItemStyles {
  bottomSheetBackdrop: ViewStyle;
  bottomSheet: ViewStyle;
  historySheet: ViewStyle;
  historyHandleArea: ViewStyle;
  bottomSheetHandle: ViewStyle;
  bottomSheetTitle: TextStyle;
  historyLoadingContainer: ViewStyle;
  historyLoadingText: TextStyle;
  historyEmptyContainer: ViewStyle;
  historyEmptyText: TextStyle;
  historyScrollView: ViewStyle;
  [key: string]: ViewStyle | TextStyle | number | undefined;
}

/**
 * Props for TransactionHistoryScreen
 */
interface TransactionHistoryScreenProps {
  styles: TransactionHistoryStyles;
  showHistorySheet: boolean;
  onClose: () => void;
  segwitAddress: string;
  taprootAddress: string;
  vaultPubkey?: string;
  advancedMode?: boolean;
}

export default function TransactionHistoryScreen({
  styles,
  showHistorySheet,
  onClose,
  segwitAddress,
  taprootAddress,
  advancedMode = false,
}: TransactionHistoryScreenProps): React.JSX.Element {
  const [selectedToken, setSelectedToken] = useState<TokenData | null>(null);
  const [showTokenDetails, setShowTokenDetails] = useState(false);
  const [selectedVaultTx, setSelectedVaultTx] = useState<VaultHistoryTransaction | null>(null);
  const [previousVaultTx, setPreviousVaultTx] = useState<VaultHistoryTransaction | null>(null);
  const [showVaultDetails, setShowVaultDetails] = useState(false);
  // Regular transaction details state
  const [selectedRegularTx, setSelectedRegularTx] = useState<{
    txid: string;
    timestamp?: number;
    confirmed: boolean;
    txData: {
      amount: number | bigint;
      assetType: DisplayAssetType;
      isSent: boolean;
      isReceived: boolean;
      displayKind?: 'turbo_mint_claim' | 'turbo_redeem';
    };
  } | null>(null);
  const [showRegularTxDetails, setShowRegularTxDetails] = useState(false);
  const { showToast } = useNotifications();

  // Animation and gesture handling
  const { opacity, translateY, panResponder, handleDismiss } = useBottomSheetAnimation(
    showHistorySheet,
    onClose
  );

  // Transaction history data and logic
  const { loading, displayTransactions } = useTransactionHistoryData(
    showHistorySheet,
    segwitAddress,
    taprootAddress
  );

  // Handle ecash token details copy notification
  const handleCopyNotification = useCallback(
    (message: string) => {
      showToast(message, 'success');
    },
    [showToast]
  );

  const handleShortUrlReady = useCallback(
    async (shortUrl: string, amount: number) => {
      const token = selectedToken;
      if (!token?.recipient) {
        return;
      }

      setSelectedToken({
        ...token,
        shortUrl,
      });

      await saveSentLockedToken(
        token.token,
        token.recipient,
        amount,
        null,
        shortUrl,
        taprootAddress || null,
        token.cashuUnit
      );
    },
    [selectedToken, taprootAddress]
  );

  // Helper to convert transaction vaultData to VaultHistoryTransaction format
  const convertToVaultHistoryTx = useCallback(
    (tx: DisplayTransaction): VaultHistoryTransaction | null => {
      if (!tx.vaultTransaction || !tx.vaultData) return null;
      return {
        amount_borrowed: tx.vaultData.amountBorrowed ?? 0,
        vault_amount: tx.vaultData.vaultAmount ?? 0,
        btc_amt: tx.vaultData.btcAmount ?? 0,
        unit_amt: tx.vaultData.unitAmount ?? 0,
        oracle_price: tx.vaultData.oraclePrice ?? 0,
        timestamp: tx.timestamp ?? 0,
        action: tx.vaultData.action,
      };
    },
    []
  );

  // Find previous vault transaction in list (for before/after comparison)
  const findPreviousVaultTx = useCallback(
    (currentTx: DisplayTransaction): VaultHistoryTransaction | null => {
      const vaultTxs = displayTransactions.filter((t) => t.vaultTransaction);
      const currentIndex = vaultTxs.findIndex((t) => t.timestamp === currentTx.timestamp);
      if (currentIndex < 0 || currentIndex >= vaultTxs.length - 1) return null;
      // Transactions are sorted newest first, so previous is at index + 1
      return convertToVaultHistoryTx(vaultTxs[currentIndex + 1]);
    },
    [displayTransactions, convertToVaultHistoryTx]
  );

  // Render function for each transaction
  const renderTransaction = useCallback(
    ({ item: tx, index }: { item: DisplayTransaction; index: number }) => (
      <View testID={`transaction-history-row-${index}`} collapsable={false}>
        <TransactionItem
          tx={tx as unknown as TransactionItemType}
          styles={styles}
          testIDBase={`transaction-history-row-${index}`}
          onPress={() => {
            if (tx.vaultTransaction && tx.vaultData) {
              // Show vault transaction details sheet
              const vaultTx = convertToVaultHistoryTx(tx);
              if (vaultTx) {
                setSelectedVaultTx(vaultTx);
                setPreviousVaultTx(findPreviousVaultTx(tx));
                setShowVaultDetails(true);
              }
              return;
            }

            // Handle ecash token clicks
            if (tx.ecashToken && tx.tokenData) {
              // Check if it's a sent token (has recipient) or received token (has sender)
              if (isSentToken(tx.tokenData)) {
                setSelectedToken({
                  recipient: tx.tokenData.recipient,
                  shortUrl: tx.tokenData.shortUrl ?? null,
                  token: tx.tokenData.token,
                  claimed: tx.tokenData.claimed ?? false,
                  isSelfClaim: tx.isAutoclaim ?? false,
                  cashuUnit: tx.tokenData.unit,
                });
              } else {
                // Received token - no recipient/shortUrl
                setSelectedToken({
                  recipient: '',
                  shortUrl: null,
                  token: tx.tokenData.token,
                  claimed: tx.tokenData.claimed ?? false,
                  isSelfClaim: false,
                  cashuUnit: tx.tokenData.unit,
                });
              }
              setShowTokenDetails(true);
              return;
            }

            // Handle regular BTC/UNIT transactions - show details sheet
            if (tx.txData) {
              setSelectedRegularTx({
                txid: tx.txid,
                timestamp: tx.status?.block_time,
                confirmed: tx.status?.confirmed ?? false,
                txData: {
                  amount: tx.txData.amount,
                  assetType: tx.txData.assetType as DisplayAssetType,
                  isSent: tx.txData.isSent,
                  isReceived: tx.txData.isReceived,
                  displayKind: tx.txData.displayKind,
                },
              });
              setShowRegularTxDetails(true);
            }
          }}
        />
      </View>
    ),
    [styles, convertToVaultHistoryTx, findPreviousVaultTx]
  );

  // KeyExtractor for FlatList
  const keyExtractor = useCallback((item: DisplayTransaction) => item.txid, []);

  // Estimated height for each transaction item (used for getItemLayout optimization)
  const TRANSACTION_ITEM_HEIGHT = 80;

  // getItemLayout for better scroll performance (avoids measuring each item)
  const getItemLayout = useCallback(
    (_data: ArrayLike<DisplayTransaction> | null | undefined, index: number) => ({
      length: TRANSACTION_ITEM_HEIGHT,
      offset: TRANSACTION_ITEM_HEIGHT * index,
      index,
    }),
    []
  );

  const historyModalVisible =
    showHistorySheet || showTokenDetails || showVaultDetails || showRegularTxDetails;
  const historyContent = (
    <>
      {showHistorySheet && !showTokenDetails && !showVaultDetails && !showRegularTxDetails && (
        <TouchableOpacity
          style={styles.bottomSheetBackdrop}
          activeOpacity={1}
          onPress={handleDismiss}
        />
      )}
      <Animated.View
        style={[
          styles.bottomSheet,
          styles.historySheet,
          {
            opacity,
            transform: [{ translateY }],
          },
        ]}
        pointerEvents={
          !showHistorySheet || showTokenDetails || showVaultDetails || showRegularTxDetails
            ? 'none'
            : 'auto'
        }
      >
        <View style={styles.historyHandleArea} {...panResponder.panHandlers}>
          <View style={styles.bottomSheetHandle} />
          <Text style={styles.bottomSheetTitle}>Transaction History</Text>
        </View>

        {loading ? (
          <TransactionHistorySkeleton />
        ) : displayTransactions.length === 0 ? (
          <View style={styles.historyEmptyContainer}>
            <Text style={styles.historyEmptyText}>No transactions yet</Text>
          </View>
        ) : (
          <FlatList
            data={displayTransactions}
            renderItem={renderTransaction}
            keyExtractor={keyExtractor}
            getItemLayout={getItemLayout}
            style={styles.historyScrollView}
            contentContainerStyle={{ paddingBottom: 24 }}
            showsVerticalScrollIndicator={false}
            initialNumToRender={20}
            maxToRenderPerBatch={20}
            windowSize={10}
            removeClippedSubviews={true}
          />
        )}
      </Animated.View>
    </>
  );

  return (
    <>
      {isE2E() ? (
        historyContent
      ) : (
        <Modal
          visible={historyModalVisible}
          transparent
          animationType="none"
          presentationStyle="overFullScreen"
          statusBarTranslucent
          onRequestClose={handleDismiss}
        >
          {historyContent}
        </Modal>
      )}

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
          isSelfClaim={selectedToken.isSelfClaim}
          cashuUnit={selectedToken.cashuUnit}
          onShortUrlReady={handleShortUrlReady}
        />
      )}

      {/* Vault Transaction Details Sheet */}
      <VaultTransactionDetailsSheet
        visible={showVaultDetails}
        onClose={() => setShowVaultDetails(false)}
        transaction={selectedVaultTx}
        previousTransaction={previousVaultTx}
      />

      {/* Regular Transaction Details Sheet */}
      <TransactionDetailsSheet
        visible={showRegularTxDetails}
        onClose={() => setShowRegularTxDetails(false)}
        txid={selectedRegularTx?.txid ?? null}
        timestamp={selectedRegularTx?.timestamp}
        confirmed={selectedRegularTx?.confirmed ?? false}
        txData={selectedRegularTx?.txData ?? null}
      />
    </>
  );
}
