import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity } from 'react-native';
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
type AssetType = 'btc' | 'unit';

interface AmountInputProps {
  screenSize: ScreenSize;
  assetType: AssetType;
  availableBalance: number;
  recipientAddress: string;
  addressType: 'Taproot' | 'Native SegWit';
  hasInsufficientBalance: boolean;
}

const formatNumberWithCommas = (num: string) => {
  if (!num) return '';
  const parts = num.split('.');
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return parts.join('.');
};

const MockAmountInputScreen = ({
  screenSize,
  assetType,
  availableBalance,
  recipientAddress,
  addressType,
  hasInsufficientBalance,
}: AmountInputProps) => {
  const deviceWidth = DEVICE_CONFIGS.find(d => d.size === screenSize)?.width || 393;
  const scale = DEVICE_CONFIGS.find(d => d.size === screenSize)?.scale || 1.0;

  const [amount, setAmount] = useState('');

  const handleAmountChange = (text: string) => {
    const cleaned = text.replace(/,/g, '');
    if (cleaned === '' || /^\d*\.?\d*$/.test(cleaned)) {
      setAmount(cleaned);
    }
  };

  const handleMaxPress = () => {
    setAmount(availableBalance.toString());
  };

  const usdValue = (parseFloat(amount || '0') * 100000).toFixed(2);
  const assetLabel = assetType === 'btc' ? 'BTC' : 'UNIT';
  const truncatedAddress = `${recipientAddress.slice(0, 12)}...${recipientAddress.slice(-8)}`;

  const enteredAmount = parseFloat(amount) || 0;
  const exceedsBalance = amount && enteredAmount > availableBalance;
  const insufficientBalance = hasInsufficientBalance || exceedsBalance;
  const isReviewDisabled = !amount || insufficientBalance;

  // Dynamic font sizing
  const displayAmount = formatNumberWithCommas(amount);
  let fontSize = 54 * scale;
  if (displayAmount.length > 8) fontSize = 40 * scale;
  if (displayAmount.length > 12) fontSize = 32 * scale;
  if (displayAmount.length > 15) fontSize = 24 * scale;

  return (
    <View style={[styles.container, { width: deviceWidth }]}>
      {/* Recipient Header */}
      <View style={[styles.recipientHeader, { paddingTop: 60 * scale, paddingBottom: 20 * scale }]}>
        <View style={styles.recipientTop}>
          <TouchableOpacity style={[styles.backButton, { padding: 8 * scale }]}>
            <Icon name="back" size={24 * scale} color={COLORS.VERY_LIGHT_GRAY} />
          </TouchableOpacity>
          <View style={styles.recipientInfo}>
            <Text style={[styles.recipientLabel, { fontSize: 12 * scale }]}>Sending to</Text>
            <Text style={[styles.recipientAddress, { fontSize: 14 * scale }]} numberOfLines={1}>
              {truncatedAddress}
            </Text>
          </View>
        </View>
        <View style={[styles.addressTypeBadge, { paddingHorizontal: 8 * scale, paddingVertical: 4 * scale }]}>
          <Text style={[styles.addressTypeText, { fontSize: 11 * scale }]}>{addressType}</Text>
        </View>
      </View>

      {/* Content */}
      <View style={styles.content}>
        {/* Balance and MAX button */}
        <View style={[styles.balanceRow, { marginBottom: 16 * scale }]}>
          <Text style={[styles.balanceLabel, { fontSize: 13 * scale }]}>
            Available: {availableBalance} {assetLabel}
          </Text>
          <TouchableOpacity
            style={[styles.maxButton, { paddingVertical: 6 * scale, paddingHorizontal: 12 * scale }]}
            onPress={handleMaxPress}
          >
            <Text style={[styles.maxButtonText, { fontSize: 12 * scale }]}>MAX</Text>
          </TouchableOpacity>
        </View>

        {/* Warning */}
        {insufficientBalance && (
          <View style={[styles.warningContainer, { padding: 10 * scale, marginBottom: 12 * scale, gap: 6 * scale }]}>
            <Icon name="warning" size={16 * scale} color={COLORS.DANGER_RED} />
            <Text style={[styles.warningText, { fontSize: 12 * scale }]}>
              {hasInsufficientBalance ? 'No available UNIT balance to send' : 'Insufficient balance'}
            </Text>
          </View>
        )}

        {/* Amount Input */}
        <View style={[styles.amountInputRow, { marginBottom: 8 * scale }]}>
          <TextInput
            style={[styles.amountInput, { fontSize }]}
            value={formatNumberWithCommas(amount)}
            onChangeText={handleAmountChange}
            placeholder="0"
            placeholderTextColor={COLORS.MID_DARK_GRAY}
            keyboardType="decimal-pad"
          />
          <Icon
            name={assetType === 'btc' ? 'btc_symbol' : 'unit_symbol'}
            size={32 * scale}
            color={COLORS.VERY_LIGHT_GRAY}
          />
        </View>

        {/* USD Value */}
        <Text style={[styles.usdValue, { fontSize: 16 * scale }]}>≈ ${usdValue} USD</Text>
      </View>

      {/* Review Button */}
      <View style={[styles.buttonContainer, { paddingBottom: 20 * scale }]}>
        <TouchableOpacity
          style={[
            styles.reviewButton,
            { paddingVertical: 14 * scale, borderRadius: 10 * scale },
            isReviewDisabled && styles.reviewButtonDisabled,
          ]}
        >
          <Text style={[styles.reviewButtonText, { fontSize: 15 * scale }]}>Review</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const AmountInputStory = (args: AmountInputProps) => {
  return (
    <View style={styles.storyContainer}>
      <View style={styles.phoneFrame}>
        <MockAmountInputScreen {...args} />
      </View>
    </View>
  );
};

const meta: Meta = {
  title: 'Screens/Transfer/Amount',
};

export default meta;
type Story = StoryObj<typeof AmountInputStory>;

export const Default: Story = {
  render: (args: AmountInputProps) => <AmountInputStory {...args} />,
  args: {
    screenSize: 'L',
    assetType: 'btc',
    availableBalance: 0.05,
    recipientAddress: 'tb1pexample1234567890abcdefghijklmnopqrstuvwxyz',
    addressType: 'Taproot',
    hasInsufficientBalance: false,
  },
  argTypes: {
    screenSize: {
      control: { type: 'select' },
      options: ['XS', 'S', 'M', 'L', 'XL'],
      description: 'Device screen size',
    },
    assetType: {
      control: { type: 'select' },
      options: ['btc', 'unit'],
      description: 'Asset type being sent',
    },
    availableBalance: {
      control: { type: 'number', step: 0.001 },
      description: 'Available balance to send',
    },
    recipientAddress: {
      control: { type: 'text' },
      description: 'Recipient Bitcoin address',
    },
    addressType: {
      control: { type: 'select' },
      options: ['Taproot', 'Native SegWit'],
      description: 'Address type',
    },
    hasInsufficientBalance: {
      control: { type: 'boolean' },
      description: 'Show insufficient balance warning',
    },
  },
};

export const BTCAmount: Story = {
  ...Default,
  args: {
    ...Default.args,
    assetType: 'btc',
    availableBalance: 0.05,
  },
};

export const UNITAmount: Story = {
  ...Default,
  args: {
    ...Default.args,
    assetType: 'unit',
    availableBalance: 1250.5,
  },
};

export const InsufficientBalance: Story = {
  ...Default,
  args: {
    ...Default.args,
    hasInsufficientBalance: true,
    availableBalance: 0,
  },
};

export const SegWitAddress: Story = {
  ...Default,
  args: {
    ...Default.args,
    recipientAddress: 'tb1qexample1234567890abcdefghijk',
    addressType: 'Native SegWit',
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
  recipientHeader: {
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
    gap: 12,
  },
  recipientTop: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButton: {
    padding: 8,
    marginRight: 12,
  },
  recipientInfo: {
    flex: 1,
  },
  recipientLabel: {
    fontSize: 12,
    color: COLORS.SECONDARY_TEXT,
    marginBottom: 2,
  },
  recipientAddress: {
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.VERY_LIGHT_GRAY,
  },
  addressTypeBadge: {
    alignSelf: 'flex-start',
    backgroundColor: COLORS.CARD_BG,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: COLORS.PRIMARY_BLUE + '30',
  },
  addressTypeText: {
    fontSize: 11,
    fontWeight: '500',
    color: COLORS.PRIMARY_BLUE,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    justifyContent: 'center',
  },
  balanceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  balanceLabel: {
    fontSize: 13,
    color: COLORS.SECONDARY_TEXT,
  },
  maxButton: {
    backgroundColor: COLORS.PRIMARY_BLUE,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
  },
  maxButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.WHITE,
  },
  warningContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.CARD_BG,
    borderRadius: 8,
    padding: 10,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.DANGER_RED + '30',
    gap: 6,
  },
  warningText: {
    fontSize: 12,
    color: COLORS.DANGER_RED,
    flex: 1,
  },
  amountInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 8,
  },
  amountInput: {
    color: COLORS.WHITE,
    fontWeight: '600',
    textAlign: 'right',
  },
  usdValue: {
    fontSize: 16,
    color: COLORS.SECONDARY_TEXT,
    textAlign: 'center',
  },
  buttonContainer: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  reviewButton: {
    backgroundColor: COLORS.PRIMARY_BLUE,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  reviewButtonDisabled: {
    backgroundColor: COLORS.MID_DARK_GRAY,
  },
  reviewButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.WHITE,
  },
});
