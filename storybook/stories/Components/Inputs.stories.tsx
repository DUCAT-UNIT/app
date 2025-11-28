import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import type { Meta, StoryObj } from '@storybook/react';
import { COLORS } from '../../../theme';
import Icon from '../../../components/icons';

// ============================================================================
// INPUT COMPONENT
// ============================================================================
const Input = ({
  label,
  placeholder,
  value,
  onChangeText,
  error,
  icon,
  suffix,
  disabled = false,
}: {
  label?: string;
  placeholder?: string;
  value: string;
  onChangeText?: (text: string) => void;
  error?: string;
  icon?: string;
  suffix?: string;
  disabled?: boolean;
}) => (
  <View style={styles.inputWrapper}>
    {label && <Text style={styles.inputLabel}>{label}</Text>}
    <View style={[
      styles.inputContainer,
      error && styles.inputError,
      disabled && styles.inputDisabled,
    ]}>
      {icon && (
        <View style={styles.inputIcon}>
          <Icon name={icon} size={20} color={COLORS.SECONDARY_TEXT} />
        </View>
      )}
      <TextInput
        style={[styles.input, icon && styles.inputWithIcon]}
        placeholder={placeholder}
        placeholderTextColor={COLORS.SECONDARY_TEXT}
        value={value}
        onChangeText={onChangeText}
        editable={!disabled}
      />
      {suffix && <Text style={styles.inputSuffix}>{suffix}</Text>}
    </View>
    {error && <Text style={styles.errorText}>{error}</Text>}
  </View>
);

// ============================================================================
// AMOUNT INPUT COMPONENT
// ============================================================================
const AmountInput = ({
  value,
  onChangeText,
  currency = 'BTC',
}: {
  value: string;
  onChangeText?: (text: string) => void;
  currency?: 'BTC' | 'UNIT' | 'USD';
}) => {
  const iconMap = {
    BTC: 'btc_symbol',
    UNIT: 'unit_symbol',
    USD: null,
  };

  return (
    <View style={styles.amountInputWrapper}>
      <View style={styles.amountInputContainer}>
        {iconMap[currency] && (
          <Icon name={iconMap[currency]!} size={24} color={COLORS.WHITE} />
        )}
        {currency === 'USD' && <Text style={styles.currencySymbol}>$</Text>}
        <TextInput
          style={styles.amountInput}
          placeholder="0.00"
          placeholderTextColor={COLORS.SECONDARY_TEXT}
          value={value}
          onChangeText={onChangeText}
          keyboardType="decimal-pad"
        />
      </View>
      <View style={styles.currencyToggle}>
        <Text style={styles.currencyLabel}>{currency}</Text>
        <Icon name="chevron_down" size={16} color={COLORS.SECONDARY_TEXT} />
      </View>
    </View>
  );
};

// ============================================================================
// INTERACTIVE DEMO
// ============================================================================
const InteractiveDemo = () => {
  const [text, setText] = useState('');
  const [amount, setAmount] = useState('');

  return (
    <View style={styles.demoContainer}>
      <Text style={styles.demoLabel}>Interactive - Type to test</Text>
      <Input
        label="Recipient Address"
        placeholder="Enter BTC address"
        value={text}
        onChangeText={setText}
        icon="wallet"
      />
      <View style={{ height: 16 }} />
      <Text style={styles.demoLabel}>Amount Input</Text>
      <AmountInput value={amount} onChangeText={setAmount} currency="BTC" />
    </View>
  );
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================
const InputsStory = () => (
  <View style={styles.container}>
    <Text style={styles.title}>Inputs</Text>
    <Text style={styles.description}>
      Text inputs and amount entry fields for forms and data entry.
    </Text>

    <Text style={styles.sectionLabel}>TEXT INPUT</Text>
    <View style={styles.inputList}>
      <Input
        label="Default"
        placeholder="Enter text..."
        value=""
      />
      <Input
        label="With Icon"
        placeholder="Search..."
        value=""
        icon="qr_scan"
      />
      <Input
        label="With Value"
        placeholder="Enter text..."
        value="bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh"
      />
      <Input
        label="With Suffix"
        placeholder="0.00"
        value="0.05"
        suffix="BTC"
      />
      <Input
        label="Error State"
        placeholder="Enter text..."
        value="invalid"
        error="Invalid address format"
      />
      <Input
        label="Disabled"
        placeholder="Cannot edit"
        value="Locked value"
        disabled
      />
    </View>

    <Text style={styles.sectionLabel}>AMOUNT INPUT</Text>
    <View style={styles.amountList}>
      <View style={styles.amountItem}>
        <Text style={styles.amountLabel}>Bitcoin</Text>
        <AmountInput value="0.05420000" currency="BTC" />
      </View>
      <View style={styles.amountItem}>
        <Text style={styles.amountLabel}>UNIT</Text>
        <AmountInput value="1,234.56" currency="UNIT" />
      </View>
      <View style={styles.amountItem}>
        <Text style={styles.amountLabel}>USD</Text>
        <AmountInput value="5,420.00" currency="USD" />
      </View>
    </View>

    <Text style={styles.sectionLabel}>INTERACTIVE</Text>
    <InteractiveDemo />
  </View>
);

// ============================================================================
// STORYBOOK META
// ============================================================================
const meta: Meta<typeof InputsStory> = {
  title: 'Primitives/Inputs',
  component: InputsStory,
};

export default meta;
type Story = StoryObj<typeof InputsStory>;

export const TextBoxes: Story = {};

// ============================================================================
// STYLES
// ============================================================================
const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: COLORS.VERY_LIGHT_GRAY,
    marginBottom: 8,
  },
  description: {
    fontSize: 15,
    color: COLORS.SECONDARY_TEXT,
    lineHeight: 22,
    marginBottom: 40,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.SECONDARY_TEXT,
    letterSpacing: 1,
    marginBottom: 12,
    marginTop: 24,
  },

  // Input
  inputList: {
    gap: 16,
  },
  inputWrapper: {
    gap: 6,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.SECONDARY_TEXT,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.CARD_BG,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.BORDER_COLOR,
    paddingHorizontal: 16,
    height: 48,
  },
  inputError: {
    borderColor: COLORS.DANGER_RED,
  },
  inputDisabled: {
    opacity: 0.5,
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: COLORS.WHITE,
  },
  inputWithIcon: {
    paddingLeft: 0,
  },
  inputSuffix: {
    fontSize: 14,
    color: COLORS.SECONDARY_TEXT,
    marginLeft: 8,
  },
  errorText: {
    fontSize: 12,
    color: COLORS.DANGER_RED,
  },

  // Amount input
  amountList: {
    gap: 12,
  },
  amountItem: {
    backgroundColor: COLORS.CARD_BG,
    borderRadius: 12,
    padding: 16,
  },
  amountLabel: {
    fontSize: 12,
    color: COLORS.SECONDARY_TEXT,
    marginBottom: 8,
  },
  amountInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  amountInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  amountInput: {
    fontSize: 28,
    fontWeight: '700',
    color: COLORS.WHITE,
    marginLeft: 8,
    flex: 1,
  },
  currencySymbol: {
    fontSize: 28,
    fontWeight: '700',
    color: COLORS.WHITE,
  },
  currencyToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.BORDER_COLOR,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 4,
  },
  currencyLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.WHITE,
  },

  // Demo
  demoContainer: {
    backgroundColor: COLORS.CARD_BG,
    borderRadius: 12,
    padding: 16,
  },
  demoLabel: {
    fontSize: 12,
    color: COLORS.PRIMARY_BLUE,
    marginBottom: 12,
    fontWeight: '600',
  },
});
