import React, { useState } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import type { Meta, StoryObj } from '@storybook/react';
import { COLORS } from '../../../theme';
import BottomSheet from '../../../components/common/BottomSheet';
import Icon from '../../../components/icons';

// ============================================================================
// DEVICE SIZE CONFIG
// ============================================================================
const DEVICE_CONFIGS = [
  { width: 320, size: 'XS', label: 'iPhone 5', scale: 0.8 },
  { width: 375, size: 'S', label: 'iPhone SE/8', scale: 0.9 },
  { width: 390, size: 'M', label: 'iPhone 12/13/14', scale: 0.95 },
  { width: 393, size: 'L', label: 'iPhone 14 Pro', scale: 1.0 },
  { width: 430, size: 'XL', label: 'iPhone 16 Pro Max', scale: 1.0 },
];

type DeviceSize = 'XS' | 'S' | 'M' | 'L' | 'XL';
type SheetType = 'asset_select' | 'settings' | 'decision' | 'info' | 'vault_deposit' | 'vault_open' | 'vault_repossess';

// ============================================================================
// SHEET CONTENT COMPONENTS (matching real app usage)
// ============================================================================

// Asset Selection Sheet (like WithdrawAssetSheet)
const AssetSelectContent = ({ scale = 1 }: { scale?: number }) => (
  <View style={[sheetStyles.content, { paddingHorizontal: 20 * scale }]}>
    {[
      { name: 'Bitcoin', symbol: 'BTC', balance: '0.00125000', usd: '$125.00', icon: 'btc_logo' },
      { name: 'Unit Rune', symbol: 'UNIT', balance: '2,500.00', usd: '$2,500.00', icon: 'unit_logo' },
    ].map((asset) => (
      <TouchableOpacity key={asset.symbol} style={[sheetStyles.assetCard, { padding: 16 * scale, borderRadius: 12 * scale, marginBottom: 12 * scale }]}>
        <Icon name={asset.icon} size={40 * scale} />
        <View style={[sheetStyles.assetInfo, { marginLeft: 16 * scale }]}>
          <Text style={[sheetStyles.assetName, { fontSize: 16 * scale }]}>{asset.name}</Text>
          <Text style={[sheetStyles.assetSymbol, { fontSize: 13 * scale }]}>{asset.symbol}</Text>
        </View>
        <View style={sheetStyles.assetBalance}>
          <Text style={[sheetStyles.balanceAmount, { fontSize: 16 * scale }]}>{asset.balance}</Text>
          <Text style={[sheetStyles.balanceUsd, { fontSize: 13 * scale }]}>{asset.usd}</Text>
        </View>
        <Icon name="arrow_right" size={20 * scale} color={COLORS.SECONDARY_TEXT} />
      </TouchableOpacity>
    ))}
  </View>
);

// Settings Selection Sheet (like EcashThresholdSheet)
const SettingsSelectContent = ({ scale = 1 }: { scale?: number }) => {
  const [selected, setSelected] = useState(500);
  const options = [
    { value: 100, label: '100' },
    { value: 500, label: '500' },
    { value: 1000, label: '1000' },
    { value: Infinity, label: 'All transfers' },
  ];

  return (
    <View style={[sheetStyles.content, { paddingHorizontal: 20 * scale }]}>
      <Text style={[sheetStyles.description, { fontSize: 14 * scale, marginBottom: 24 * scale }]}>
        Transactions below this threshold will automatically use ecash for faster, private payments.
      </Text>
      <View style={{ gap: 12 * scale }}>
        {options.map((option) => (
          <TouchableOpacity
            key={option.value}
            style={[
              sheetStyles.optionCard,
              { padding: 16 * scale, borderRadius: 12 * scale },
              selected === option.value && sheetStyles.optionSelected,
            ]}
            onPress={() => setSelected(option.value)}
          >
            <View style={sheetStyles.optionLeft}>
              {option.value !== Infinity && <Icon name="unit_logo" size={24 * scale} color={COLORS.WHITE} />}
              <Text style={[sheetStyles.optionLabel, { fontSize: 16 * scale, marginLeft: option.value !== Infinity ? 12 * scale : 0 }]}>
                {option.label}
              </Text>
            </View>
            {selected === option.value && <Icon name="check" size={20 * scale} color={COLORS.PRIMARY_BLUE} />}
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
};

// Decision Sheet (like InsufficientTurboSheet)
const DecisionContent = ({ scale = 1 }: { scale?: number }) => (
  <View style={[sheetStyles.content, { paddingHorizontal: 20 * scale }]}>
    <View style={[sheetStyles.infoBox, { padding: 16 * scale, borderRadius: 12 * scale, marginBottom: 20 * scale }]}>
      <View style={sheetStyles.infoRow}>
        <Text style={[sheetStyles.infoLabel, { fontSize: 14 * scale }]}>Required:</Text>
        <Text style={[sheetStyles.infoValue, { fontSize: 14 * scale }]}>500.00 UNIT</Text>
      </View>
      <View style={sheetStyles.infoRow}>
        <Text style={[sheetStyles.infoLabel, { fontSize: 14 * scale }]}>Your Balance:</Text>
        <Text style={[sheetStyles.infoValue, { fontSize: 14 * scale }]}>125.00 UNIT</Text>
      </View>
    </View>
    <Text style={[sheetStyles.description, { fontSize: 15 * scale, marginBottom: 20 * scale }]}>
      You don't have enough balance. Choose how to proceed:
    </Text>
    {[
      { icon: 'unit_logo', title: 'Use Turbo', desc: 'Private & instant after confirmation', badge: 'Private', primary: true },
      { icon: 'btc_logo', title: 'Send Normally', desc: 'Standard on-chain transaction', badge: 'On-Chain', primary: false },
    ].map((option) => (
      <TouchableOpacity key={option.title} style={[sheetStyles.decisionCard, { padding: 16 * scale, borderRadius: 12 * scale, marginBottom: 12 * scale }]}>
        <View style={sheetStyles.decisionHeader}>
          <Icon name={option.icon} size={24 * scale} color={option.primary ? COLORS.PRIMARY_BLUE : COLORS.SECONDARY_TEXT} />
          <Text style={[sheetStyles.decisionTitle, { fontSize: 17 * scale, marginLeft: 12 * scale }]}>{option.title}</Text>
        </View>
        <Text style={[sheetStyles.decisionDesc, { fontSize: 14 * scale, marginBottom: 12 * scale }]}>{option.desc}</Text>
        <View style={[sheetStyles.badge, { paddingHorizontal: 10 * scale, paddingVertical: 4 * scale, borderRadius: 6 * scale }, !option.primary && sheetStyles.badgeSecondary]}>
          <Text style={[sheetStyles.badgeText, { fontSize: 12 * scale }]}>{option.badge}</Text>
        </View>
      </TouchableOpacity>
    ))}
  </View>
);

// Info Sheet (like TokenDetailsSheet)
const InfoContent = ({ scale = 1 }: { scale?: number }) => (
  <View style={[sheetStyles.content, { paddingHorizontal: 20 * scale }]}>
    <View style={[sheetStyles.tokenHeader, { marginBottom: 24 * scale, paddingBottom: 16 * scale }]}>
      <Icon name="unit_logo" size={24 * scale} color={COLORS.PRIMARY_BLUE} />
      <View style={{ marginLeft: 12 * scale, flex: 1 }}>
        <Text style={[sheetStyles.tokenTitle, { fontSize: 20 * scale }]}>Ecash Token</Text>
        <Text style={[sheetStyles.tokenSubtitle, { fontSize: 14 * scale }]}>Anyone can claim</Text>
      </View>
    </View>
    <Text style={[sheetStyles.sectionLabel, { fontSize: 12 * scale, marginBottom: 8 * scale }]}>SHORTENED URL</Text>
    <View style={[sheetStyles.urlCard, { padding: 16 * scale, borderRadius: 12 * scale, marginBottom: 24 * scale }]}>
      <Text style={[sheetStyles.urlText, { fontSize: 14 * scale }]} numberOfLines={1}>https://ducat.link/abc123</Text>
      <View style={sheetStyles.urlActions}>
        <TouchableOpacity style={{ padding: 8 * scale }}><Icon name="share" size={20 * scale} color={COLORS.PRIMARY_BLUE} /></TouchableOpacity>
        <TouchableOpacity style={{ padding: 8 * scale }}><Icon name="copy" size={20 * scale} color={COLORS.PRIMARY_BLUE} /></TouchableOpacity>
      </View>
    </View>
    <View style={[sheetStyles.tipBox, { padding: 12 * scale, borderRadius: 8 * scale }]}>
      <Icon name="info" size={16 * scale} color={COLORS.SECONDARY_TEXT} />
      <Text style={[sheetStyles.tipText, { fontSize: 13 * scale, marginLeft: 8 * scale }]}>
        Share this token to send ecash. The recipient can claim it by opening the link.
      </Text>
    </View>
  </View>
);

// Vault Action Sheet (like VaultTransactionDetailsSheet)
interface VaultActionProps {
  scale?: number;
  action: 'Deposit' | 'Open' | 'Repossess';
}

const VAULT_ACTION_DATA = {
  Deposit: {
    title: 'Deposit BTC',
    summary: 'Deposited 0.25000000 BTC',
    borderColor: COLORS.GREEN,
    changes: [
      { label: 'Collateral', before: '0.50000000', after: '0.75000000', icon: 'btc_symbol', color: COLORS.GREEN },
      { label: 'Total Debt', before: '25,000', after: '25,000', icon: 'unit_symbol', color: COLORS.WHITE },
      { label: 'Health Ratio', before: '180%', after: '245%', beforeColor: '#fde37b', afterColor: COLORS.GREEN },
      { label: 'Liquidation Price', before: '$52,500', after: '$45,000', color: COLORS.GREEN },
    ],
  },
  Open: {
    title: 'Open Vault',
    summary: 'Opened vault with 0.50000000 BTC',
    borderColor: COLORS.GREEN,
    changes: [
      { label: 'Collateral', before: '—', after: '0.50000000', icon: 'btc_symbol', color: COLORS.GREEN },
      { label: 'Total Debt', before: '—', after: '0', icon: 'unit_symbol', color: COLORS.WHITE },
      { label: 'Health Ratio', before: '—', after: '∞', beforeColor: COLORS.SECONDARY_TEXT, afterColor: COLORS.GREEN },
      { label: 'Liquidation Price', before: '—', after: 'N/A', color: COLORS.WHITE },
    ],
  },
  Repossess: {
    title: 'Vault Liquidated',
    summary: 'Collateral repossessed due to low health ratio',
    borderColor: COLORS.RED,
    changes: [
      { label: 'Collateral', before: '0.50000000', after: '0.00000000', icon: 'btc_symbol', beforeColor: COLORS.WHITE, afterColor: COLORS.RED },
      { label: 'Total Debt', before: '35,000', after: '0', icon: 'unit_symbol', color: COLORS.WHITE },
      { label: 'Health Ratio', before: '98%', after: '—', beforeColor: COLORS.RED, afterColor: COLORS.SECONDARY_TEXT },
      { label: 'Liquidation Price', before: '$70,000', after: '—', beforeColor: COLORS.RED, afterColor: COLORS.SECONDARY_TEXT },
    ],
  },
};

const VaultActionContent = ({ scale = 1, action = 'Deposit' }: VaultActionProps) => {
  const data = VAULT_ACTION_DATA[action];

  return (
    <View style={[sheetStyles.content, { paddingHorizontal: 20 * scale }]}>
      {/* Header */}
      <View style={[sheetStyles.vaultHeader, { marginBottom: 20 * scale, paddingBottom: 16 * scale }]}>
        <Icon name="vault_logo" size={28 * scale} color="#DDDDDD" />
        <View style={{ marginLeft: 12 * scale, flex: 1 }}>
          <Text style={[sheetStyles.tokenTitle, { fontSize: 20 * scale }]}>{data.title}</Text>
          <Text style={[sheetStyles.tokenSubtitle, { fontSize: 14 * scale }]}>Wed, Nov 27, 2024, 3:45 PM</Text>
        </View>
      </View>

      {/* Summary Card */}
      <View style={[sheetStyles.summaryCard, { padding: 16 * scale, borderRadius: 12 * scale, marginBottom: 24 * scale, borderColor: data.borderColor }]}>
        <Text style={[sheetStyles.summaryText, { fontSize: 16 * scale }]}>{data.summary}</Text>
        <Text style={[sheetStyles.oracleText, { fontSize: 14 * scale }]}>Oracle Price: $97,500.00</Text>
      </View>

      {/* Changes Section */}
      <Text style={[sheetStyles.sectionLabel, { fontSize: 12 * scale, marginBottom: 16 * scale }]}>VAULT CHANGES</Text>
      {data.changes.map((change, index) => (
        <View key={change.label} style={[sheetStyles.changeRow, { paddingVertical: 12 * scale, borderBottomWidth: index < data.changes.length - 1 ? 1 : 0 }]}>
          <Text style={[sheetStyles.changeLabel, { fontSize: 14 * scale }]}>{change.label}</Text>
          <View style={sheetStyles.changeValues}>
            <View style={sheetStyles.valueRow}>
              {change.icon && <Icon name={change.icon} size={12 * scale} color={change.beforeColor || COLORS.SECONDARY_TEXT} />}
              <Text style={[sheetStyles.beforeValue, { fontSize: 14 * scale, color: change.beforeColor || COLORS.SECONDARY_TEXT }]}>{change.before}</Text>
            </View>
            <Text style={[sheetStyles.arrow, { fontSize: 14 * scale }]}>→</Text>
            <View style={sheetStyles.valueRow}>
              {change.icon && <Icon name={change.icon} size={12 * scale} color={change.afterColor || change.color || COLORS.WHITE} />}
              <Text style={[sheetStyles.afterValue, { fontSize: 14 * scale, color: change.afterColor || change.color || COLORS.WHITE }]}>{change.after}</Text>
            </View>
          </View>
        </View>
      ))}
    </View>
  );
};

// ============================================================================
// SHEET TYPE CONFIG
// ============================================================================
const SHEET_CONFIG: Record<SheetType, { title: string; Content: React.FC<{ scale?: number }> }> = {
  asset_select: { title: 'Withdraw', Content: AssetSelectContent },
  settings: { title: 'Ecash Default', Content: SettingsSelectContent },
  decision: { title: 'Insufficient Balance', Content: DecisionContent },
  info: { title: '', Content: InfoContent },
  vault_deposit: { title: '', Content: (props) => <VaultActionContent {...props} action="Deposit" /> },
  vault_open: { title: '', Content: (props) => <VaultActionContent {...props} action="Open" /> },
  vault_repossess: { title: '', Content: (props) => <VaultActionContent {...props} action="Repossess" /> },
};

// ============================================================================
// CONFIGURABLE STORY
// ============================================================================
interface ConfigurableProps {
  sheetType: SheetType;
  deviceSize: DeviceSize;
}

const ConfigurableStory = ({ sheetType, deviceSize }: ConfigurableProps) => {
  const [visible, setVisible] = useState(true);
  const config = DEVICE_CONFIGS.find(d => d.size === deviceSize) || DEVICE_CONFIGS[3];
  const sheetConfig = SHEET_CONFIG[sheetType];
  const Content = sheetConfig.Content;

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.openButton} onPress={() => setVisible(true)}>
        <Text style={styles.openButtonText}>Open Sheet</Text>
      </TouchableOpacity>
      <BottomSheet
        visible={visible}
        onClose={() => setVisible(false)}
        title={sheetConfig.title}
      >
        <Content scale={config.scale} />
      </BottomSheet>
    </View>
  );
};

// ============================================================================
// ALL TYPES STORY
// ============================================================================
const AllTypesStory = () => (
  <ScrollView contentContainerStyle={styles.scrollContent}>
    {(Object.keys(SHEET_CONFIG) as SheetType[]).map((type) => {
      const config = SHEET_CONFIG[type];
      const Content = config.Content;
      return (
        <View key={type} style={styles.typeSection}>
          <View style={styles.typeHeader}>
            <View style={[styles.typeDot, { backgroundColor: COLORS.PRIMARY_BLUE }]} />
            <Text style={styles.typeLabel}>{type.replace('_', ' ').toUpperCase()}</Text>
          </View>
          <View style={[styles.sheetPreview, { width: 320 }]}>
            <View style={styles.handle} />
            {config.title && <Text style={styles.previewTitle}>{config.title}</Text>}
            <Content scale={0.85} />
          </View>
        </View>
      );
    })}
  </ScrollView>
);

// ============================================================================
// STORYBOOK META
// ============================================================================
const meta: Meta = {
  title: 'Patterns/BottomSheet',
};

export default meta;
type Story = StoryObj;

export const BottomSheetDemo: Story = {
  render: (args: ConfigurableProps) => <ConfigurableStory {...args} />,
  args: {
    sheetType: 'asset_select',
    deviceSize: 'L',
  },
  argTypes: {
    sheetType: {
      control: { type: 'select' },
      options: ['asset_select', 'settings', 'decision', 'info', 'vault_deposit', 'vault_open', 'vault_repossess'],
      description: 'Sheet content type',
    },
    deviceSize: {
      control: { type: 'select' },
      options: ['XS', 'S', 'M', 'L', 'XL'],
      description: 'Device size',
    },
  },
};

export const AllTypes: Story = {
  render: () => <AllTypesStory />,
};

// ============================================================================
// STYLES
// ============================================================================
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.DARK_BG,
    alignItems: 'center',
    justifyContent: 'center',
  },
  openButton: {
    backgroundColor: COLORS.PRIMARY_BLUE,
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 12,
  },
  openButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.WHITE,
  },
  scrollContent: {
    backgroundColor: COLORS.DARK_BG,
    padding: 20,
    gap: 32,
    alignItems: 'center',
  },
  typeSection: {
    gap: 12,
    alignItems: 'center',
  },
  typeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  typeDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  typeLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.SECONDARY_TEXT,
    letterSpacing: 1,
  },
  sheetPreview: {
    backgroundColor: COLORS.DARK_BG,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.VERY_DARK_GRAY,
    paddingBottom: 24,
  },
  handle: {
    width: 40,
    height: 5,
    backgroundColor: COLORS.MEDIUM_GRAY,
    borderRadius: 3,
    alignSelf: 'center',
    marginTop: 16,
    marginBottom: 16,
  },
  previewTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.WHITE,
    paddingHorizontal: 20,
    marginBottom: 16,
  },
});

const sheetStyles = StyleSheet.create({
  content: {},
  description: {
    color: COLORS.SECONDARY_TEXT,
    lineHeight: 20,
  },
  // Asset Select
  assetCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.CARD_BG,
    borderWidth: 1,
    borderColor: COLORS.BORDER_COLOR,
  },
  assetInfo: {
    flex: 1,
  },
  assetName: {
    fontWeight: '600',
    color: COLORS.WHITE,
  },
  assetSymbol: {
    color: COLORS.SECONDARY_TEXT,
    marginTop: 2,
  },
  assetBalance: {
    alignItems: 'flex-end',
    marginRight: 12,
  },
  balanceAmount: {
    fontWeight: '600',
    color: COLORS.WHITE,
  },
  balanceUsd: {
    color: COLORS.SECONDARY_TEXT,
    marginTop: 2,
  },
  // Settings Select
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.CARD_BG,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  optionSelected: {
    borderColor: COLORS.PRIMARY_BLUE,
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
  },
  optionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  optionLabel: {
    fontWeight: '600',
    color: COLORS.WHITE,
  },
  // Decision
  infoBox: {
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  infoLabel: {
    color: COLORS.SECONDARY_TEXT,
  },
  infoValue: {
    color: COLORS.WHITE,
    fontWeight: '600',
  },
  decisionCard: {
    backgroundColor: COLORS.CARD_BG,
    borderWidth: 1,
    borderColor: COLORS.BORDER_COLOR,
  },
  decisionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  decisionTitle: {
    fontWeight: '600',
    color: COLORS.WHITE,
  },
  decisionDesc: {
    color: COLORS.SECONDARY_TEXT,
    lineHeight: 20,
  },
  badge: {
    backgroundColor: COLORS.PRIMARY_BLUE,
    alignSelf: 'flex-start',
  },
  badgeSecondary: {
    backgroundColor: COLORS.MID_DARK_GRAY,
  },
  badgeText: {
    fontWeight: '600',
    color: COLORS.WHITE,
  },
  // Info
  tokenHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.BORDER_COLOR,
  },
  tokenTitle: {
    fontWeight: 'bold',
    color: COLORS.WHITE,
  },
  tokenSubtitle: {
    color: COLORS.SECONDARY_TEXT,
    marginTop: 4,
  },
  sectionLabel: {
    color: COLORS.SECONDARY_TEXT,
    textTransform: 'uppercase',
  },
  urlCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.CARD_BG,
    borderWidth: 1,
    borderColor: COLORS.BORDER_COLOR,
  },
  urlText: {
    color: COLORS.WHITE,
    flex: 1,
  },
  urlActions: {
    flexDirection: 'row',
    gap: 4,
  },
  tipBox: {
    flexDirection: 'row',
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
  },
  tipText: {
    color: COLORS.SECONDARY_TEXT,
    flex: 1,
    lineHeight: 18,
  },
  // Vault Action
  vaultHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.BORDER_COLOR,
  },
  summaryCard: {
    backgroundColor: COLORS.CARD_BG,
    borderWidth: 1,
    borderColor: COLORS.GREEN,
  },
  summaryText: {
    fontWeight: '600',
    color: COLORS.WHITE,
    marginBottom: 8,
  },
  oracleText: {
    color: COLORS.SECONDARY_TEXT,
  },
  changeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomColor: COLORS.VERY_DARK_GRAY,
  },
  changeLabel: {
    color: COLORS.SECONDARY_TEXT,
    flex: 1,
  },
  changeValues: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 2,
    justifyContent: 'flex-end',
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  beforeValue: {
    fontWeight: '500',
  },
  arrow: {
    color: COLORS.SECONDARY_TEXT,
    marginHorizontal: 8,
  },
  afterValue: {
    fontWeight: '600',
  },
});
