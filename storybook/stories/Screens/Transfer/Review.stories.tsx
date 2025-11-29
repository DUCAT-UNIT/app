import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import type { Meta, StoryObj } from '@storybook/react';
import { COLORS } from '../../../../theme';
import Icon from '../../../../components/icons';

const DEVICE_CONFIGS = [
  { width: 320, size: 'XS', label: 'iPhone 5', scale: 0.75 },
  { width: 375, size: 'S', label: 'iPhone SE/8', scale: 0.85 },
  { width: 390, size: 'M', label: 'iPhone 12/13/14', scale: 0.95 },
  { width: 393, size: 'L', label: 'iPhone 14 Pro', scale: 1.0 },
  { width: 430, size: 'XL', label: 'iPhone 16 Pro Max', scale: 1.1 },
];

type ScreenSize = 'XS' | 'S' | 'M' | 'L' | 'XL';
type AssetType = 'BTC' | 'UNIT';

interface ReviewProps {
  screenSize: ScreenSize;
  assetType: AssetType;
  amount: number;
  recipientAddress: string;
  fee: number;
  showTurboWarning: boolean;
  showUnconfirmedWarning: boolean;
  hasDetailsExpanded: boolean;
}

const MockTransactionSummary = ({ assetType, amount, recipientAddress, scale }: any) => (
  <View style={[styles.summaryCard, { padding: 16 * scale, gap: 12 * scale }]}>
    <View style={styles.summaryRow}>
      <Text style={[styles.summaryLabel, { fontSize: 13 * scale }]}>To</Text>
      <Text style={[styles.summaryValue, { fontSize: 13 * scale }]} numberOfLines={1}>
        {`${recipientAddress.slice(0, 8)}...${recipientAddress.slice(-6)}`}
      </Text>
    </View>
    <View style={styles.summaryRow}>
      <Text style={[styles.summaryLabel, { fontSize: 13 * scale }]}>Amount</Text>
      <Text style={[styles.summaryAmountValue, { fontSize: 16 * scale }]}>
        {amount} {assetType}
      </Text>
    </View>
    <View style={styles.summaryRow}>
      <Text style={[styles.summaryLabel, { fontSize: 13 * scale }]}>USD Value</Text>
      <Text style={[styles.summaryValue, { fontSize: 13 * scale }]}>
        ≈ ${(amount * 100000).toFixed(2)}
      </Text>
    </View>
  </View>
);

const MockFeeBreakdown = ({ fee, scale }: any) => (
  <View style={[styles.feeCard, { padding: 16 * scale, gap: 10 * scale }]}>
    <View style={styles.feeRow}>
      <Text style={[styles.feeLabel, { fontSize: 13 * scale }]}>Network Fee</Text>
      <Text style={[styles.feeValue, { fontSize: 13 * scale }]}>{fee} sats</Text>
    </View>
    <View style={styles.feeRow}>
      <Text style={[styles.feeLabel, { fontSize: 13 * scale }]}>Fee Rate</Text>
      <Text style={[styles.feeValue, { fontSize: 13 * scale }]}>~10 sat/vB</Text>
    </View>
  </View>
);

const MockWarning = ({ message, scale }: any) => (
  <View style={[styles.warningCard, { padding: 12 * scale, gap: 6 * scale }]}>
    <View style={styles.warningHeader}>
      <Icon name="warning" size={16 * scale} color={COLORS.YELLOW} />
      <Text style={[styles.warningTitle, { fontSize: 13 * scale }]}>Warning</Text>
    </View>
    <Text style={[styles.warningText, { fontSize: 12 * scale }]}>{message}</Text>
  </View>
);

const MockDetailsSection = ({ isExpanded, scale }: any) => (
  <>
    {isExpanded && (
      <View style={[styles.detailsContent, { padding: 12 * scale, gap: 8 * scale }]}>
        <Text style={[styles.detailsSubheader, { fontSize: 12 * scale }]}>Inputs (2)</Text>
        <View style={[styles.utxoItem, { padding: 8 * scale }]}>
          <Text style={[styles.utxoLabel, { fontSize: 11 * scale }]}>UTXO 1</Text>
          <Text style={[styles.utxoValue, { fontSize: 11 * scale }]}>0.025 BTC</Text>
        </View>
        <View style={[styles.utxoItem, { padding: 8 * scale }]}>
          <Text style={[styles.utxoLabel, { fontSize: 11 * scale }]}>UTXO 2</Text>
          <Text style={[styles.utxoValue, { fontSize: 11 * scale }]}>0.03 BTC</Text>
        </View>

        <Text style={[styles.detailsSubheader, { fontSize: 12 * scale, marginTop: 8 * scale }]}>
          Outputs (2)
        </Text>
        <View style={[styles.utxoItem, { padding: 8 * scale }]}>
          <Text style={[styles.utxoLabel, { fontSize: 11 * scale }]}>Recipient</Text>
          <Text style={[styles.utxoValue, { fontSize: 11 * scale }]}>0.05 BTC</Text>
        </View>
        <View style={[styles.utxoItem, { padding: 8 * scale }]}>
          <Text style={[styles.utxoLabel, { fontSize: 11 * scale }]}>Change</Text>
          <Text style={[styles.utxoValue, { fontSize: 11 * scale }]}>0.004 BTC</Text>
        </View>
      </View>
    )}
  </>
);

const MockReviewScreen = ({
  screenSize,
  assetType,
  amount,
  recipientAddress,
  fee,
  showTurboWarning,
  showUnconfirmedWarning,
  hasDetailsExpanded,
}: ReviewProps) => {
  const deviceWidth = DEVICE_CONFIGS.find(d => d.size === screenSize)?.width || 393;
  const scale = DEVICE_CONFIGS.find(d => d.size === screenSize)?.scale || 1.0;

  const [isExpanded, setIsExpanded] = useState(hasDetailsExpanded);

  return (
    <View style={[styles.container, { width: deviceWidth }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: 60 * scale, paddingBottom: 20 * scale }]}>
        <TouchableOpacity style={[styles.backButton, { padding: 8 * scale, marginRight: 12 * scale }]}>
          <Icon name="back" size={20 * scale} color={COLORS.PRIMARY_BLUE} />
        </TouchableOpacity>
        <Text style={[styles.headerText, { fontSize: 18 * scale }]}>You will send</Text>
      </View>

      {/* Scrollable Content */}
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={[styles.content, { paddingHorizontal: 20 * scale }]}>
          {/* Transaction Summary */}
          <MockTransactionSummary
            assetType={assetType}
            amount={amount}
            recipientAddress={recipientAddress}
            scale={scale}
          />

          {/* Turbo Warning */}
          {showTurboWarning && (
            <MockWarning
              message="This is a Turbo transaction. Funds are sent as locked e-cash that can only be claimed by the recipient's pubkey."
              scale={scale}
            />
          )}

          {/* Unconfirmed Warning */}
          {showUnconfirmedWarning && (
            <MockWarning
              message="This transaction uses unconfirmed inputs. It may take longer to confirm."
              scale={scale}
            />
          )}

          {/* Fee Breakdown */}
          <MockFeeBreakdown fee={fee} scale={scale} />

          {/* Details Header */}
          <TouchableOpacity
            style={[styles.detailsHeaderCard, { padding: 16 * scale }]}
            onPress={() => setIsExpanded(!isExpanded)}
          >
            <Text style={[styles.detailsHeaderText, { fontSize: 16 * scale }]}>
              Transaction Details
            </Text>
            <Icon
              name={isExpanded ? 'chevron_up' : 'chevron_down'}
              size={20 * scale}
              color={COLORS.PRIMARY_BLUE}
            />
          </TouchableOpacity>

          {/* Details Content */}
          <MockDetailsSection isExpanded={isExpanded} scale={scale} />
        </View>
      </ScrollView>

      {/* Bottom Buttons */}
      <View style={[styles.buttonContainer, { paddingHorizontal: 20 * scale, paddingBottom: 20 * scale, gap: 12 * scale }]}>
        <TouchableOpacity
          style={[
            styles.cancelButton,
            { flex: 1, paddingVertical: 14 * scale, borderRadius: 10 * scale },
          ]}
        >
          <Text style={[styles.cancelButtonText, { fontSize: 15 * scale }]}>Cancel</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.confirmButton,
            { flex: 1, paddingVertical: 14 * scale, borderRadius: 10 * scale },
          ]}
        >
          <Text style={[styles.confirmButtonText, { fontSize: 15 * scale }]}>Confirm and Sign</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const ReviewStory = (args: ReviewProps) => {
  return (
    <View style={styles.storyContainer}>
      <View style={styles.phoneFrame}>
        <MockReviewScreen {...args} />
      </View>
    </View>
  );
};

const meta: Meta = {
  title: 'Screens/Transfer/Review',
};

export default meta;
type Story = StoryObj<typeof ReviewStory>;

export const Default: Story = {
  render: (args: ReviewProps) => <ReviewStory {...args} />,
  args: {
    screenSize: 'L',
    assetType: 'BTC',
    amount: 0.05,
    recipientAddress: 'tb1pexample1234567890abcdefghijklmnopqrstuvwxyz',
    fee: 1500,
    showTurboWarning: false,
    showUnconfirmedWarning: false,
    hasDetailsExpanded: false,
  },
  argTypes: {
    screenSize: {
      control: { type: 'select' },
      options: ['XS', 'S', 'M', 'L', 'XL'],
      description: 'Device screen size',
    },
    assetType: {
      control: { type: 'select' },
      options: ['BTC', 'UNIT'],
      description: 'Asset type being sent',
    },
    amount: {
      control: { type: 'number', step: 0.001 },
      description: 'Amount to send',
    },
    recipientAddress: {
      control: { type: 'text' },
      description: 'Recipient Bitcoin address',
    },
    fee: {
      control: { type: 'number' },
      description: 'Network fee in satoshis',
    },
    showTurboWarning: {
      control: { type: 'boolean' },
      description: 'Show Turbo transaction warning',
    },
    showUnconfirmedWarning: {
      control: { type: 'boolean' },
      description: 'Show unconfirmed inputs warning',
    },
    hasDetailsExpanded: {
      control: { type: 'boolean' },
      description: 'Start with details expanded',
    },
  },
};

export const BTCTransaction: Story = {
  ...Default,
  args: {
    ...Default.args,
    assetType: 'BTC',
    amount: 0.05,
  },
};

export const UNITTransaction: Story = {
  ...Default,
  args: {
    ...Default.args,
    assetType: 'UNIT',
    amount: 1250.5,
  },
};

export const TurboTransaction: Story = {
  ...Default,
  args: {
    ...Default.args,
    assetType: 'UNIT',
    amount: 50,
    showTurboWarning: true,
  },
};

export const UnconfirmedInputs: Story = {
  ...Default,
  args: {
    ...Default.args,
    showUnconfirmedWarning: true,
  },
};

export const DetailsExpanded: Story = {
  ...Default,
  args: {
    ...Default.args,
    hasDetailsExpanded: true,
  },
};

export const SmallDevice: Story = {
  ...Default,
  args: {
    ...Default.args,
    screenSize: 'XS',
  },
};

export const LargeDevice: Story = {
  ...Default,
  args: {
    ...Default.args,
    screenSize: 'XL',
  },
};

const styles = StyleSheet.create({
  storyContainer: {
    flex: 1,
    backgroundColor: COLORS.DARK_BG,
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  phoneFrame: {
    backgroundColor: COLORS.DARK_BG,
    borderRadius: 24,
    borderWidth: 3,
    borderColor: COLORS.BORDER_COLOR,
    overflow: 'hidden',
    height: 700,
  },
  container: {
    flex: 1,
    backgroundColor: COLORS.DARK_BG,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  backButton: {
    padding: 8,
    marginRight: 12,
  },
  headerText: {
    fontSize: 18,
    fontWeight: '500',
    color: COLORS.VERY_LIGHT_GRAY,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  summaryCard: {
    backgroundColor: COLORS.CARD_BG,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.BORDER_COLOR,
    gap: 12,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  summaryLabel: {
    fontSize: 13,
    color: COLORS.SECONDARY_TEXT,
  },
  summaryValue: {
    fontSize: 13,
    color: COLORS.VERY_LIGHT_GRAY,
    flex: 1,
    textAlign: 'right',
  },
  summaryAmountValue: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.WHITE,
  },
  feeCard: {
    backgroundColor: COLORS.CARD_BG,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.BORDER_COLOR,
    gap: 10,
  },
  feeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  feeLabel: {
    fontSize: 13,
    color: COLORS.SECONDARY_TEXT,
  },
  feeValue: {
    fontSize: 13,
    color: COLORS.VERY_LIGHT_GRAY,
  },
  warningCard: {
    backgroundColor: COLORS.CARD_BG,
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.YELLOW + '30',
    gap: 6,
  },
  warningHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  warningTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.YELLOW,
  },
  warningText: {
    fontSize: 12,
    color: COLORS.SECONDARY_TEXT,
    lineHeight: 18,
  },
  detailsHeaderCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: COLORS.CARD_BG,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.PRIMARY_BLUE + '30',
  },
  detailsHeaderText: {
    fontSize: 16,
    fontWeight: '500',
    color: COLORS.PRIMARY_BLUE,
  },
  detailsContent: {
    backgroundColor: COLORS.CARD_BG,
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.BORDER_COLOR,
    gap: 8,
  },
  detailsSubheader: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.VERY_LIGHT_GRAY,
    marginTop: 4,
  },
  utxoItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: COLORS.DARK_BG,
    borderRadius: 8,
    padding: 8,
  },
  utxoLabel: {
    fontSize: 11,
    color: COLORS.SECONDARY_TEXT,
  },
  utxoValue: {
    fontSize: 11,
    color: COLORS.VERY_LIGHT_GRAY,
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 20,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: COLORS.BORDER_COLOR,
    backgroundColor: 'transparent',
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 15,
    fontWeight: '500',
    color: COLORS.VERY_LIGHT_GRAY,
  },
  confirmButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    backgroundColor: COLORS.PRIMARY_BLUE,
    alignItems: 'center',
  },
  confirmButtonText: {
    fontSize: 15,
    fontWeight: '500',
    color: COLORS.VERY_LIGHT_GRAY,
  },
});
