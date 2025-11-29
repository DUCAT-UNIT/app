import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
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
type ConfirmationState = 'success' | 'turbo' | 'converting';

interface ConfirmationProps {
  screenSize: ScreenSize;
  state: ConfirmationState;
  txid: string;
  turboDeeplink: string;
}

const MockConfirmationScreen = ({ screenSize, state, txid, turboDeeplink }: ConfirmationProps) => {
  const deviceWidth = DEVICE_CONFIGS.find(d => d.size === screenSize)?.width || 393;
  const scale = DEVICE_CONFIGS.find(d => d.size === screenSize)?.scale || 1.0;

  const shortDeeplink = turboDeeplink.length > 40
    ? `${turboDeeplink.slice(0, 40)}...`
    : turboDeeplink;

  return (
    <View style={[styles.container, { width: deviceWidth }]}>
      {/* Content */}
      <View style={styles.content}>
        {/* Converting State */}
        {state === 'converting' && (
          <>
            <ActivityIndicator
              size="large"
              color={COLORS.PRIMARY_BLUE}
              style={{ marginBottom: 24 * scale }}
            />
            <Text style={[styles.processingTitle, { fontSize: 18 * scale }]}>
              Converting to TurboUNIT
            </Text>
            <Text style={[styles.processingMessage, { fontSize: 14 * scale }]}>
              Minting e-cash tokens and creating P2PK locked token...
            </Text>
          </>
        )}

        {/* Success State */}
        {state === 'success' && (
          <>
            <View style={[styles.checkmarkContainer, { marginBottom: 24 * scale }]}>
              <View style={[styles.checkmark, { width: 80 * scale, height: 80 * scale }]}>
                <Icon name="check" size={48 * scale} color={COLORS.SUCCESS_GREEN} />
              </View>
            </View>
            <Text style={[styles.title, { fontSize: 24 * scale, marginBottom: 12 * scale }]}>
              Transaction Sent
            </Text>
            <Text style={[styles.subtitle, { fontSize: 14 * scale }]}>
              Your transaction has been successfully broadcast to the network
            </Text>

            {/* Explorer Button */}
            <TouchableOpacity
              style={[
                styles.explorerButton,
                { paddingVertical: 12 * scale, paddingHorizontal: 16 * scale, marginTop: 24 * scale },
              ]}
            >
              <Text style={[styles.explorerButtonText, { fontSize: 14 * scale }]}>
                View on Explorer
              </Text>
              <Icon name="arrow_right" size={16 * scale} color={COLORS.PRIMARY_BLUE} />
            </TouchableOpacity>
          </>
        )}

        {/* Turbo State */}
        {state === 'turbo' && (
          <>
            <View style={[styles.checkmarkContainer, { marginBottom: 24 * scale }]}>
              <View style={styles.heroLogoContainer}>
                <Icon name="unit_logo" size={80 * scale} />
                <Text style={[styles.heroLightningBadge, { fontSize: 32 * scale }]}>⚡</Text>
              </View>
            </View>
            <Text style={[styles.title, { fontSize: 24 * scale, marginBottom: 12 * scale }]}>
              Turbo Token Ready
            </Text>
            <Text style={[styles.subtitle, { fontSize: 14 * scale, marginBottom: 24 * scale }]}>
              Share this link with the recipient
            </Text>

            {/* URL Display */}
            <TouchableOpacity
              style={[styles.urlContainer, { padding: 16 * scale, gap: 8 * scale }]}
            >
              <Text style={[styles.urlText, { fontSize: 13 * scale }]} numberOfLines={2}>
                {shortDeeplink}
              </Text>
              <Text style={[styles.tapToCopyHint, { fontSize: 11 * scale }]}>Tap to copy</Text>
            </TouchableOpacity>

            {/* Action Buttons */}
            <View style={[styles.buttonRow, { gap: 12 * scale, marginTop: 16 * scale }]}>
              <TouchableOpacity
                style={[
                  styles.actionButton,
                  styles.shareButton,
                  { paddingVertical: 10 * scale, paddingHorizontal: 16 * scale, gap: 6 * scale },
                ]}
              >
                <Icon name="share" size={16 * scale} color={COLORS.PRIMARY_BLUE} />
                <Text style={[styles.actionButtonText, { fontSize: 14 * scale }]}>Share</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.actionButton,
                  styles.copyButton,
                  { paddingVertical: 10 * scale, paddingHorizontal: 16 * scale, gap: 6 * scale },
                ]}
              >
                <Icon name="arrow_right" size={16 * scale} color={COLORS.VERY_LIGHT_GRAY} />
                <Text style={[styles.actionButtonText, { fontSize: 14 * scale }]}>Open Link</Text>
              </TouchableOpacity>
            </View>
          </>
        )}
      </View>

      {/* Done Button - Fixed at bottom */}
      <View style={[styles.buttonContainer, { paddingBottom: 20 * scale }]}>
        <TouchableOpacity
          style={[
            styles.doneButton,
            { paddingVertical: 14 * scale, borderRadius: 10 * scale },
          ]}
        >
          <Text style={[styles.doneButtonText, { fontSize: 15 * scale }]}>Done</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const ConfirmationStory = (args: ConfirmationProps) => {
  return (
    <View style={styles.storyContainer}>
      <View style={styles.phoneFrame}>
        <MockConfirmationScreen {...args} />
      </View>
    </View>
  );
};

const meta: Meta = {
  title: 'Screens/Transfer/Submitted Page',
};

export default meta;
type Story = StoryObj<typeof ConfirmationStory>;

export const Default: Story = {
  render: (args: ConfirmationProps) => <ConfirmationStory {...args} />,
  args: {
    screenSize: 'L',
    state: 'success',
    txid: 'abc123def456...',
    turboDeeplink: 'https://ducat.app/turbo?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9',
  },
  argTypes: {
    screenSize: {
      control: { type: 'select' },
      options: ['XS', 'S', 'M', 'L', 'XL'],
      description: 'Device screen size',
    },
    state: {
      control: { type: 'select' },
      options: ['success', 'turbo', 'converting'],
      description: 'Confirmation state',
    },
    txid: {
      control: { type: 'text' },
      description: 'Transaction ID',
    },
    turboDeeplink: {
      control: { type: 'text' },
      description: 'Turbo deeplink URL',
    },
  },
};

export const TransactionSuccess: Story = {
  ...Default,
  args: {
    ...Default.args,
    state: 'success',
  },
};

export const TurboTokenReady: Story = {
  ...Default,
  args: {
    ...Default.args,
    state: 'turbo',
  },
};

export const ConvertingToTurbo: Story = {
  ...Default,
  args: {
    ...Default.args,
    state: 'converting',
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
    justifyContent: 'space-between',
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
  },
  processingTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.VERY_LIGHT_GRAY,
    textAlign: 'center',
    marginBottom: 8,
  },
  processingMessage: {
    fontSize: 14,
    color: COLORS.SECONDARY_TEXT,
    textAlign: 'center',
    lineHeight: 20,
  },
  checkmarkContainer: {
    marginBottom: 24,
  },
  checkmark: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: COLORS.SUCCESS_GREEN + '20',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: COLORS.SUCCESS_GREEN,
  },
  heroLogoContainer: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroLightningBadge: {
    position: 'absolute',
    bottom: -8,
    right: -8,
    fontSize: 32,
  },
  title: {
    fontSize: 24,
    fontWeight: '600',
    color: COLORS.WHITE,
    textAlign: 'center',
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 14,
    color: COLORS.SECONDARY_TEXT,
    textAlign: 'center',
    lineHeight: 20,
  },
  explorerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: COLORS.CARD_BG,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.PRIMARY_BLUE + '30',
    marginTop: 24,
  },
  explorerButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.PRIMARY_BLUE,
  },
  urlContainer: {
    backgroundColor: COLORS.CARD_BG,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.BORDER_COLOR,
    width: '100%',
    gap: 8,
  },
  urlText: {
    fontSize: 13,
    color: COLORS.VERY_LIGHT_GRAY,
    fontFamily: 'monospace',
    textAlign: 'center',
  },
  tapToCopyHint: {
    fontSize: 11,
    color: COLORS.SECONDARY_TEXT,
    textAlign: 'center',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
    width: '100%',
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
    gap: 6,
  },
  shareButton: {
    backgroundColor: COLORS.CARD_BG,
    borderWidth: 1,
    borderColor: COLORS.PRIMARY_BLUE + '30',
  },
  copyButton: {
    backgroundColor: COLORS.PRIMARY_BLUE,
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.VERY_LIGHT_GRAY,
  },
  buttonContainer: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  doneButton: {
    backgroundColor: COLORS.PRIMARY_BLUE,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  doneButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.WHITE,
  },
});
