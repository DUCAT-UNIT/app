import React from 'react';
import { Image, Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../theme';
import { QUANTA_POINTS } from './quantaLinkAssets';
import { quantaLinkStyles as localStyles } from './quantaLinkStyles';
import { formatPoints } from './quantaLinkUtils';

interface QuantaConnectedPanelProps {
  connectedPoints: number;
  connectedRankLabel: string;
  connectedTasks: number;
  displayedWalletAddressLabel: string;
  displayedWalletAddressPreview: string;
  isDisconnectingReward: boolean;
  onDisconnect: () => void;
  showAddressBox: boolean;
  statusBanner: React.ReactNode;
}

export function QuantaConnectedPanel({
  connectedPoints,
  connectedRankLabel,
  connectedTasks,
  displayedWalletAddressLabel,
  displayedWalletAddressPreview,
  isDisconnectingReward,
  onDisconnect,
  showAddressBox,
  statusBanner,
}: QuantaConnectedPanelProps): React.ReactElement {
  return (
    <View style={localStyles.bottomHalf}>
      <View style={localStyles.connectedSummary}>
        {statusBanner}
        {showAddressBox && (
          <View style={localStyles.connectedAddressBox}>
            <Text style={localStyles.addressLabel}>{displayedWalletAddressLabel}</Text>
            <Text style={localStyles.addressValue} numberOfLines={1} selectable>
              {displayedWalletAddressPreview}
            </Text>
          </View>
        )}
        <View style={localStyles.connectedMetric}>
          <View style={localStyles.connectedPointsRow}>
            <Text style={localStyles.connectedPointsValue} numberOfLines={1} adjustsFontSizeToFit>
              {formatPoints(connectedPoints)}
            </Text>
            <Image
              source={QUANTA_POINTS}
              resizeMode="contain"
              style={localStyles.connectedPointsIcon}
            />
          </View>
          <Text style={localStyles.connectedMetricLabel}>Quanta Points</Text>
        </View>
        <View style={localStyles.connectedStatsGrid}>
          <View style={localStyles.connectedStatBlock}>
            <Text style={localStyles.connectedStatValue}>{formatPoints(connectedTasks)}</Text>
            <Text style={localStyles.connectedStatLabel}>Tasks Completed</Text>
          </View>
          <View style={localStyles.connectedStatDivider} />
          <View style={localStyles.connectedStatBlock}>
            <Text style={localStyles.connectedStatValue}>{connectedRankLabel}</Text>
            <Text style={localStyles.connectedStatLabel}>Ranking</Text>
          </View>
        </View>
        <Pressable
          accessibilityLabel="Disconnect Quanta wallet"
          accessibilityRole="button"
          disabled={isDisconnectingReward}
          onPress={onDisconnect}
          style={[
            localStyles.disconnectButton,
            isDisconnectingReward && localStyles.disconnectButtonDisabled,
          ]}
          testID="quanta-disconnect-button"
        >
          <Ionicons
            name="log-out-outline"
            size={17}
            color={isDisconnectingReward ? COLORS.TEXT_SECONDARY : COLORS.ERROR}
          />
          <Text
            style={[
              localStyles.disconnectButtonText,
              isDisconnectingReward && localStyles.disconnectButtonTextDisabled,
            ]}
          >
            {isDisconnectingReward ? 'Disconnecting...' : 'Disconnect wallet'}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
