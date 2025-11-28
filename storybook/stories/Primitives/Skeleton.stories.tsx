import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import type { Meta, StoryObj } from '@storybook/react';
import { COLORS } from '../../../theme';
import SkeletonLoader from '../../../components/ui/SkeletonLoader';
import Icon from '../../../components/icons';

// ============================================================================
// OVERVIEW
// ============================================================================
const OverviewStory = () => (
  <View style={styles.container}>
    <Text style={styles.title}>Skeleton Overview</Text>
    <Text style={styles.description}>Animated loading placeholders. Select a pattern from the sidebar for detailed examples.</Text>

    <View style={styles.overviewGrid}>
      {[
        { label: 'Circle', width: 48, height: 48, radius: 24 },
        { label: 'Square', width: 48, height: 48, radius: 8 },
        { label: 'Text', width: 120, height: 16, radius: 4 },
        { label: 'Pill', width: 80, height: 32, radius: 16 },
      ].map(({ label, width, height, radius }) => (
        <View key={label} style={styles.overviewItem}>
          <SkeletonLoader width={width} height={height} borderRadius={radius} />
          <Text style={styles.overviewLabel}>{label}</Text>
        </View>
      ))}
    </View>
  </View>
);

// ============================================================================
// BASIC SHAPES
// ============================================================================
const ShapesStory = () => (
  <View style={styles.container}>
    <Text style={styles.title}>Basic Shapes</Text>
    <Text style={styles.description}>Fundamental skeleton shapes. Use borderRadius to create different shapes.</Text>

    <View style={styles.shapesGrid}>
      <View style={styles.shapeItem}>
        <SkeletonLoader width={80} height={80} borderRadius={8} />
        <Text style={styles.shapeLabel}>Square</Text>
        <Text style={styles.shapeSpec}>borderRadius: 8</Text>
      </View>
      <View style={styles.shapeItem}>
        <SkeletonLoader width={80} height={80} borderRadius={40} />
        <Text style={styles.shapeLabel}>Circle</Text>
        <Text style={styles.shapeSpec}>borderRadius: width/2</Text>
      </View>
      <View style={styles.shapeItem}>
        <SkeletonLoader width={120} height={48} borderRadius={8} />
        <Text style={styles.shapeLabel}>Rectangle</Text>
        <Text style={styles.shapeSpec}>borderRadius: 8</Text>
      </View>
      <View style={styles.shapeItem}>
        <SkeletonLoader width={120} height={48} borderRadius={24} />
        <Text style={styles.shapeLabel}>Pill</Text>
        <Text style={styles.shapeSpec}>borderRadius: height/2</Text>
      </View>
    </View>
  </View>
);

// ============================================================================
// AVATARS
// ============================================================================
const AvatarsStory = () => (
  <View style={styles.container}>
    <Text style={styles.title}>Avatar Sizes</Text>
    <Text style={styles.description}>Common avatar placeholder sizes used throughout the app.</Text>

    <View style={styles.avatarRow}>
      {[24, 32, 40, 48, 64].map(size => (
        <View key={size} style={styles.avatarItem}>
          <SkeletonLoader width={size} height={size} borderRadius={size / 2} />
          <Text style={styles.avatarSize}>{size}px</Text>
        </View>
      ))}
    </View>
  </View>
);

// ============================================================================
// TEXT LINES
// ============================================================================
const TextStory = () => (
  <View style={styles.container}>
    <Text style={styles.title}>Text Placeholders</Text>
    <Text style={styles.description}>Use varying widths for natural text appearance.</Text>

    <Text style={styles.sectionLabel}>HEADING</Text>
    <SkeletonLoader width={200} height={24} borderRadius={4} />

    <Text style={styles.sectionLabel}>PARAGRAPH</Text>
    <View style={styles.textBlock}>
      <SkeletonLoader width="100%" height={16} borderRadius={4} />
      <SkeletonLoader width="95%" height={16} borderRadius={4} />
      <SkeletonLoader width="85%" height={16} borderRadius={4} />
      <SkeletonLoader width="60%" height={16} borderRadius={4} />
    </View>

    <Text style={styles.sectionLabel}>LABEL + VALUE</Text>
    <View style={styles.labelValue}>
      <SkeletonLoader width={80} height={14} borderRadius={4} />
      <SkeletonLoader width={60} height={14} borderRadius={4} />
    </View>
  </View>
);

// ============================================================================
// CARD PATTERN
// ============================================================================
const CardStory = () => (
  <View style={styles.container}>
    <Text style={styles.title}>Card Skeleton</Text>
    <Text style={styles.description}>Common card loading pattern with avatar, title, and content.</Text>

    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <SkeletonLoader width={48} height={48} borderRadius={24} />
        <View style={styles.cardHeaderText}>
          <SkeletonLoader width={120} height={16} borderRadius={4} />
          <SkeletonLoader width={80} height={12} borderRadius={4} style={{ marginTop: 8 }} />
        </View>
      </View>
      <View style={styles.cardContent}>
        <SkeletonLoader width="100%" height={14} borderRadius={4} />
        <SkeletonLoader width="90%" height={14} borderRadius={4} style={{ marginTop: 8 }} />
      </View>
    </View>
  </View>
);

// ============================================================================
// LIST PATTERN
// ============================================================================
const ListStory = () => (
  <View style={styles.container}>
    <Text style={styles.title}>List Skeleton</Text>
    <Text style={styles.description}>Repeating list item placeholders.</Text>

    <View style={styles.list}>
      {[1, 2, 3, 4].map(i => (
        <View key={i} style={styles.listItem}>
          <SkeletonLoader width={40} height={40} borderRadius={20} />
          <View style={styles.listItemText}>
            <SkeletonLoader width={140} height={14} borderRadius={4} />
            <SkeletonLoader width={100} height={12} borderRadius={4} style={{ marginTop: 6 }} />
          </View>
          <SkeletonLoader width={60} height={14} borderRadius={4} />
        </View>
      ))}
    </View>
  </View>
);

// ============================================================================
// INTERACTIVE DEMO
// ============================================================================
const InteractiveStory = () => {
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const interval = setInterval(() => setIsLoading(prev => !prev), 3000);
    return () => clearInterval(interval);
  }, []);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Loading Transition</Text>
      <Text style={styles.description}>See how skeleton transitions to real content. Toggles every 3 seconds.</Text>

      <View style={styles.demoCard}>
        <View style={styles.demoStatus}>
          <View style={[styles.statusDot, { backgroundColor: isLoading ? COLORS.WARNING_ORANGE : COLORS.SUCCESS_GREEN }]} />
          <Text style={styles.statusText}>{isLoading ? 'Loading...' : 'Loaded'}</Text>
        </View>

        {isLoading ? (
          <View style={styles.cardHeader}>
            <SkeletonLoader width={48} height={48} borderRadius={24} />
            <View style={styles.cardHeaderText}>
              <SkeletonLoader width={100} height={16} borderRadius={4} />
              <SkeletonLoader width={80} height={12} borderRadius={4} style={{ marginTop: 8 }} />
            </View>
          </View>
        ) : (
          <View style={styles.cardHeader}>
            <View style={styles.avatar}><Icon name="btc_logo" size={32} /></View>
            <View style={styles.cardHeaderText}>
              <Text style={styles.loadedTitle}>Bitcoin</Text>
              <Text style={styles.loadedSubtitle}>0.054 BTC</Text>
            </View>
          </View>
        )}

        <TouchableOpacity style={styles.toggleBtn} onPress={() => setIsLoading(p => !p)}>
          <Text style={styles.toggleText}>Toggle</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

// ============================================================================
// STORYBOOK META
// ============================================================================
const meta: Meta = {
  title: 'Primitives/Skeleton',
};

export default meta;
type Story = StoryObj;

export const Overview: Story = { render: () => <OverviewStory /> };
export const Shapes: Story = { render: () => <ShapesStory /> };
export const Avatars: Story = { render: () => <AvatarsStory /> };
export const TextLines: Story = { render: () => <TextStory /> };
export const Card: Story = { render: () => <CardStory /> };
export const List: Story = { render: () => <ListStory /> };
export const Interactive: Story = { render: () => <InteractiveStory /> };

// ============================================================================
// STYLES - Using app borderRadius (12) for cards
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
    marginTop: 32,
  },

  // Overview
  overviewGrid: {
    flexDirection: 'row',
    gap: 32,
  },
  overviewItem: {
    alignItems: 'center',
    gap: 12,
  },
  overviewLabel: {
    fontSize: 12,
    color: COLORS.SECONDARY_TEXT,
  },

  // Shapes
  shapesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 24,
  },
  shapeItem: {
    alignItems: 'center',
    gap: 8,
  },
  shapeLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.WHITE,
  },
  shapeSpec: {
    fontSize: 11,
    color: COLORS.SECONDARY_TEXT,
  },

  // Avatars
  avatarRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 20,
  },
  avatarItem: {
    alignItems: 'center',
    gap: 8,
  },
  avatarSize: {
    fontSize: 11,
    color: COLORS.SECONDARY_TEXT,
  },

  // Text
  textBlock: {
    gap: 8,
  },
  labelValue: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },

  // Card
  card: {
    backgroundColor: COLORS.CARD_BG,
    borderRadius: 12,
    padding: 16,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cardHeaderText: {
    marginLeft: 12,
    flex: 1,
  },
  cardContent: {
    marginTop: 16,
  },

  // List
  list: {
    gap: 8,
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.CARD_BG,
    padding: 12,
    borderRadius: 12,
  },
  listItemText: {
    flex: 1,
    marginLeft: 12,
  },

  // Interactive
  demoCard: {
    backgroundColor: COLORS.CARD_BG,
    borderRadius: 12,
    padding: 16,
  },
  demoStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 13,
    color: COLORS.WHITE,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.BORDER_COLOR,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadedTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.WHITE,
  },
  loadedSubtitle: {
    fontSize: 13,
    color: COLORS.SECONDARY_TEXT,
    marginTop: 2,
  },
  toggleBtn: {
    marginTop: 16,
    alignItems: 'center',
    padding: 10,
    backgroundColor: COLORS.BG_SECONDARY,
    borderRadius: 8,
  },
  toggleText: {
    fontSize: 13,
    color: COLORS.PRIMARY_BLUE,
    fontWeight: '600',
  },
});
