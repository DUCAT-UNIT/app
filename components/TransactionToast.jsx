/**
 * TransactionToast Component
 * Displays transaction progress notifications at the top of the screen
 * Shows: Broadcasting → Pending → Confirmed states
 * Clickable to open transaction in explorer
 */

import React, { useEffect, useRef } from 'react';
import PropTypes from 'prop-types';
import { View, Text, Animated, ActivityIndicator, TouchableOpacity, Linking } from 'react-native';
import { COLORS } from '../utils/colors';
import Icon from './Icon';
import { getTxUrl, getOrdTxUrl } from '../utils/constants';

export default function TransactionToast({ visible, status, message, txid, assetType = 'BTC', onClose }) {
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
  }, [visible]);

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
    } catch (error) {
    }
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
      style={{
        position: 'absolute',
        top: 60, // Below Mutinynet banner (moved down from 40)
        left: 16,
        right: 16,
        borderRadius: 20, // Increased from 12
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
        elevation: 5,
        zIndex: 999,
        transform: [{ translateY: slideAnim }],
        opacity: opacity,
      }}
    >
      <TouchableOpacity
        onPress={handlePress}
        disabled={!txid}
        activeOpacity={txid ? 0.7 : 1}
        style={{
          backgroundColor: config.backgroundColor,
          borderRadius: 20,
          padding: 16,
          flexDirection: 'row',
          alignItems: 'center',
        }}
      >
        {config.showSpinner && (
          <ActivityIndicator
            size="small"
            color={status === 'pending' ? COLORS.DARK_BG : COLORS.PRIMARY_BLUE}
            style={{ marginRight: 12 }}
          />
        )}

        {config.icon && (
          <View style={{ marginRight: 12 }}>
            <Icon name={config.icon} size={20} color={config.textColor} />
          </View>
        )}

        <View style={{ flex: 1 }}>
          <Text
            style={{
              fontSize: 14,
              fontFamily: 'CabinetGrotesk-Medium',
              color: config.textColor,
              marginBottom: txid ? 4 : 0,
            }}
          >
            {message}
          </Text>

          {txid && (status === 'confirmed' || status === 'pending') && (
            <Text
              style={{
                fontSize: 11,
                fontFamily: 'CabinetGrotesk-Regular',
                color: config.textColor,
                opacity: 0.8,
              }}
              numberOfLines={1}
            >
              {txid.substring(0, 8)}...{txid.substring(txid.length - 8)}
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
            style={{ marginLeft: 8, padding: 4 }}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Icon name="delete" size={16} color={config.textColor} />
          </TouchableOpacity>
        )}
      </TouchableOpacity>
    </Animated.View>
  );
}

TransactionToast.propTypes = {
  visible: PropTypes.bool.isRequired,
  status: PropTypes.oneOf(['broadcasting', 'pending', 'confirmed', 'error']).isRequired,
  message: PropTypes.string.isRequired,
  txid: PropTypes.string,
  assetType: PropTypes.oneOf(['BTC', 'UNIT']),
  onClose: PropTypes.func,
};
