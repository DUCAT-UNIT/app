import React from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import type { Meta, StoryObj } from '@storybook/react';
import { COLORS } from '../../../theme';

const ColorSwatch = ({ name, color }: { name: string; color: string }) => {
  const isTransparent = color === 'transparent';
  const isDark = !isTransparent && (
    color.startsWith('#0') ||
    color.startsWith('#1') ||
    color.startsWith('#2') ||
    color.startsWith('#3') ||
    color.includes('rgba')
  );

  return (
    <View style={styles.swatchContainer}>
      <View
        style={[
          styles.swatch,
          { backgroundColor: color },
          isTransparent && styles.transparentSwatch
        ]}
      />
      <View style={styles.swatchInfo}>
        <Text style={[styles.swatchName, isDark && styles.lightText]}>{name}</Text>
        <Text style={[styles.swatchValue, isDark && styles.lightText]}>{color}</Text>
      </View>
    </View>
  );
};

const ColorSection = ({ title, colors }: { title: string; colors: Array<{ name: string; color: string }> }) => (
  <View style={styles.section}>
    <Text style={styles.sectionTitle}>{title}</Text>
    <View style={styles.swatchGrid}>
      {colors.map(({ name, color }) => (
        <ColorSwatch key={name} name={name} color={color} />
      ))}
    </View>
  </View>
);

const ColorsComponent = () => {
  const colorCategories = {
    'Blacks & Dark': [
      { name: 'BLACK', color: COLORS.BLACK },
      { name: 'DARK_BG', color: COLORS.DARK_BG },
      { name: 'VERY_DARK_GRAY', color: COLORS.VERY_DARK_GRAY },
      { name: 'CARD_BG', color: COLORS.CARD_BG },
    ],
    'Grays': [
      { name: 'DARK_GRAY', color: COLORS.DARK_GRAY },
      { name: 'MID_DARK_GRAY', color: COLORS.MID_DARK_GRAY },
      { name: 'MEDIUM_GRAY', color: COLORS.MEDIUM_GRAY },
      { name: 'MID_GRAY', color: COLORS.MID_GRAY },
      { name: 'SECONDARY_TEXT', color: COLORS.SECONDARY_TEXT },
      { name: 'BORDER_COLOR', color: COLORS.BORDER_COLOR },
      { name: 'LIGHT_GRAY', color: COLORS.LIGHT_GRAY },
      { name: 'VERY_LIGHT_GRAY', color: COLORS.VERY_LIGHT_GRAY },
      { name: 'OFF_WHITE_GRAY', color: COLORS.OFF_WHITE_GRAY },
    ],
    'Whites': [
      { name: 'OFF_WHITE', color: COLORS.OFF_WHITE },
      { name: 'PINK_WHITE', color: COLORS.PINK_WHITE },
      { name: 'WHITE', color: COLORS.WHITE },
    ],
    'Brand': [
      { name: 'PURPLE', color: COLORS.PURPLE },
      { name: 'PRIMARY_BLUE', color: COLORS.PRIMARY_BLUE },
      { name: 'BLUE', color: COLORS.BLUE },
    ],
    'Success': [
      { name: 'TEAL', color: COLORS.TEAL },
      { name: 'GREEN', color: COLORS.GREEN },
      { name: 'SUCCESS_GREEN', color: COLORS.SUCCESS_GREEN },
    ],
    'Warning': [
      { name: 'YELLOW', color: COLORS.YELLOW },
      { name: 'WARNING_ORANGE', color: COLORS.WARNING_ORANGE },
      { name: 'BITCOIN_ORANGE', color: COLORS.BITCOIN_ORANGE },
    ],
    'Error': [
      { name: 'DANGER_RED', color: COLORS.DANGER_RED },
      { name: 'BRIGHT_RED', color: COLORS.BRIGHT_RED },
      { name: 'ERROR_BG', color: COLORS.ERROR_BG },
    ],
    'Text Semantic': [
      { name: 'TEXT_PRIMARY', color: COLORS.TEXT_PRIMARY },
      { name: 'TEXT_SECONDARY', color: COLORS.TEXT_SECONDARY },
      { name: 'TEXT_TERTIARY', color: COLORS.TEXT_TERTIARY },
      { name: 'TEXT_INVERSE', color: COLORS.TEXT_INVERSE },
      { name: 'TEXT_WHITE', color: COLORS.TEXT_WHITE },
    ],
    'Background Semantic': [
      { name: 'BG_PRIMARY', color: COLORS.BG_PRIMARY },
      { name: 'BG_SECONDARY', color: COLORS.BG_SECONDARY },
      { name: 'BG_TERTIARY', color: COLORS.BG_TERTIARY },
      { name: 'BG_WHITE', color: COLORS.BG_WHITE },
    ],
    'Status Semantic': [
      { name: 'INFO', color: COLORS.INFO },
      { name: 'SUCCESS', color: COLORS.SUCCESS },
      { name: 'WARNING', color: COLORS.WARNING },
      { name: 'ERROR', color: COLORS.ERROR },
    ],
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Color Palette</Text>
      <Text style={styles.subtitle}>Design tokens for the Ducat app theme</Text>

      {Object.entries(colorCategories).map(([title, colors]) => (
        <ColorSection key={title} title={title} colors={colors} />
      ))}
    </ScrollView>
  );
};

const meta: Meta<typeof ColorsComponent> = {
  title: 'Foundation/Colors',
  component: ColorsComponent,
};

export default meta;

type Story = StoryObj<typeof ColorsComponent>;

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
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.VERY_LIGHT_GRAY,
    marginBottom: 12,
  },
  swatchGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  swatchContainer: {
    width: 100,
    marginBottom: 8,
  },
  swatch: {
    width: 100,
    height: 60,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.BORDER_COLOR,
  },
  transparentSwatch: {
    borderStyle: 'dashed',
  },
  swatchInfo: {
    marginTop: 4,
  },
  swatchName: {
    fontSize: 10,
    fontWeight: '600',
    color: COLORS.VERY_LIGHT_GRAY,
  },
  swatchValue: {
    fontSize: 9,
    color: COLORS.SECONDARY_TEXT,
  },
  lightText: {
    color: COLORS.VERY_LIGHT_GRAY,
  },
});
