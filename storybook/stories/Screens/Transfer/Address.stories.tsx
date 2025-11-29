import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Pressable, Switch } from 'react-native';
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

interface AddressInputProps {
  screenSize: ScreenSize;
  assetType: AssetType;
  showTurboToggle: boolean;
  hasError: boolean;
  errorMessage: string;
}

const MockAddressInputScreen = ({
  screenSize,
  assetType,
  showTurboToggle,
  hasError,
  errorMessage,
}: AddressInputProps) => {
  const deviceWidth = DEVICE_CONFIGS.find(d => d.size === screenSize)?.width || 393;
  const scale = DEVICE_CONFIGS.find(d => d.size === screenSize)?.scale || 1.0;

  const [address, setAddress] = useState('');
  const [turboEnabled, setTurboEnabled] = useState(true);

  const validAddress = 'tb1pexample1234567890abcdefghijklmnopqrstuvwxyz';
  const displayError = hasError && address.length > 0;

  return (
    <View style={[styles.container, { width: deviceWidth }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton}>
          <Icon name="back" size={24 * scale} color={COLORS.VERY_LIGHT_GRAY} />
        </TouchableOpacity>
        <Text style={[styles.title, { fontSize: 20 * scale }]}>Enter Address</Text>
      </View>

      {/* Content */}
      <View style={styles.content}>
        <View style={styles.labelRow}>
          <Text style={[styles.label, { fontSize: 14 * scale }]}>Recipient Address</Text>
          <View style={styles.labelRight}>
            {showTurboToggle && (
              <>
                <Icon name="turbo" size={16 * scale} color={COLORS.YELLOW} />
                <Switch
                  value={turboEnabled}
                  onValueChange={setTurboEnabled}
                  trackColor={{ false: COLORS.MID_DARK_GRAY, true: COLORS.YELLOW }}
                  thumbColor={COLORS.WHITE}
                  ios_backgroundColor={COLORS.MID_DARK_GRAY}
                  style={[styles.switch, { transform: [{ scale: scale * 0.85 }] }]}
                />
              </>
            )}
          </View>
        </View>

        <View style={styles.inputRow}>
          <TextInput
            style={[styles.input, { fontSize: 14 * scale, paddingVertical: 12 * scale }]}
            value={address}
            onChangeText={setAddress}
            placeholder="tb1q... or tb1p..."
            placeholderTextColor={COLORS.MEDIUM_GRAY}
            autoCapitalize="none"
            autoCorrect={false}
            multiline
            numberOfLines={2}
          />
          <Pressable
            style={[styles.pasteButton, { width: 40 * scale, height: 40 * scale }]}
            onPress={() => setAddress(validAddress)}
          >
            <Icon name="paste" size={18 * scale} color={COLORS.WHITE} />
          </Pressable>
        </View>

        <View style={[styles.errorContainer, { minHeight: 20 * scale }]}>
          {displayError ? (
            <Text style={[styles.errorText, { fontSize: 12 * scale }]}>{errorMessage}</Text>
          ) : null}
        </View>

        {assetType === 'unit' && turboEnabled && (
          <View style={[styles.turboWarningContainer, { padding: 12 * scale, gap: 4 * scale }]}>
            <View style={styles.turboWarningTextContainer}>
              <Text style={[styles.turboWarningTitle, { fontSize: 14 * scale }]}>
                Turbo Transaction
              </Text>
              <Text style={[styles.turboWarningText, { fontSize: 12 * scale }]}>
                Anonymous, instant, and private.{'\n'}
                The recipient has to claim the funds manually.
              </Text>
            </View>
          </View>
        )}
      </View>

      {/* Continue Button */}
      <View style={[styles.buttonContainer, { paddingBottom: 20 * scale }]}>
        <TouchableOpacity
          style={[
            styles.continueButton,
            { paddingVertical: 14 * scale, borderRadius: 10 * scale },
            (!address || displayError) && styles.continueButtonDisabled,
          ]}
        >
          <Text style={[styles.continueButtonText, { fontSize: 15 * scale }]}>Continue</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const AddressInputStory = (args: AddressInputProps) => {
  return (
    <View style={styles.storyContainer}>
      <View style={styles.phoneFrame}>
        <MockAddressInputScreen {...args} />
      </View>
    </View>
  );
};

const meta: Meta = {
  title: 'Screens/Transfer/Address',
};

export default meta;
type Story = StoryObj<typeof AddressInputStory>;

export const Default: Story = {
  render: (args: AddressInputProps) => <AddressInputStory {...args} />,
  args: {
    screenSize: 'L',
    assetType: 'btc',
    showTurboToggle: false,
    hasError: false,
    errorMessage: 'Invalid address',
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
    showTurboToggle: {
      control: { type: 'boolean' },
      description: 'Show Turbo toggle (UNIT + Advanced Mode)',
    },
    hasError: {
      control: { type: 'boolean' },
      description: 'Show address validation error',
    },
    errorMessage: {
      control: { type: 'text' },
      description: 'Error message to display',
    },
  },
};

export const BTCAddress: Story = {
  ...Default,
  args: {
    ...Default.args,
    assetType: 'btc',
    showTurboToggle: false,
  },
};

export const UNITWithTurbo: Story = {
  ...Default,
  args: {
    ...Default.args,
    assetType: 'unit',
    showTurboToggle: true,
  },
};

export const InvalidAddress: Story = {
  ...Default,
  args: {
    ...Default.args,
    hasError: true,
    errorMessage: 'UNIT transfers require a Taproot address (tb1p... or bc1p...)',
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
  title: {
    fontSize: 20,
    fontWeight: '500',
    color: COLORS.VERY_LIGHT_GRAY,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.VERY_LIGHT_GRAY,
  },
  labelRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  switch: {
    transform: [{ scale: 0.85 }],
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  input: {
    flex: 1,
    backgroundColor: COLORS.CARD_BG,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 14,
    color: COLORS.WHITE,
    borderWidth: 1,
    borderColor: COLORS.BORDER_COLOR,
    minHeight: 56,
  },
  pasteButton: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: COLORS.PRIMARY_BLUE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorContainer: {
    minHeight: 20,
    marginTop: 8,
  },
  errorText: {
    fontSize: 12,
    color: COLORS.DANGER_RED,
  },
  turboWarningContainer: {
    backgroundColor: COLORS.CARD_BG,
    borderRadius: 12,
    padding: 12,
    marginTop: 16,
    borderWidth: 1,
    borderColor: COLORS.YELLOW + '30',
    gap: 4,
  },
  turboWarningTextContainer: {
    gap: 4,
  },
  turboWarningTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.YELLOW,
  },
  turboWarningText: {
    fontSize: 12,
    color: COLORS.SECONDARY_TEXT,
    lineHeight: 18,
  },
  buttonContainer: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  continueButton: {
    backgroundColor: COLORS.PRIMARY_BLUE,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  continueButtonDisabled: {
    backgroundColor: COLORS.MID_DARK_GRAY,
  },
  continueButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.WHITE,
  },
});
