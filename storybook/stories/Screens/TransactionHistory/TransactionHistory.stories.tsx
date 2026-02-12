/**
 * Transaction History Screen Stories
 * Bottom sheet displaying user's transaction history
 * Design System Reference: /DESIGN_SYSTEM.md
 */
import React, { useState, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Animated, PanResponder } from 'react-native';
import type { Meta, StoryObj } from '@storybook/react';
import Icon from '../../../../components/icons';
import { AssetActivityList } from '../../../../components/assetDetail/AssetActivityList';
import { VaultActivityList } from '../../../../components/vaultDetail/VaultActivityList';
import type { Transaction } from '../../../../components/transaction/TransactionItem';
import type { VaultHistoryTransaction } from '../../../../services/vaultService';
import {
  colors,
  spacing,
  fonts,
  fontSizes,
  fontWeights,
  radii,
  phoneFrame,
  DEVICE_CONFIGS,
  type ScreenSize,
} from '../../design-tokens';

// =============================================================================
// MOCK DATA
// =============================================================================

// Asset transactions
const MOCK_ASSET_TRANSACTIONS: Transaction[] = [
  {
    txid: 'tx-1',
    timestamp: Date.now() - 3600000,
    status: { confirmed: true },
    txData: {
      amount: 5420000,
      assetType: 'BTC',
      isSent: false,
      isReceived: true,
    },
  },
  {
    txid: 'tx-2',
    timestamp: Date.now() - 86400000,
    status: { confirmed: true },
    txData: {
      amount: 100000,
      assetType: 'BTC',
      isSent: true,
      isReceived: false,
    },
  },
  {
    txid: 'tx-3',
    timestamp: Date.now() - 172800000,
    status: { confirmed: true },
    txData: {
      amount: 1234567,
      assetType: 'UNIT',
      isSent: false,
      isReceived: true,
    },
  },
  {
    txid: 'tx-4',
    timestamp: Date.now() - 259200000,
    status: { confirmed: true },
    txData: {
      amount: 500000,
      assetType: 'UNIT',
      isSent: true,
      isReceived: false,
    },
  },
  {
    txid: 'tx-5',
    timestamp: Date.now() - 345600000,
    status: { confirmed: false },
    txData: {
      amount: 1000000,
      assetType: 'BTC',
      isSent: false,
      isReceived: true,
    },
  },
  {
    txid: 'tx-6',
    timestamp: Date.now() - 432000000,
    status: { confirmed: true },
    txData: {
      amount: 250000,
      assetType: 'BTC',
      isSent: true,
      isReceived: false,
    },
  },
];

// Vault transactions
const MOCK_VAULT_TRANSACTIONS: VaultHistoryTransaction[] = [
  {
    action: 'open',
    vault_amount: 15000000,
    amount_borrowed: 500000,
    btc_amt: 50000000,
    unit_amt: 300000,
    oracle_price: 95000,
    timestamp: Math.floor(Date.now() / 1000) - 3600,
  },
  {
    action: 'deposit',
    vault_amount: 25000000,
    amount_borrowed: 500000,
    btc_amt: 25000000,
    unit_amt: 0,
    oracle_price: 95000,
    timestamp: Math.floor(Date.now() / 1000) - 10800,
  },
  {
    action: 'borrow',
    vault_amount: 25000000,
    amount_borrowed: 2000000,
    btc_amt: 0,
    unit_amt: 1500000,
    oracle_price: 95000,
    timestamp: Math.floor(Date.now() / 1000) - 21600,
  },
  {
    action: 'repay',
    vault_amount: 25000000,
    amount_borrowed: 1500000,
    btc_amt: 0,
    unit_amt: 500000,
    oracle_price: 95000,
    timestamp: Math.floor(Date.now() / 1000) - 43200,
  },
];

// =============================================================================
// HEADER WITH HISTORY BUTTON
// =============================================================================

interface MockHeaderProps {
  onHistoryPress: () => void;
}

const MockHeader = ({ onHistoryPress }: MockHeaderProps) => (
  <View style={styles.header}>
    <View style={styles.headerLeft}>
      <View style={styles.accountBadge}>
        <Text style={styles.accountNumber}>1</Text>
      </View>
    </View>
    <View style={styles.headerRight}>
      <TouchableOpacity style={styles.headerButton} onPress={onHistoryPress} activeOpacity={0.7}>
        <Icon name="transaction_history" size={24} color={colors.text.primary} />
      </TouchableOpacity>
      <TouchableOpacity style={styles.headerButton} activeOpacity={0.7}>
        <Icon name="qr_scan" size={24} color={colors.text.primary} />
      </TouchableOpacity>
      <TouchableOpacity style={styles.headerButton} activeOpacity={0.7}>
        <Icon name="settings" size={24} color={colors.text.primary} />
      </TouchableOpacity>
    </View>
  </View>
);

// =============================================================================
// BOTTOM SHEET COMPONENTS
// =============================================================================

interface BottomSheetHandleProps {
  onPress: () => void;
}

const BottomSheetHandle = ({ onPress }: BottomSheetHandleProps) => (
  <TouchableOpacity style={styles.handleArea} onPress={onPress} activeOpacity={0.7}>
    <View style={styles.handle} />
  </TouchableOpacity>
);

interface BottomSheetHeaderProps {
  title: string;
  onClose: () => void;
}

const BottomSheetHeader = ({ title, onClose }: BottomSheetHeaderProps) => (
  <TouchableOpacity style={styles.headerArea} onPress={onClose} activeOpacity={0.9}>
    <Text style={styles.headerTitle}>{title}</Text>
  </TouchableOpacity>
);

// =============================================================================
// SCREEN MOCK
// =============================================================================

type TransactionFilter = 'all' | 'btc' | 'unit' | 'vault';

interface TransactionHistoryMockProps {
  size?: ScreenSize;
  filter?: TransactionFilter;
  isEmpty?: boolean;
  isLoading?: boolean;
  scale?: number;
  width?: number;
}

const TransactionHistoryMock = ({
  size = 'L',
  filter = 'all',
  isEmpty = false,
  isLoading = false,
  scale = 1,
  width = 393,
}: TransactionHistoryMockProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const translateY = useRef(new Animated.Value(0)).current;
  const handleNoop = () => {};

  // Pan responder for swipe-to-dismiss
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        // Only respond to vertical gestures
        return Math.abs(gestureState.dy) > Math.abs(gestureState.dx);
      },
      onPanResponderMove: (_, gestureState) => {
        // Only allow dragging down (positive dy)
        if (gestureState.dy > 0) {
          translateY.setValue(gestureState.dy);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        // If dragged down more than 100px or with velocity, dismiss
        if (gestureState.dy > 100 || gestureState.vy > 0.5) {
          Animated.timing(translateY, {
            toValue: 600,
            duration: 200,
            useNativeDriver: true,
          }).start(() => {
            setIsOpen(false);
            translateY.setValue(0);
          });
        } else {
          // Snap back
          Animated.spring(translateY, {
            toValue: 0,
            useNativeDriver: true,
          }).start();
        }
      },
    })
  ).current;

  // Filter transactions based on selection
  const getFilteredAssetTransactions = () => {
    if (isEmpty) return [];
    if (filter === 'vault') return [];
    if (filter === 'btc') {
      return MOCK_ASSET_TRANSACTIONS.filter(tx => tx.txData && 'assetType' in tx.txData && tx.txData.assetType === 'BTC');
    }
    if (filter === 'unit') {
      return MOCK_ASSET_TRANSACTIONS.filter(tx => tx.txData && 'assetType' in tx.txData && tx.txData.assetType === 'UNIT');
    }
    return MOCK_ASSET_TRANSACTIONS;
  };

  const showVaultTransactions = !isEmpty && (filter === 'all' || filter === 'vault');
  const assetTransactions = getFilteredAssetTransactions();

  return (
    <View style={styles.screenContainer}>
      {/* Main screen content with header */}
      <MockHeader onHistoryPress={() => setIsOpen(true)} />

      {/* Placeholder content */}
      <View style={styles.placeholderContent}>
        <Text style={styles.placeholderText}>Tap the history icon to open</Text>
      </View>

      {/* Backdrop */}
      {isOpen && (
        <TouchableOpacity
          style={styles.backdrop}
          activeOpacity={1}
          onPress={() => setIsOpen(false)}
        />
      )}

      {/* Bottom Sheet */}
      {isOpen && (
        <Animated.View style={[styles.bottomSheet, { transform: [{ translateY }] }]}>
          <View {...panResponder.panHandlers}>
            <BottomSheetHandle onPress={() => setIsOpen(false)} />
            <BottomSheetHeader title="Transaction History" onClose={() => setIsOpen(false)} />
          </View>

          <ScrollView
            style={styles.scrollView}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
          >
            {/* Asset Transactions */}
            {(filter !== 'vault') && (
              <View style={{
                marginHorizontal: spacing.lg,
              }}>
                <View style={{
                  transform: [{ scale }],
                  transformOrigin: 'top left',
                  width: (width - spacing.lg * 2) / scale,
                }}>
                  <AssetActivityList
                    transactions={assetTransactions}
                    isLoading={isLoading}
                    onTransactionPress={handleNoop}
                    advancedMode={false}
                  />
                </View>
              </View>
            )}

            {/* Vault Transactions */}
            {showVaultTransactions && (
              <View style={{ marginTop: spacing.lg }}>
                <Text style={styles.sectionTitle}>Vault Activity</Text>
                <View style={{
                  marginHorizontal: spacing.lg,
                }}>
                  <View style={{
                    transform: [{ scale }],
                    transformOrigin: 'top left',
                    width: (width - spacing.lg * 2) / scale,
                  }}>
                    <VaultActivityList
                      transactions={MOCK_VAULT_TRANSACTIONS}
                      isLoading={isLoading}
                      onTransactionPress={handleNoop}
                    />
                  </View>
                </View>
              </View>
            )}

            {/* Empty State */}
            {isEmpty && !isLoading && (
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>No transactions yet</Text>
              </View>
            )}
          </ScrollView>
        </Animated.View>
      )}
    </View>
  );
};

// =============================================================================
// STORY WRAPPER
// =============================================================================

interface StoryProps {
  screenSize: ScreenSize;
  filter: TransactionFilter;
  isEmpty: boolean;
  isLoading: boolean;
}

const TransactionHistoryStory = ({ screenSize, filter, isEmpty, isLoading }: StoryProps) => {
  const config = DEVICE_CONFIGS.find(d => d.size === screenSize) || DEVICE_CONFIGS[3];

  return (
    <View style={styles.storyContainer}>
      <View style={[styles.phoneFrame, { width: config.width }]}>
        <TransactionHistoryMock
          size={config.size}
          filter={filter}
          isEmpty={isEmpty}
          isLoading={isLoading}
          scale={config.scale}
          width={config.width}
        />
      </View>
    </View>
  );
};

// =============================================================================
// OVERVIEW COMPONENT
// =============================================================================

interface OverviewProps {
  filter: TransactionFilter;
  isEmpty: boolean;
  isLoading: boolean;
}

const TransactionHistoryOverview = ({ filter, isEmpty, isLoading }: OverviewProps) => (
  <ScrollView style={styles.overviewContainer} contentContainerStyle={styles.overviewContent}>
    {DEVICE_CONFIGS.map((config) => (
      <View key={config.size} style={styles.deviceRow}>
        <View style={styles.deviceLabel}>
          <Text style={styles.deviceSize}>{config.size}</Text>
          <Text style={styles.deviceName}>{config.label}</Text>
          <Text style={styles.deviceWidth}>{config.width}px</Text>
        </View>
        <View style={[styles.phoneFrame, { width: config.width }]}>
          <TransactionHistoryMock
            size={config.size}
            filter={filter}
            isEmpty={isEmpty}
            isLoading={isLoading}
            scale={config.scale}
            width={config.width}
          />
        </View>
      </View>
    ))}
  </ScrollView>
);

// =============================================================================
// STORYBOOK META
// =============================================================================

const meta: Meta = {
  title: 'Screens/TransactionHistory',
  parameters: {
    notes: 'Transaction history bottom sheet showing asset and vault transactions.',
  },
};

export default meta;
// =============================================================================
// STORIES
// =============================================================================

export const Interactive: StoryObj<StoryProps> = {
  render: (args) => <TransactionHistoryStory {...args} />,
  args: {
    screenSize: 'L',
    filter: 'all',
    isEmpty: false,
    isLoading: false,
  },
  argTypes: {
    screenSize: {
      control: { type: 'select' },
      options: ['XS', 'S', 'M', 'L', 'XL'],
      description: 'Device screen size',
    },
    filter: {
      control: { type: 'select' },
      options: ['all', 'btc', 'unit', 'vault'],
      description: 'Transaction filter',
    },
    isEmpty: {
      control: { type: 'boolean' },
      description: 'Show empty state',
    },
    isLoading: {
      control: { type: 'boolean' },
      description: 'Show loading skeleton',
    },
  },
};

export const Overview: StoryObj<OverviewProps> = {
  render: (args) => <TransactionHistoryOverview {...args} />,
  args: {
    filter: 'all',
    isEmpty: false,
    isLoading: false,
  },
  argTypes: {
    filter: {
      control: { type: 'select' },
      options: ['all', 'btc', 'unit', 'vault'],
      description: 'Transaction filter',
    },
    isEmpty: {
      control: { type: 'boolean' },
      description: 'Show empty state',
    },
    isLoading: {
      control: { type: 'boolean' },
      description: 'Show loading skeleton',
    },
  },
};

// =============================================================================
// STYLES
// =============================================================================

const styles = StyleSheet.create({
  // Story Container
  storyContainer: {
    flex: 1,
    backgroundColor: colors.bg.primary,
    padding: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Phone Frame
  phoneFrame: {
    backgroundColor: colors.bg.primary,
    borderRadius: phoneFrame.borderRadius,
    borderWidth: phoneFrame.borderWidth,
    borderColor: phoneFrame.borderColor,
    overflow: phoneFrame.overflow,
    height: phoneFrame.height,
  },

  // Screen Container
  screenContainer: {
    flex: 1,
    backgroundColor: colors.bg.primary,
  },

  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  accountBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.brand.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  accountNumber: {
    fontSize: fontSizes.md,
    fontWeight: fontWeights.bold,
    fontFamily: fonts.bold,
    color: colors.text.primary,
  },
  headerRight: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  headerButton: {
    padding: spacing.xs,
  },

  // Placeholder Content
  placeholderContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderText: {
    fontSize: fontSizes.md,
    fontFamily: fonts.regular,
    color: colors.text.secondary,
  },

  // Backdrop
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },

  // Bottom Sheet
  bottomSheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    top: 100,
    backgroundColor: colors.bg.secondary,
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
  },

  // Handle Area
  handleArea: {
    alignItems: 'center',
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  handle: {
    width: 36,
    height: 4,
    backgroundColor: colors.text.tertiary,
    borderRadius: 2,
  },

  // Header Area
  headerArea: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.default,
  },
  headerTitle: {
    fontSize: fontSizes.lg,
    fontWeight: fontWeights.semibold,
    fontFamily: fonts.medium,
    color: colors.text.primary,
    textAlign: 'center',
  },

  // Scroll View
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: spacing.md,
    paddingBottom: spacing.xxl,
  },

  // Section Title
  sectionTitle: {
    fontSize: fontSizes.xs,
    fontWeight: fontWeights.bold,
    fontFamily: fonts.bold,
    color: colors.text.secondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.sm,
  },

  // Empty State
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xxxl,
  },
  emptyText: {
    fontSize: fontSizes.md,
    fontFamily: fonts.regular,
    color: colors.text.secondary,
  },

  // Overview Container
  overviewContainer: {
    flex: 1,
    backgroundColor: '#0A0A0A',
  },
  overviewContent: {
    padding: spacing.lg,
    gap: spacing.xxl,
    alignItems: 'center',
  },

  // Device Row
  deviceRow: {
    alignItems: 'center',
  },

  // Device Label
  deviceLabel: {
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  deviceSize: {
    fontSize: fontSizes.xl,
    fontWeight: fontWeights.bold,
    fontFamily: fonts.bold,
    color: colors.text.primary,
  },
  deviceName: {
    fontSize: fontSizes.xs,
    fontFamily: fonts.regular,
    color: colors.text.secondary,
    marginTop: spacing.xs,
  },
  deviceWidth: {
    fontSize: 11,
    fontFamily: fonts.regular,
    color: colors.text.tertiary,
    marginTop: 2,
  },
});
