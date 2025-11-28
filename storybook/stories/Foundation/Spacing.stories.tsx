import React from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import type { Meta, StoryObj } from '@storybook/react';
import { COLORS, SPACING, BORDER_RADIUS, SHADOWS } from '../../../theme';

const SpacingVisual = ({ name, value }: { name: string; value: number }) => (
  <View style={styles.spacingRow}>
    <View style={styles.spacingInfo}>
      <Text style={styles.spacingName}>{name}</Text>
      <Text style={styles.spacingValue}>{value}px</Text>
    </View>
    <View style={styles.spacingVisualContainer}>
      <View style={[styles.spacingBar, { width: value * 4, maxWidth: 250 }]} />
    </View>
  </View>
);

const BorderRadiusVisual = ({ name, value }: { name: string; value: number }) => (
  <View style={styles.radiusItem}>
    <View style={[styles.radiusBox, { borderRadius: value }]} />
    <Text style={styles.radiusName}>{name}</Text>
    <Text style={styles.radiusValue}>{value}px</Text>
  </View>
);

const ShadowVisual = ({ name, shadow }: { name: string; shadow: object }) => (
  <View style={styles.shadowItem}>
    <View style={[styles.shadowBox, shadow]} />
    <Text style={styles.shadowName}>{name}</Text>
  </View>
);

const SpacingSection = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <View style={styles.section}>
    <Text style={styles.sectionTitle}>{title}</Text>
    {children}
  </View>
);

const SpacingComponent = () => {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Spacing & Layout</Text>
      <Text style={styles.subtitle}>Spacing scale, border radius, and shadows</Text>

      {/* Spacing Scale */}
      <SpacingSection title="Spacing Scale">
        <Text style={styles.description}>
          Base unit: 4px. Use these values for consistent margins and padding.
        </Text>
        {Object.entries(SPACING).map(([name, value]) => (
          <SpacingVisual key={name} name={name} value={value} />
        ))}
      </SpacingSection>

      {/* Border Radius */}
      <SpacingSection title="Border Radius">
        <View style={styles.radiusGrid}>
          {Object.entries(BORDER_RADIUS).map(([name, value]) => (
            <BorderRadiusVisual key={name} name={name} value={value} />
          ))}
        </View>
      </SpacingSection>

      {/* Shadows */}
      <SpacingSection title="Shadows / Elevation">
        <View style={styles.shadowGrid}>
          {Object.entries(SHADOWS).map(([name, shadow]) => (
            <ShadowVisual key={name} name={name} shadow={shadow} />
          ))}
        </View>
      </SpacingSection>

      {/* Usage Examples */}
      <SpacingSection title="Usage Examples">
        <View style={styles.usageCard}>
          <Text style={styles.usageTitle}>Card with standard spacing</Text>
          <View style={[styles.usageExample, {
            padding: SPACING.md,
            borderRadius: BORDER_RADIUS.md,
            ...SHADOWS.md
          }]}>
            <Text style={styles.usageContent}>
              padding: SPACING.md (16px){'\n'}
              borderRadius: BORDER_RADIUS.md (8px){'\n'}
              shadow: SHADOWS.md
            </Text>
          </View>
        </View>

        <View style={styles.usageCard}>
          <Text style={styles.usageTitle}>Compact element</Text>
          <View style={[styles.usageExample, {
            padding: SPACING.sm,
            borderRadius: BORDER_RADIUS.sm,
          }]}>
            <Text style={styles.usageContent}>
              padding: SPACING.sm (8px){'\n'}
              borderRadius: BORDER_RADIUS.sm (4px)
            </Text>
          </View>
        </View>

        <View style={styles.usageCard}>
          <Text style={styles.usageTitle}>Pill / Tag</Text>
          <View style={[styles.usageExample, {
            paddingVertical: SPACING.xs,
            paddingHorizontal: SPACING.sm,
            borderRadius: BORDER_RADIUS.full,
            alignSelf: 'flex-start',
          }]}>
            <Text style={styles.usageContent}>borderRadius: full</Text>
          </View>
        </View>
      </SpacingSection>
    </ScrollView>
  );
};

const meta: Meta<typeof SpacingComponent> = {
  title: 'Foundation/Spacing',
  component: SpacingComponent,
};

export default meta;

type Story = StoryObj<typeof SpacingComponent>;

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
    borderBottomWidth: 1,
    borderBottomColor: COLORS.BORDER_COLOR,
    paddingBottom: 8,
  },
  description: {
    fontSize: 13,
    color: COLORS.SECONDARY_TEXT,
    marginBottom: 16,
  },
  spacingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  spacingInfo: {
    width: 80,
  },
  spacingName: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.VERY_LIGHT_GRAY,
  },
  spacingValue: {
    fontSize: 12,
    color: COLORS.SECONDARY_TEXT,
  },
  spacingVisualContainer: {
    flex: 1,
    height: 24,
    justifyContent: 'center',
  },
  spacingBar: {
    height: 16,
    backgroundColor: COLORS.PRIMARY_BLUE,
    borderRadius: 4,
  },
  radiusGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  radiusItem: {
    alignItems: 'center',
  },
  radiusBox: {
    width: 60,
    height: 60,
    backgroundColor: COLORS.PRIMARY_BLUE,
    marginBottom: 8,
  },
  radiusName: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.VERY_LIGHT_GRAY,
  },
  radiusValue: {
    fontSize: 11,
    color: COLORS.SECONDARY_TEXT,
  },
  shadowGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  shadowItem: {
    alignItems: 'center',
  },
  shadowBox: {
    width: 80,
    height: 60,
    backgroundColor: COLORS.CARD_BG,
    borderRadius: 8,
    marginBottom: 8,
  },
  shadowName: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.VERY_LIGHT_GRAY,
  },
  usageCard: {
    marginBottom: 20,
  },
  usageTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.VERY_LIGHT_GRAY,
    marginBottom: 8,
  },
  usageExample: {
    backgroundColor: COLORS.CARD_BG,
    borderWidth: 1,
    borderColor: COLORS.BORDER_COLOR,
  },
  usageContent: {
    fontSize: 12,
    color: COLORS.SECONDARY_TEXT,
    lineHeight: 20,
  },
});
