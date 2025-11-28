import React from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import type { Meta, StoryObj } from '@storybook/react';
import { COLORS, TYPOGRAPHY, FONTS, FONT_WEIGHTS } from '../../../theme';

const TypographySample = ({
  name,
  style,
  sampleText = 'The quick brown fox jumps over the lazy dog'
}: {
  name: string;
  style: object;
  sampleText?: string;
}) => (
  <View style={styles.sampleContainer}>
    <View style={styles.sampleHeader}>
      <Text style={styles.sampleName}>{name}</Text>
      <Text style={styles.sampleMeta}>
        {Object.entries(style).map(([key, value]) => `${key}: ${value}`).join(' | ')}
      </Text>
    </View>
    <Text style={[styles.sampleText, style]}>{sampleText}</Text>
  </View>
);

const TypographySection = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <View style={styles.section}>
    <Text style={styles.sectionTitle}>{title}</Text>
    {children}
  </View>
);

const TypographyComponent = () => {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Typography</Text>
      <Text style={styles.subtitle}>Font families, sizes, and weights</Text>

      {/* Font Families */}
      <TypographySection title="Font Families">
        <View style={styles.fontFamily}>
          <Text style={[styles.fontFamilyName, { fontFamily: FONTS.regular }]}>
            CabinetGrotesk Regular
          </Text>
          <Text style={styles.fontFamilyValue}>FONTS.regular</Text>
        </View>
        <View style={styles.fontFamily}>
          <Text style={[styles.fontFamilyName, { fontFamily: FONTS.medium }]}>
            CabinetGrotesk Medium
          </Text>
          <Text style={styles.fontFamilyValue}>FONTS.medium</Text>
        </View>
        <View style={styles.fontFamily}>
          <Text style={[styles.fontFamilyName, { fontFamily: FONTS.bold }]}>
            CabinetGrotesk Bold
          </Text>
          <Text style={styles.fontFamilyValue}>FONTS.bold</Text>
        </View>
      </TypographySection>

      {/* Font Weights */}
      <TypographySection title="Font Weights">
        {Object.entries(FONT_WEIGHTS).map(([name, weight]) => (
          <View key={name} style={styles.weightRow}>
            <Text style={[styles.weightSample, { fontWeight: weight }]}>
              Aa
            </Text>
            <View>
              <Text style={styles.weightName}>{name}</Text>
              <Text style={styles.weightValue}>{weight}</Text>
            </View>
          </View>
        ))}
      </TypographySection>

      {/* Headings */}
      <TypographySection title="Headings">
        <TypographySample name="h1" style={TYPOGRAPHY.h1} sampleText="Heading 1" />
        <TypographySample name="h2" style={TYPOGRAPHY.h2} sampleText="Heading 2" />
        <TypographySample name="h3" style={TYPOGRAPHY.h3} sampleText="Heading 3" />
        <TypographySample name="h4" style={TYPOGRAPHY.h4} sampleText="Heading 4" />
        <TypographySample name="h5" style={TYPOGRAPHY.h5} sampleText="Heading 5" />
        <TypographySample name="h6" style={TYPOGRAPHY.h6} sampleText="Heading 6" />
      </TypographySection>

      {/* Body Text */}
      <TypographySection title="Body Text">
        <TypographySample name="body" style={TYPOGRAPHY.body} />
        <TypographySample name="bodyMedium" style={TYPOGRAPHY.bodyMedium} />
        <TypographySample name="bodySmall" style={TYPOGRAPHY.bodySmall} />
      </TypographySection>

      {/* Caption & Labels */}
      <TypographySection title="Caption & Labels">
        <TypographySample name="caption" style={TYPOGRAPHY.caption} />
        <TypographySample name="captionBold" style={TYPOGRAPHY.captionBold} />
        <TypographySample name="label" style={TYPOGRAPHY.label} />
      </TypographySection>

      {/* Buttons */}
      <TypographySection title="Button Text">
        <TypographySample name="button" style={TYPOGRAPHY.button} sampleText="BUTTON TEXT" />
        <TypographySample name="buttonMedium" style={TYPOGRAPHY.buttonMedium} sampleText="Button Medium" />
      </TypographySection>
    </ScrollView>
  );
};

const meta: Meta<typeof TypographyComponent> = {
  title: 'Foundation/Typography',
  component: TypographyComponent,
};

export default meta;

type Story = StoryObj<typeof TypographyComponent>;

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
  sampleContainer: {
    marginBottom: 20,
    padding: 12,
    backgroundColor: COLORS.CARD_BG,
    borderRadius: 8,
  },
  sampleHeader: {
    marginBottom: 8,
  },
  sampleName: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.PRIMARY_BLUE,
    marginBottom: 2,
  },
  sampleMeta: {
    fontSize: 10,
    color: COLORS.SECONDARY_TEXT,
  },
  sampleText: {
    color: COLORS.WHITE,
  },
  fontFamily: {
    marginBottom: 16,
    padding: 12,
    backgroundColor: COLORS.CARD_BG,
    borderRadius: 8,
  },
  fontFamilyName: {
    fontSize: 20,
    color: COLORS.WHITE,
    marginBottom: 4,
  },
  fontFamilyValue: {
    fontSize: 11,
    color: COLORS.SECONDARY_TEXT,
  },
  weightRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    padding: 12,
    backgroundColor: COLORS.CARD_BG,
    borderRadius: 8,
  },
  weightSample: {
    fontSize: 32,
    color: COLORS.WHITE,
    marginRight: 16,
    width: 60,
  },
  weightName: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.VERY_LIGHT_GRAY,
  },
  weightValue: {
    fontSize: 12,
    color: COLORS.SECONDARY_TEXT,
  },
});
