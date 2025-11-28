import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import type { Meta, StoryObj } from '@storybook/react';
import { COLORS, BORDER_RADIUS } from '../../../theme';
import Icon from '../../../components/icons';

// ============================================================================
// DEVICE SIZE CONFIG
// ============================================================================
const DEVICE_SIZES = {
  XS: { width: 320, label: 'XS', subtitle: 'iPhone 5', fontSize: 12, paddingV: 6, paddingH: 12, iconSize: 14, iconMargin: 12 },
  S: { width: 375, label: 'S', subtitle: 'iPhone SE/8', fontSize: 13, paddingV: 7, paddingH: 14, iconSize: 16, iconMargin: 16 },
  M: { width: 390, label: 'M', subtitle: 'iPhone 12/13/14', fontSize: 14, paddingV: 8, paddingH: 16, iconSize: 18, iconMargin: 20 },
  L: { width: 393, label: 'L', subtitle: 'iPhone 14 Pro', fontSize: 14, paddingV: 8, paddingH: 16, iconSize: 18, iconMargin: 20 },
  XL: { width: 430, label: 'XL', subtitle: 'iPhone 16 Pro Max', fontSize: 15, paddingV: 10, paddingH: 18, iconSize: 20, iconMargin: 22 },
};

type DeviceSize = keyof typeof DEVICE_SIZES;
type DeviceConfig = typeof DEVICE_SIZES[DeviceSize];

// ============================================================================
// SCALED BANNER COMPONENTS (for Storybook only)
// ============================================================================
const ScaledMutinynetBanner = ({ config }: { config: DeviceConfig }) => (
  <View style={[scaledStyles.mutinynetBanner, { paddingVertical: config.paddingV }]}>
    <Text style={[scaledStyles.mutinynetBannerText, { fontSize: config.fontSize }]}>
      Mutinynet Edition
    </Text>
  </View>
);

const ScaledErrorBanner = ({ config, errorMessage }: { config: DeviceConfig; errorMessage: string }) => (
  <TouchableOpacity
    style={[
      scaledStyles.errorBanner,
      {
        paddingVertical: config.paddingV + 2,
        paddingHorizontal: config.paddingH,
        marginHorizontal: config.paddingH,
      },
    ]}
    activeOpacity={0.8}
  >
    <View style={[scaledStyles.errorIconContainer, { marginRight: config.iconMargin }]}>
      <Icon name="warning" size={config.iconSize} color={COLORS.DANGER_RED} />
    </View>
    <Text style={[scaledStyles.errorText, { fontSize: config.fontSize - 1 }]}>{errorMessage}</Text>
  </TouchableOpacity>
);

// ============================================================================
// MUTINYNET BANNER STORY
// ============================================================================
interface MutinynetBannerStoryProps {
  deviceSize: DeviceSize;
}

const MutinynetBannerStory = ({ deviceSize }: MutinynetBannerStoryProps) => {
  const config = DEVICE_SIZES[deviceSize];
  return (
    <View style={localStyles.centeredContainer}>
      <Text style={localStyles.sizeIndicator}>{config.label} {config.width}px</Text>
      <View style={localStyles.fullWidthContainer}>
        <ScaledMutinynetBanner config={config} />
      </View>
    </View>
  );
};

// ============================================================================
// ERROR BANNER STORY
// ============================================================================
interface ErrorBannerStoryProps {
  deviceSize: DeviceSize;
  errorMessage: string;
}

const ErrorBannerStory = ({ deviceSize, errorMessage }: ErrorBannerStoryProps) => {
  const config = DEVICE_SIZES[deviceSize];
  return (
    <View style={localStyles.centeredContainer}>
      <Text style={localStyles.sizeIndicator}>{config.label} {config.width}px</Text>
      <View style={{ width: config.width }}>
        <ScaledErrorBanner config={config} errorMessage={errorMessage} />
      </View>
    </View>
  );
};

// ============================================================================
// ALL BANNERS STORY
// ============================================================================
interface AllBannersStoryProps {
  deviceSize: DeviceSize;
}

const AllBannersStory = ({ deviceSize }: AllBannersStoryProps) => {
  const config = DEVICE_SIZES[deviceSize];
  return (
    <View style={localStyles.centeredContainer}>
      <Text style={localStyles.sizeIndicator}>{config.label} {config.width}px</Text>
      <View style={localStyles.bannerList}>
        <View style={localStyles.fullWidthContainer}>
          <ScaledMutinynetBanner config={config} />
        </View>
        <View style={{ width: config.width }}>
          <ScaledErrorBanner config={config} errorMessage="Failed to fetch balance. Tap to retry." />
        </View>
      </View>
    </View>
  );
};

// ============================================================================
// DEVICE SIZE OVERVIEW STORY
// ============================================================================
const DeviceSizeOverviewStory = () => (
  <ScrollView contentContainerStyle={localStyles.overviewScrollContent}>
    {Object.entries(DEVICE_SIZES).map(([key, config]) => (
      <View key={key} style={localStyles.deviceSection}>
        <View style={localStyles.deviceHeader}>
          <Text style={localStyles.deviceLabel}>{config.label}</Text>
          <Text style={localStyles.deviceWidth}>{config.subtitle} ({config.width}px)</Text>
        </View>
        <View style={localStyles.bannerList}>
          <ScaledMutinynetBanner config={config} />
          <View style={{ width: config.width }}>
            <ScaledErrorBanner config={config} errorMessage="Failed to fetch balance. Tap to retry." />
          </View>
        </View>
      </View>
    ))}
  </ScrollView>
);

// ============================================================================
// STORYBOOK META
// ============================================================================
const meta: Meta<typeof MutinynetBannerStory> = {
  title: 'Components/Banners',
  component: MutinynetBannerStory,
  argTypes: {
    deviceSize: {
      control: 'select',
      options: ['XS', 'S', 'M', 'L', 'XL'],
      description: 'Device size preset',
    },
  },
};

export default meta;
type Story = StoryObj<typeof MutinynetBannerStory>;

export const MutinynetBanner: Story = {
  args: {
    deviceSize: 'M',
  },
};

export const ErrorBanner_: Story = {
  render: (args) => (
    <ErrorBannerStory
      deviceSize={args.deviceSize || 'M'}
      errorMessage={args.errorMessage || 'Failed to fetch balance. Tap to retry.'}
    />
  ),
  args: {
    deviceSize: 'M',
    errorMessage: 'Failed to fetch balance. Tap to retry.',
  },
  argTypes: {
    deviceSize: {
      control: 'select',
      options: ['XS', 'S', 'M', 'L', 'XL'],
      description: 'Device size preset',
    },
    errorMessage: {
      control: 'text',
      description: 'Error message to display',
    },
  },
};

export const AllBanners: Story = {
  render: (args) => <AllBannersStory deviceSize={args.deviceSize || 'M'} />,
  args: {
    deviceSize: 'M',
  },
};

export const DeviceSizeOverview: Story = {
  render: () => <DeviceSizeOverviewStory />,
  parameters: {
    controls: { disable: true },
  },
};

// ============================================================================
// SCALED BANNER STYLES
// ============================================================================
const scaledStyles = StyleSheet.create({
  mutinynetBanner: {
    backgroundColor: COLORS.CARD_BG,
    paddingHorizontal: 0,
    width: '100%',
    alignSelf: 'stretch',
    alignItems: 'center',
  },
  mutinynetBannerText: {
    color: COLORS.PURPLE,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.ERROR_BG,
    borderLeftWidth: 3,
    borderLeftColor: COLORS.DANGER_RED,
    marginTop: 8,
    borderRadius: BORDER_RADIUS.md,
  },
  errorIconContainer: {},
  errorText: {
    flex: 1,
    color: COLORS.DANGER_RED,
    fontWeight: '500',
  },
});

// ============================================================================
// LOCAL STYLES
// ============================================================================
const localStyles = StyleSheet.create({
  centeredContainer: {
    flex: 1,
    position: 'relative',
    backgroundColor: COLORS.DARK_BG,
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sizeIndicator: {
    position: 'absolute',
    top: 16,
    right: 16,
    fontSize: 12,
    color: COLORS.SECONDARY_TEXT,
    fontWeight: '600',
  },
  bannerList: {
    gap: 8,
  },
  fullWidthContainer: {
    width: '100%',
    alignSelf: 'stretch',
  },
  overviewScrollContent: {
    backgroundColor: COLORS.DARK_BG,
    padding: 20,
    paddingTop: 40,
    flexGrow: 1,
    gap: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deviceSection: {
    gap: 8,
    alignItems: 'center',
  },
  deviceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  deviceLabel: {
    fontSize: 13,
    color: COLORS.WHITE,
    fontWeight: '700',
  },
  deviceWidth: {
    fontSize: 12,
    color: COLORS.SECONDARY_TEXT,
    fontWeight: '500',
  },
});
