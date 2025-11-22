/**
 * Transaction History Screen
 * Displays user's transaction history in a bottom sheet
 */

import React, { useCallback, useState } from 'react';
import PropTypes from 'prop-types';
import {
  View,
  Text,
  TouchableOpacity,
  Animated,
  ActivityIndicator,
  FlatList,
} from 'react-native';
import { COLORS } from '../../theme';
import TransactionItem from '../../components/transaction/TransactionItem';
import { useBottomSheetAnimation } from '../../hooks/useBottomSheetAnimation';
import { useTransactionHistoryData } from '../../hooks/useTransactionHistoryData';
import TokenDetailsSheet from '../../components/ecash/TokenDetailsSheet';
import { useNotifications } from '../../contexts/NotificationContext';

export default function TransactionHistoryScreen({
  styles,
  showHistorySheet,
  onClose,
  segwitAddress,
  taprootAddress,
  advancedMode = false,
}) {
  const [selectedToken, setSelectedToken] = useState(null);
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
  const handleCopyNotification = useCallback((message) => {
    showToast(message, 'success');
  }, [showToast]);

  // Render function for each transaction
  const renderTransaction = useCallback(
    ({ item: tx }) => (
      <TransactionItem
        tx={tx}
        styles={styles}
        onPress={() => {
          if (tx.vaultTransaction) {
            // Vault transactions don't have explorer links yet
            return;
          }

          // Handle ecash token clicks
          if (tx.ecashToken) {
            setSelectedToken(tx.tokenData);
            setShowTokenDetails(true);
            return;
          }

          openTxInExplorer(tx.txid, tx.txData.assetType);
        }}
      />
    ),
    [styles, openTxInExplorer]
  );

  // KeyExtractor for FlatList
  const keyExtractor = useCallback((item) => item.txid, []);

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
          <View style={styles.historyLoadingContainer}>
            <ActivityIndicator size="large" color={COLORS.PRIMARY_BLUE} />
            <Text style={styles.historyLoadingText}>Loading transactions...</Text>
          </View>
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
        />
      )}
    </>
  );
}

TransactionHistoryScreen.propTypes = {
  styles: PropTypes.object.isRequired,
  showHistorySheet: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  segwitAddress: PropTypes.string.isRequired,
  taprootAddress: PropTypes.string.isRequired,
};
