import React from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import type { Meta, StoryObj } from '@storybook/react';
import { COLORS, SPACING, BORDER_RADIUS } from '../../../theme';
import Icon from '../../../components/icons';

// Mock components for the wallet screen composition
const MockHeader = () => (
  <View style={styles.header}>
    <View style={styles.headerLeft}>
      <View style={styles.accountBadge}>
        <Text style={styles.accountNumber}>1</Text>
      </View>
    </View>
    <View style={styles.headerRight}>
      <TouchableOpacity style={styles.headerButton}>
        <Icon name="transaction_history" size={24} color={COLORS.WHITE} />
      </TouchableOpacity>
      <TouchableOpacity style={styles.headerButton}>
        <Icon name="qr_scan" size={24} color={COLORS.WHITE} />
      </TouchableOpacity>
      <TouchableOpacity style={styles.headerButton}>
        <Icon name="settings" size={24} color={COLORS.WHITE} />
      </TouchableOpacity>
    </View>
  </View>
);

const MockBalanceSection = ({ showInBTC = false }: { showInBTC?: boolean }) => (
  <View style={styles.balanceSection}>
    <Text style={styles.balanceLabel}>Total Balance</Text>
    <Text style={styles.balanceValue}>
      {showInBTC ? '0.12345678 BTC' : '$ 12,345.67'}
    </Text>
    <TouchableOpacity style={styles.toggleButton}>
      <Text style={styles.toggleText}>
        {showInBTC ? 'Show in USD' : 'Show in BTC'}
      </Text>
    </TouchableOpacity>
  </View>
);

const MockActionButtons = () => (
  <View style={styles.actionsRow}>
    <TouchableOpacity style={styles.actionButton}>
      <View style={styles.actionButtonIcon}>
        <Text style={styles.buttonIcon}>↓</Text>
      </View>
      <Text style={styles.actionButtonLabel}>Repay</Text>
    </TouchableOpacity>
    <TouchableOpacity style={styles.actionButton}>
      <View style={styles.actionButtonIcon}>
        <Text style={styles.buttonIcon}>+</Text>
      </View>
      <Text style={styles.actionButtonLabel}>Deposit</Text>
    </TouchableOpacity>
    <TouchableOpacity style={styles.actionButton}>
      <View style={styles.actionButtonIcon}>
        <Text style={styles.buttonIcon}>-</Text>
      </View>
      <Text style={styles.actionButtonLabel}>Withdraw</Text>
    </TouchableOpacity>
    <TouchableOpacity style={styles.actionButton}>
      <View style={styles.actionButtonIcon}>
        <Text style={styles.buttonIcon}>↑</Text>
      </View>
      <Text style={styles.actionButtonLabel}>Borrow</Text>
    </TouchableOpacity>
  </View>
);

const MockVaultCard = ({ hasVault = true }: { hasVault?: boolean }) => (
  <View style={styles.vaultCard}>
    <View style={styles.vaultHeader}>
      <View style={styles.vaultIconContainer}>
        <Icon name="vault_logo" size={36} color={COLORS.VERY_LIGHT_GRAY} />
        {hasVault && <View style={styles.healthIndicator} />}
      </View>
      <View style={styles.vaultContent}>
        <View style={styles.vaultTitleRow}>
          <Text style={styles.vaultTitle}>Vault</Text>
          {hasVault && <Text style={styles.healthPercent}>175%</Text>}
        </View>
        {hasVault && (
          <View style={styles.vaultDetails}>
            <View style={styles.vaultDetailRow}>
              <Text style={styles.vaultLabel}>Overall Debt</Text>
              <Text style={styles.vaultValue}>U 1,234.56</Text>
            </View>
            <View style={styles.vaultDetailRow}>
              <Text style={styles.vaultLabel}>Total collateral</Text>
              <Text style={styles.vaultValue}>B 0.05420000</Text>
            </View>
          </View>
        )}
      </View>
    </View>
    {!hasVault && (
      <View style={styles.createVaultOverlay}>
        <TouchableOpacity style={styles.createVaultButton}>
          <Text style={styles.createVaultText}>Create Vault</Text>
        </TouchableOpacity>
      </View>
    )}
  </View>
);

const MockAssetCard = ({
  name,
  icon,
  amount,
  value,
}: {
  name: string;
  icon: string;
  amount: string;
  value: string;
}) => (
  <TouchableOpacity style={styles.assetCard}>
    <View style={styles.assetLeft}>
      <View style={styles.assetIcon}>
        <Icon name={icon} size={36} />
      </View>
      <View style={styles.assetInfo}>
        <Text style={styles.assetName}>{name}</Text>
        <Text style={styles.assetAmount}>{amount}</Text>
      </View>
    </View>
    <Text style={styles.assetValue}>{value}</Text>
  </TouchableOpacity>
);

const WalletScreenDemo = () => (
  <View style={styles.screenContainer}>
    <MockHeader />
    <MockBalanceSection />
    <MockActionButtons />
    <View style={styles.divider} />
    <ScrollView style={styles.assetsList}>
      <MockVaultCard hasVault={true} />
      <MockAssetCard
        name="Bitcoin"
        icon="btc_logo"
        amount="0.05420000"
        value="$ 5,420.00"
      />
      <MockAssetCard
        name="UNIT"
        icon="unit_logo"
        amount="12,345.67"
        value="$ 12,345.67"
      />
    </ScrollView>
  </View>
);

const WalletScreenComponent = () => {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Wallet Screen</Text>
      <Text style={styles.subtitle}>Main wallet interface composition</Text>

      {/* Full Screen Demo */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Full Screen Preview</Text>
        <View style={styles.phoneFrame}>
          <WalletScreenDemo />
        </View>
      </View>

      {/* Screen Anatomy */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Screen Anatomy</Text>
        <View style={styles.anatomyList}>
          {[
            { label: 'WalletHeader', desc: 'Account badge + action icons' },
            { label: 'TotalBalanceSection', desc: 'Balance with BTC/USD toggle' },
            { label: 'Action Buttons', desc: 'Repay, Deposit, Withdraw, Borrow' },
            { label: 'VaultCard', desc: 'Vault health and stats' },
            { label: 'AssetCard (BTC)', desc: 'Bitcoin balance' },
            { label: 'AssetCard (UNIT)', desc: 'UNIT balance (Runes + Ecash)' },
          ].map((item, index) => (
            <View key={item.label} style={styles.anatomyItem}>
              <View style={styles.anatomyNumber}>
                <Text style={styles.anatomyNumberText}>{index + 1}</Text>
              </View>
              <View style={styles.anatomyContent}>
                <Text style={styles.anatomyLabel}>{item.label}</Text>
                <Text style={styles.anatomyDesc}>{item.desc}</Text>
              </View>
            </View>
          ))}
        </View>
      </View>

      {/* Component Hierarchy */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Component Hierarchy</Text>
        <View style={styles.hierarchyCard}>
          <Text style={styles.hierarchyRoot}>WalletPage</Text>
          <View style={styles.hierarchyChildren}>
            <Text style={styles.hierarchyChild}>WalletScreen</Text>
            <View style={styles.hierarchyGrandchildren}>
              <Text style={styles.hierarchyGrandchild}>WalletHeader</Text>
              <Text style={styles.hierarchyGrandchild}>TotalBalanceSection</Text>
              <Text style={styles.hierarchyGrandchild}>VaultCard</Text>
              <Text style={styles.hierarchyGrandchild}>AssetCard (x2)</Text>
            </View>
            <Text style={styles.hierarchyChild}>ReceiveScreen (sheet)</Text>
            <Text style={styles.hierarchyChild}>TransactionHistoryScreen (sheet)</Text>
            <Text style={styles.hierarchyChild}>WithdrawAssetSheet (sheet)</Text>
            <Text style={styles.hierarchyChild}>SettingsScreen (overlay)</Text>
          </View>
        </View>
      </View>

      {/* Key Features */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Key Features</Text>
        <View style={styles.featureList}>
          {[
            'Multi-account support with account switcher',
            'BTC/USD balance toggle',
            'Vault health status with color indicators',
            'Quick action buttons for common operations',
            'Scrollable asset list',
            'Bottom sheets for receive/send flows',
            'Settings overlay with swipe gesture',
            'Loading overlay during account switching',
          ].map((feature) => (
            <View key={feature} style={styles.featureItem}>
              <Icon name="done" size={16} color={COLORS.SUCCESS_GREEN} />
              <Text style={styles.featureText}>{feature}</Text>
            </View>
          ))}
        </View>
      </View>
    </ScrollView>
  );
};

const meta: Meta<typeof WalletScreenComponent> = {
  title: 'Screens/WalletScreen',
  component: WalletScreenComponent,
};

export default meta;

type Story = StoryObj<typeof WalletScreenComponent>;

export const Default: Story = {};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.DARK_BG,
  },
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: COLORS.WHITE,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: COLORS.SECONDARY_TEXT,
    marginBottom: 24,
  },
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.VERY_LIGHT_GRAY,
    marginBottom: 16,
  },
  phoneFrame: {
    backgroundColor: COLORS.DARK_BG,
    borderRadius: 24,
    borderWidth: 3,
    borderColor: COLORS.BORDER_COLOR,
    overflow: 'hidden',
    height: 600,
  },
  screenContainer: {
    flex: 1,
    backgroundColor: COLORS.DARK_BG,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  accountBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.PRIMARY_BLUE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  accountNumber: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.WHITE,
  },
  headerRight: {
    flexDirection: 'row',
    gap: 16,
  },
  headerButton: {
    padding: 4,
  },
  balanceSection: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  balanceLabel: {
    fontSize: 14,
    color: COLORS.SECONDARY_TEXT,
    marginBottom: 4,
  },
  balanceValue: {
    fontSize: 36,
    fontWeight: 'bold',
    color: COLORS.WHITE,
    marginBottom: 8,
  },
  toggleButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: COLORS.BG_SECONDARY,
    borderRadius: 16,
  },
  toggleText: {
    fontSize: 12,
    color: COLORS.SECONDARY_TEXT,
  },
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    paddingHorizontal: 20,
    paddingVertical: 8,
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
    backgroundColor: '#DDDDDD',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 2,
  },
  buttonIcon: {
    fontSize: 24,
    color: COLORS.DARK_BG,
    fontWeight: '200',
  },
  actionButtonLabel: {
    fontSize: 13,
    color: COLORS.WHITE,
    fontWeight: '600',
  },
  divider: {
    height: 1,
    backgroundColor: COLORS.BORDER_COLOR,
    marginHorizontal: 20,
    marginVertical: 8,
  },
  assetsList: {
    flex: 1,
    paddingHorizontal: 20,
  },
  vaultCard: {
    backgroundColor: COLORS.CARD_BG,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    marginBottom: 12,
    position: 'relative',
    overflow: 'hidden',
  },
  vaultHeader: {
    flexDirection: 'row',
  },
  vaultIconContainer: {
    width: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  healthIndicator: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: COLORS.SUCCESS_GREEN,
  },
  vaultContent: {
    flex: 1,
  },
  vaultTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  vaultTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.WHITE,
  },
  healthPercent: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.SUCCESS_GREEN,
  },
  vaultDetails: {
    gap: 2,
  },
  vaultDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  vaultLabel: {
    fontSize: 12,
    color: COLORS.SECONDARY_TEXT,
  },
  vaultValue: {
    fontSize: 12,
    color: COLORS.SECONDARY_TEXT,
  },
  createVaultOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.85)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  createVaultButton: {
    backgroundColor: COLORS.PRIMARY_BLUE,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  createVaultText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.WHITE,
  },
  assetCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.CARD_BG,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    marginBottom: 12,
  },
  assetLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  assetIcon: {
    marginRight: 12,
  },
  assetInfo: {},
  assetName: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.WHITE,
    marginBottom: 2,
  },
  assetAmount: {
    fontSize: 14,
    color: COLORS.SECONDARY_TEXT,
  },
  assetValue: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.SECONDARY_TEXT,
  },
  anatomyList: {
    gap: 12,
  },
  anatomyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.CARD_BG,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.sm,
  },
  anatomyNumber: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: COLORS.PRIMARY_BLUE,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  anatomyNumberText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: COLORS.WHITE,
  },
  anatomyContent: {
    flex: 1,
  },
  anatomyLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.WHITE,
    marginBottom: 2,
  },
  anatomyDesc: {
    fontSize: 12,
    color: COLORS.SECONDARY_TEXT,
  },
  hierarchyCard: {
    backgroundColor: COLORS.CARD_BG,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
  },
  hierarchyRoot: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.PRIMARY_BLUE,
    marginBottom: 8,
  },
  hierarchyChildren: {
    borderLeftWidth: 2,
    borderLeftColor: COLORS.BORDER_COLOR,
    paddingLeft: 16,
    marginLeft: 8,
  },
  hierarchyChild: {
    fontSize: 14,
    color: COLORS.VERY_LIGHT_GRAY,
    marginBottom: 8,
  },
  hierarchyGrandchildren: {
    borderLeftWidth: 2,
    borderLeftColor: COLORS.BORDER_COLOR,
    paddingLeft: 16,
    marginLeft: 8,
    marginBottom: 8,
  },
  hierarchyGrandchild: {
    fontSize: 13,
    color: COLORS.SECONDARY_TEXT,
    marginBottom: 4,
  },
  featureList: {
    backgroundColor: COLORS.CARD_BG,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  featureText: {
    fontSize: 14,
    color: COLORS.VERY_LIGHT_GRAY,
    marginLeft: 10,
  },
});
