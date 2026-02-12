import React from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import type { Meta, StoryObj } from '@storybook/react';
import { COLORS } from '../../../theme';
import Icon from '../../../components/icons';

// ============================================================================
// SIZE DEFINITIONS (Phone Screen Based)
// XS = iPhone 8 (375pt), XL = iPhone 16 Pro Max (430pt)
// ============================================================================
const SIZES = [
  { label: 'XS', size: 16 },
  { label: 'S', size: 20 },
  { label: 'M', size: 24 },
  { label: 'L', size: 28 },
  { label: 'XL', size: 32 },
];

// ============================================================================
// ICONS BY CATEGORY
// ============================================================================
const ICON_CATEGORIES = [
  {
    name: 'Navigation',
    icons: ['back', 'settings', 'transaction_history'],
  },
  {
    name: 'Actions',
    icons: ['send', 'receive', 'close'],
  },
  {
    name: 'Status',
    icons: ['done', 'warning', 'party'],
  },
  {
    name: 'Wallet',
    icons: ['wallet', 'vault', 'asset', 'fuse', 'turbo'],
  },
  {
    name: 'Brand',
    icons: ['unit_logo', 'btc_logo', 'ducat_logo', 'btc_symbol', 'unit_symbol', 'vault_logo', 'qr_code'],
  },
  {
    name: 'UI',
    icons: ['copy', 'paste', 'delete', 'chevron_down', 'chevron_up', 'notification', 'link', 'external_link', 'share', 'check', 'qr_scan'],
  },
  {
    name: 'Security',
    icons: ['pin', 'face_id', 'privacy_on', 'privacy_off', 'recovery_phrase'],
  },
  {
    name: 'Account',
    icons: ['switch_account', 'logout', 'delete_wallet'],
  },
];

const TOTAL_ICONS = ICON_CATEGORIES.reduce((sum, cat) => sum + cat.icons.length, 0);

// ============================================================================
// ICON ROW - Shows one icon at all 5 sizes
// ============================================================================
const IconRow = ({ name, color }: { name: string; color: string }) => (
  <View style={styles.iconRow}>
    <Text style={styles.iconName}>{name}</Text>
    {SIZES.map(({ label, size }) => (
      <View key={label} style={styles.sizeCell}>
        <Icon name={name} size={size} color={color} />
      </View>
    ))}
  </View>
);

// ============================================================================
// MAIN COMPONENT - All icons at all sizes with color control
// ============================================================================
interface IconsProps {
  color: string;
}

const AllIconsAllSizes = ({ color }: IconsProps) => {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>All Icons - All Sizes</Text>
      <Text style={styles.subtitle}>
        {TOTAL_ICONS} icons × {SIZES.length} sizes = {TOTAL_ICONS * SIZES.length} variations
      </Text>

      {/* Header */}
      <View style={styles.headerRow}>
        <Text style={styles.headerLabel}>Icon</Text>
        {SIZES.map(({ label, size }) => (
          <View key={label} style={styles.sizeCell}>
            <Text style={styles.sizeHeader}>{label}</Text>
            <Text style={styles.sizeSubHeader}>{size}px</Text>
          </View>
        ))}
      </View>

      {/* Icons by category */}
      {ICON_CATEGORIES.map(({ name, icons }) => (
        <View key={name}>
          <Text style={styles.categoryHeader}>{name}</Text>
          {icons.map((iconName) => (
            <IconRow key={iconName} name={iconName} color={color} />
          ))}
        </View>
      ))}
    </ScrollView>
  );
};

// ============================================================================
// STORYBOOK META - With color control
// ============================================================================
const meta: Meta<typeof AllIconsAllSizes> = {
  title: 'Foundation/Icons',
  component: AllIconsAllSizes,
  argTypes: {
    color: {
      control: 'select',
      options: [COLORS.WHITE, COLORS.PRIMARY_BLUE, COLORS.LIGHT_GRAY, COLORS.SUCCESS_GREEN, COLORS.YELLOW, COLORS.DANGER_RED],
      description: 'Icon color',
    },
  },
  args: {
    color: COLORS.WHITE,
  },
};

export default meta;

type Story = StoryObj<typeof AllIconsAllSizes>;

export const Default: Story = {};

// ============================================================================
// STYLES - Compact table layout
// ============================================================================
const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.VERY_LIGHT_GRAY,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 13,
    color: COLORS.SECONDARY_TEXT,
    marginBottom: 20,
  },

  // Header row
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.BORDER_COLOR,
  },
  headerLabel: {
    width: 130,
    fontSize: 10,
    fontWeight: '600',
    color: COLORS.SECONDARY_TEXT,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  sizeHeader: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.WHITE,
    textAlign: 'center',
  },
  sizeSubHeader: {
    fontSize: 9,
    color: COLORS.SECONDARY_TEXT,
    textAlign: 'center',
  },

  // Icon row
  iconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 40,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.BORDER_COLOR + '30',
  },
  iconName: {
    width: 130,
    fontSize: 11,
    color: COLORS.LIGHT_GRAY,
  },
  sizeCell: {
    width: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Category
  categoryHeader: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.PRIMARY_BLUE,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 20,
    marginBottom: 8,
    paddingBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.PRIMARY_BLUE + '30',
  },
});
