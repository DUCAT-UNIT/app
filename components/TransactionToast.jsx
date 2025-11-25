/**
 * TransactionToast Component
 * Displays transaction progress notifications at the top of the screen
 * Shows: Broadcasting → Pending → Confirmed states
 * Clickable to open transaction in explorer
 */

import React, { useEffect, useRef } from 'react';
import PropTypes from 'prop-types';
import { View, Text, Animated, ActivityIndicator, TouchableOpacity, Linking, StyleSheet } from 'react-native';
import { COLORS } from '../theme';
import Icon from './icons';
import { getTxUrl, getOrdTxUrl } from '../utils/constants';
import { truncateAddress } from '../utils/formatters/addresses';

export default function TransactionToast({
  visible,
  status,
  message,
  txid,
  assetType = 'BTC',
  onClose,
}) {
  const slideAnim = useRef(new Animated.Value(-100)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      // Slide in from top
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      // Slide out to top
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: -100,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible, slideAnim, opacity]);

  if (!visible) return null;

  const handlePress = async () => {
    if (!txid) return;

    try {
      // Use ord explorer for UNIT transactions, regular explorer for BTC
      const url = assetType === 'UNIT' ? getOrdTxUrl(txid) : getTxUrl(txid);

      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
      }
    } catch (error) {}
  };

  // Determine styles based on status
  const getStatusConfig = () => {
    switch (status) {
      case 'broadcasting':
        return {
          backgroundColor: COLORS.CARD_BG,
          icon: null,
          showSpinner: true,
          textColor: COLORS.VERY_LIGHT_GRAY,
        };
      case 'pending':
        return {
          backgroundColor: COLORS.YELLOW,
          icon: null,
          showSpinner: true,
          textColor: COLORS.DARK_BG,
        };
      case 'confirmed':
        return {
          backgroundColor: COLORS.TEAL,
          icon: 'done',
          showSpinner: false,
          textColor: COLORS.WHITE,
        };
      case 'error':
        return {
          backgroundColor: COLORS.DANGER_RED,
          icon: 'delete',
          showSpinner: false,
          textColor: COLORS.WHITE,
        };
      default:
        return {
          backgroundColor: COLORS.CARD_BG,
          icon: null,
          showSpinner: false,
          textColor: COLORS.VERY_LIGHT_GRAY,
        };
    }
  };

  const config = getStatusConfig();

  return (
    <Animated.View
      style={[
        localStyles.toastContainer,
        {
          transform: [{ translateY: slideAnim }],
          opacity: opacity,
        },
      ]}
    >
      <TouchableOpacity
        onPress={handlePress}
        disabled={!txid}
        activeOpacity={txid ? 0.7 : 1}
        style={[localStyles.toastContent, { backgroundColor: config.backgroundColor }]}
      >
        {config.showSpinner && (
          <ActivityIndicator
            size="small"
            color={status === 'pending' ? COLORS.DARK_BG : COLORS.PRIMARY_BLUE}
            style={localStyles.spinner}
          />
        )}

        {config.icon && (
          <View style={localStyles.iconContainer}>
            <Icon name={config.icon} size={20} color={config.textColor} />
          </View>
        )}

        <View style={localStyles.textContainer}>
          <Text
            style={[
              localStyles.messageText,
              { color: config.textColor },
              txid && localStyles.messageWithTxid,
            ]}
          >
            {message}
          </Text>

          {txid && (status === 'confirmed' || status === 'pending') && (
            <Text style={[localStyles.txidText, { color: config.textColor }]} numberOfLines={1}>
              {truncateAddress(txid, 8, 8)}
            </Text>
          )}
        </View>

        {/* Close button - only show for pending state */}
        {status === 'pending' && onClose && (
          <TouchableOpacity
            onPress={(e) => {
              e.stopPropagation();
              onClose();
            }}
            style={localStyles.closeButton}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Icon name="delete" size={16} color={config.textColor} />
          </TouchableOpacity>
        )}
      </TouchableOpacity>
    </Animated.View>
  );
}

const localStyles = StyleSheet.create({
  toastContainer: {
    position: 'absolute',
    top: 60,
    left: 16,
    right: 16,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
    zIndex: 999,
  },
  toastContent: {
    borderRadius: 20,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  spinner: {
    marginRight: 12,
  },
  iconContainer: {
    marginRight: 12,
  },
  textContainer: {
    flex: 1,
  },
  messageText: {
    fontSize: 14,
    fontFamily: 'CabinetGrotesk-Medium',
  },
  messageWithTxid: {
    marginBottom: 4,
  },
  txidText: {
    fontSize: 11,
    fontFamily: 'CabinetGrotesk-Regular',
    opacity: 0.8,
  },
  closeButton: {
    marginLeft: 8,
    padding: 4,
  },
});

TransactionToast.propTypes = {
  visible: PropTypes.bool.isRequired,
  status: PropTypes.oneOf(['broadcasting', 'pending', 'confirmed', 'error']).isRequired,
  message: PropTypes.string.isRequired,
  txid: PropTypes.string,
  assetType: PropTypes.oneOf(['BTC', 'UNIT']),
  onClose: PropTypes.func,
};
