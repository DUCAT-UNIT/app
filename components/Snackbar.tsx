/**
 * Snackbar Component
 * Unified notification system with icons for different states
 * Adapted from frontend-app toast design
 */

import React,{ useCallback,useEffect } from 'react';
import { Animated,Linking,StyleSheet,Text,TouchableOpacity,View } from 'react-native';
import Svg,{ Circle,Path } from 'react-native-svg';
import { COLORS } from '../theme';
import type { SnackbarParams,SnackbarType } from '../types/notification';
import { logger } from '../utils/logger';

/**
 * Action labels for transaction types
 */
const ACTION_LABELS: Record<string, string> = {
  deposit: 'BTC Deposit',
  withdraw: 'BTC Withdraw',
  borrow: 'UNIT Borrow',
  repay: 'UNIT Repay',
  create: 'Vault Create',
  faucet: 'Testnet Coins',
  swap: 'Turbo UNIT Swap',
  btc_swap: 'Turbo BTC Swap',
  unit_send: 'UNIT Transaction',
  btc_send: 'BTC Transaction',
  claim: 'UNIT Claim',
  btc_claim: 'BTC Claim',
  liquidation: 'Vault Liquidation',
  repossess: 'Liquidation Claim',
  conversion_turbo: 'Conversion to Turbo Unit',
  convert: 'TurboUNIT Conversion',
};

/**
 * SVG Icons for each snackbar type
 */
const Icons = {
  Success: () => (
    <Svg width={18} height={18} viewBox="0 0 18 18" fill="none">
      <Circle cx={9} cy={9} r={9} fill={COLORS.SUCCESS_GREEN} />
      <Path
        d="M5.5 9L8 11.5L12.5 6.5"
        stroke={COLORS.WHITE}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  ),
  Error: () => (
    <Svg width={18} height={18} viewBox="0 0 18 18" fill="none">
      <Circle cx={9} cy={9} r={9} fill={COLORS.DANGER_RED} />
      <Path
        d="M9 5V10"
        stroke={COLORS.WHITE}
        strokeWidth={2}
        strokeLinecap="round"
      />
      <Circle cx={9} cy={13} r={1} fill={COLORS.WHITE} />
    </Svg>
  ),
  Warning: () => (
    <Svg width={18} height={18} viewBox="0 0 18 18" fill="none">
      <Path
        d="M9 1L17 16H1L9 1Z"
        fill={COLORS.YELLOW}
      />
      <Path
        d="M9 6V10"
        stroke={COLORS.TEXT_BLACK}
        strokeWidth={1.5}
        strokeLinecap="round"
      />
      <Circle cx={9} cy={13} r={1} fill={COLORS.TEXT_BLACK} />
    </Svg>
  ),
  Info: () => (
    <Svg width={18} height={18} viewBox="0 0 18 18" fill="none">
      <Circle cx={9} cy={9} r={9} fill={COLORS.PRIMARY_BLUE} />
      <Circle cx={9} cy={5} r={1} fill={COLORS.WHITE} />
      <Path
        d="M9 8V13"
        stroke={COLORS.WHITE}
        strokeWidth={2}
        strokeLinecap="round"
      />
    </Svg>
  ),
  Progress: () => (
    <Svg width={18} height={18} viewBox="0 0 18 18" fill="none">
      <Circle
        cx={9}
        cy={9}
        r={7}
        stroke={COLORS.PRIMARY_BLUE}
        strokeWidth={2}
        strokeDasharray="11 33"
        strokeLinecap="round"
      />
    </Svg>
  ),
  Close: () => (
    <Svg width={14} height={14} viewBox="0 0 14 14" fill="none">
      <Path
        d="M1 1L13 13M13 1L1 13"
        stroke={COLORS.LIGHT_GRAY}
        strokeWidth={2}
        strokeLinecap="round"
      />
    </Svg>
  ),
};

/**
 * Map snackbar types to their icons
 */
const TYPE_TO_ICON: Record<SnackbarType, keyof typeof Icons> = {
  success: 'Success',
  submitted: 'Success',
  error: 'Error',
  warning: 'Warning',
  info: 'Info',
  progress: 'Progress',
  pending: 'Progress',
};

/**
 * Success messages for specific actions
 */
const SUCCESS_MESSAGES: Record<string, string> = {
  deposit: 'BTC successfully deposited to vault',
  withdraw: 'BTC successfully withdrawn from vault',
  borrow: 'UNIT successfully borrowed',
  repay: 'UNIT debt successfully repaid',
  create: 'Vault created successfully',
  faucet: 'Testnet coins received',
  swap: 'Turbo UNIT swap completed',
  btc_swap: 'Turbo BTC swap completed',
  unit_send: 'UNIT transaction confirmed',
  btc_send: 'BTC transaction confirmed',
  claim: 'UNIT claimed successfully',
  btc_claim: 'BTC claimed successfully',
  liquidation: 'Vault liquidation processed',
  repossess: 'Liquidation claim completed',
  conversion_turbo: 'Converted to Turbo UNIT',
  convert: 'TurboUNIT conversion completed',
};

/**
 * Compute title based on type and action
 */
const computeTitle = (type: SnackbarType, label: string, action?: string): string => {
  switch (type) {
    case 'pending':
    case 'progress':
      return `${label} in progress...`;
    case 'submitted':
      return `${label} submitted`;
    case 'success':
      // Use specific success message if available
      if (action && SUCCESS_MESSAGES[action]) {
        return SUCCESS_MESSAGES[action];
      }
      return `${label} completed successfully`;
    case 'error':
      return `${label} failed`;
    case 'warning':
      return `${label} warning`;
    case 'info':
      return label;
    default:
      return label;
  }
};

interface SnackbarProps {
  params: SnackbarParams;
  onClose: () => void;
}

export default function Snackbar({ params, onClose }: SnackbarProps) {
  logger.debug('🎯 Snackbar rendering with params:', params);

  const slideAnim = React.useRef(new Animated.Value(-200)).current;
  const spinAnim = React.useRef(new Animated.Value(0)).current;

  const {
    type = 'info',
    action,
    title: titleOverride,
    message: messageOverride,
    description,
    onPress,
    actionButtons,
    actionLinks,
  } = params;

  const isSpinning = type === 'progress' || type === 'pending';
  const label = action ? (ACTION_LABELS[action] || 'Transaction') : 'Notification';
  const title = titleOverride || messageOverride || computeTitle(type, label, action);
  const IconComponent = Icons[TYPE_TO_ICON[type]];

  useEffect(() => {
    logger.debug('🎯 Snackbar mounted, starting animation');

    // Slide in animation
    Animated.spring(slideAnim, {
      toValue: 0,
      useNativeDriver: true,
      tension: 65,
      friction: 10,
    }).start();

    // Spin animation for progress type
    if (isSpinning) {
      Animated.loop(
        Animated.timing(spinAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        })
      ).start();
    }
  }, [slideAnim, spinAnim, isSpinning]);

  const handleClose = useCallback(() => {
    Animated.timing(slideAnim, {
      toValue: -200,
      duration: 300,
      useNativeDriver: true,
    }).start(() => {
      onClose();
    });
  }, [slideAnim, onClose]);

  const handleLinkPress = useCallback((url?: string, linkOnPress?: () => void) => {
    if (linkOnPress) {
      linkOnPress();
    } else if (url) {
      Linking.openURL(url).catch((err) => {
        logger.error('Failed to open URL:', err);
      });
    }
  }, []);

  const spinStyle = isSpinning
    ? {
        transform: [
          {
            rotate: spinAnim.interpolate({
              inputRange: [0, 1],
              outputRange: ['0deg', '360deg'],
            }),
          },
        ],
      }
    : {};

  return (
    <Animated.View
      style={[
        styles.container,
        {
          transform: [{ translateY: slideAnim }],
        },
      ]}
    >
      <View style={styles.content}>
        {/* Icon */}
        <Animated.View style={[styles.iconContainer, spinStyle]}>
          <IconComponent />
        </Animated.View>

        {/* Text Content */}
        <View style={styles.textContainer}>
          <View style={styles.headerRow}>
            <Text style={styles.title} numberOfLines={2}>
              {title}
            </Text>
            <TouchableOpacity
              onPress={handleClose}
              style={styles.closeButton}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              accessibilityLabel="Close notification"
              accessibilityRole="button"
            >
              <Icons.Close />
            </TouchableOpacity>
          </View>

          {description && (
            <Text style={styles.description} numberOfLines={3}>
              {description}
            </Text>
          )}

          {/* Action Buttons */}
          {actionButtons && actionButtons.length > 0 && (
            <View style={styles.actionsContainer}>
              {actionButtons.map((button, index) => (
                <TouchableOpacity
                  key={`${button.label}-${index}`}
                  style={[
                    styles.actionButton,
                    button.variant === 'primary'
                      ? styles.primaryButton
                      : styles.secondaryButton,
                  ]}
                  onPress={button.onPress}
                >
                  <Text
                    style={[
                      styles.actionButtonText,
                      button.variant === 'primary'
                        ? styles.primaryButtonText
                        : styles.secondaryButtonText,
                    ]}
                  >
                    {button.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* Action Links */}
          {actionLinks && actionLinks.length > 0 && (
            <View style={styles.linksContainer}>
              {actionLinks.map((link, index) => (
                <TouchableOpacity
                  key={`${link.label}-${index}`}
                  style={styles.linkButton}
                  onPress={() => handleLinkPress(link.url, link.onPress)}
                >
                  <Text style={styles.linkText}>{link.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* Legacy onPress support */}
          {onPress && !actionLinks && !actionButtons && (
            <TouchableOpacity onPress={onPress} style={styles.linkButton}>
              <Text style={styles.linkText}>
                View {type === 'pending' || type === 'progress' ? 'Progress' : 'Details'}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 60,
    left: 10,
    right: 10,
    zIndex: 100,
    backgroundColor: COLORS.DARK_CARD_BG,
    borderRadius: 12,
    padding: 12,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 12,
  },
  content: {
    flexDirection: 'row',
    gap: 12,
  },
  iconContainer: {
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingTop: 3,
  },
  textContainer: {
    flex: 1,
    gap: 6,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },
  title: {
    flex: 1,
    fontSize: 16,
    fontFamily: 'CabinetGrotesk-Bold',
    color: COLORS.TEXT_PRIMARY,
    lineHeight: 22,
  },
  description: {
    fontSize: 14,
    fontFamily: 'CabinetGrotesk-Regular',
    color: COLORS.TEXT_SECONDARY,
    lineHeight: 20,
  },
  closeButton: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 3,
  },
  actionsContainer: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  actionButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  primaryButton: {
    backgroundColor: COLORS.PRIMARY_BLUE,
  },
  secondaryButton: {
    backgroundColor: COLORS.BG_TERTIARY,
  },
  actionButtonText: {
    fontSize: 14,
    fontFamily: 'CabinetGrotesk-Medium',
  },
  primaryButtonText: {
    color: COLORS.WHITE,
  },
  secondaryButtonText: {
    color: COLORS.TEXT_PRIMARY,
  },
  linksContainer: {
    flexDirection: 'column',
    gap: 6,
    marginTop: 4,
  },
  linkButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  linkText: {
    fontSize: 14,
    fontFamily: 'CabinetGrotesk-Regular',
    color: COLORS.PRIMARY_BLUE,
  },
});
