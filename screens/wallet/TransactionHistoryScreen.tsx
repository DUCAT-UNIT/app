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
  ViewStyle,
  TextStyle,
} from 'react-native';
import TransactionItem, { TransactionItemStyles, Transaction as TransactionItemType } from '../../components/transaction/TransactionItem';
import { TransactionHistorySkeleton } from '../../components/transaction/TransactionHistorySkeleton';
import { useBottomSheetAnimation } from '../../hooks/useBottomSheetAnimation';
import { useTransactionHistoryData, DisplayTransaction } from '../../hooks/useTransactionHistoryData';
import TokenDetailsSheet from '../../components/ecash/TokenDetailsSheet';
import { useNotifications } from '../../contexts/NotificationContext';
import type { TokenRecord, EcashTokenRecord } from '../../services/cashu/cashuLockedTokensService';

/** Type guard to check if token is a sent token (TokenRecord) */
function isSentToken(token: EcashTokenRecord): token is TokenRecord {
  return 'recipient' in token;
}

/**
 * Token data for ecash tokens
 */
interface TokenData {
  recipient: string;
  shortUrl: string;
  token: string;
  claimed: boolean;
  isSelfClaim: boolean;
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
  [key: string]: ViewStyle | TextStyle;
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
  const { showToast } = useNotifications();

  // Animation and gesture handling
  const { opacity, translateY, panResponder, handleDismiss } = useBottomSheetAnimation(
    showHistorySheet,
    onClose
  );

  // Transaction history data and logic
  const { loading, displayTransactions, openTxInExplorer } = useTransactionHistoryData(
    showHistorySheet,
    segwitAddress,
    taprootAddress
  );

  // Handle ecash token details copy notification
  const handleCopyNotification = useCallback((message: string) => {
    showToast(message, 'success');
  }, [showToast]);

  // Render function for each transaction
  const renderTransaction = useCallback(
    ({ item: tx }: { item: DisplayTransaction }) => (
      <TransactionItem
        tx={tx as unknown as TransactionItemType}
        styles={styles}
        onPress={() => {
          if (tx.vaultTransaction) {
            // Vault transactions don't have explorer links yet
            return;
          }

          // Handle ecash token clicks
          if (tx.ecashToken && tx.tokenData) {
            // Check if it's a sent token (has recipient) or received token (has sender)
            if (isSentToken(tx.tokenData)) {
              setSelectedToken({
                recipient: tx.tokenData.recipient,
                shortUrl: tx.tokenData.shortUrl ?? '',
                token: tx.tokenData.token,
                claimed: tx.tokenData.claimed ?? false,
                isSelfClaim: tx.isAutoclaim ?? false,
              });
            } else {
              // Received token - no recipient/shortUrl
              setSelectedToken({
                recipient: '',
                shortUrl: '',
                token: tx.tokenData.token,
                claimed: tx.tokenData.claimed ?? false,
                isSelfClaim: false,
              });
            }
            setShowTokenDetails(true);
            return;
          }

          openTxInExplorer(tx.txid, tx.txData?.assetType ?? 'BTC');
        }}
      />
    ),
    [styles, openTxInExplorer]
  );

  // KeyExtractor for FlatList
  const keyExtractor = useCallback((item: DisplayTransaction) => item.txid, []);

  return (
    <>
      {showHistorySheet && !showTokenDetails && (
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
        pointerEvents={!showHistorySheet || showTokenDetails ? 'none' : 'auto'}
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
            style={styles.historyScrollView}
            showsVerticalScrollIndicator={false}
            initialNumToRender={20}
            maxToRenderPerBatch={20}
            windowSize={10}
            removeClippedSubviews={true}
          />
        )}
      </Animated.View>

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
        />
      )}
    </>
  );
}
