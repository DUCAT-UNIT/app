/**
 * Snackbar Component
 * Top-aligned notification banner matching frontend-app snackbar styling
 */

import React, { useEffect } from 'react';
import PropTypes from 'prop-types';
import { View, Text, StyleSheet, TouchableOpacity, Animated } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { COLORS } from '../theme';
import { logger } from '../utils/logger';

const ACTION_LABELS = {
  deposit: 'BTC Deposit',
  withdraw: 'BTC Withdraw',
  borrow: 'UNIT Borrow',
  repay: 'UNIT Repay',
  create: 'Vault Create',
  faucet: 'Testnet Coins',
  swap: 'Swap UNIT',
  liquidation: 'Vault Liquidation',
  repossess: 'Liquidation Claim',
};

const getSnackbarIcon = (type) => {
  switch (type) {
    case 'success':
    case 'submitted':
      return { name: 'check-circle', color: COLORS.SUCCESS_GREEN };
    case 'error':
      return { name: 'alert-circle', color: COLORS.DANGER_RED };
    case 'warning':
      return { name: 'alert-triangle', color: COLORS.WARNING_ORANGE };
    case 'pending':
    default:
      return { name: 'loader', color: COLORS.PRIMARY_BLUE };
  }
};

const computeTitle = (type, label) => {
  switch (type) {
    case 'pending':
      return `${label} in progress...`;
    case 'submitted':
      return `${label} submitted`;
    case 'success':
      return `${label} completed successfully!`;
    case 'error':
      return `${label} failed`;
    default:
      return label;
  }
};

export default function Snackbar({ params, onClose }) {
  logger.debug('🎯 Snackbar rendering with params:', params);
  const slideAnim = React.useRef(new Animated.Value(-200)).current;

  useEffect(() => {
    logger.debug('🎯 Snackbar mounted, starting animation');

    // Slide in animation
    Animated.spring(slideAnim, {
      toValue: 0,
      useNativeDriver: true,
      tension: 65,
      friction: 10,
    }).start();

    // Auto-dismiss after 15 seconds for success and submitted
    if (params.type === 'success' || params.type === 'submitted') {
      const timer = setTimeout(() => {
        handleClose();
      }, 15000);
      return () => clearTimeout(timer);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleClose = () => {
    Animated.timing(slideAnim, {
      toValue: -200,
      duration: 300,
      useNativeDriver: true,
    }).start(() => {
      onClose();
    });
  };

  const { type = 'pending', action, title: overrideTitle, description, txid, clickAction } = params;
  const label = ACTION_LABELS[action] || 'Transaction';
  const title = overrideTitle || computeTitle(type, label);
  const icon = getSnackbarIcon(type);

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
        <View style={styles.iconContainer}>
          <Feather name={icon.name} size={24} color={icon.color} />
        </View>

        <View style={styles.textContainer}>
          <Text style={styles.title}>{title}</Text>
          {description && <Text style={styles.description}>{description}</Text>}

          {(txid || clickAction) && (
            <View style={styles.actionsContainer}>
              {clickAction && (
                <TouchableOpacity onPress={clickAction} style={styles.linkButton}>
                  <Feather name="external-link" size={16} color={COLORS.PRIMARY_BLUE} />
                  <Text style={styles.linkText}>
                    View {type === 'pending' ? 'Progress' : 'Details'}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>

        <TouchableOpacity onPress={handleClose} style={styles.closeButton} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Feather name="x" size={24} color={COLORS.LIGHT_GRAY} />
        </TouchableOpacity>
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
    padding: 16,
    // Enhanced shadow for floating effect
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
    paddingTop: 2,
  },
  textContainer: {
    flex: 1,
    gap: 8,
  },
  title: {
    fontSize: 18,
    fontFamily: 'CabinetGrotesk-Bold',
    color: COLORS.WHITE,
    lineHeight: 24,
  },
  description: {
    fontSize: 14,
    fontFamily: 'CabinetGrotesk-Regular',
    color: COLORS.LIGHT_GRAY,
    lineHeight: 20,
  },
  actionsContainer: {
    flexDirection: 'column',
    gap: 8,
    marginTop: 4,
  },
  linkButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  linkText: {
    fontSize: 14,
    fontFamily: 'CabinetGrotesk-Regular',
    color: COLORS.PRIMARY_BLUE,
  },
  closeButton: {
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingTop: 2,
  },
});

Snackbar.propTypes = {
  params: PropTypes.shape({
    action: PropTypes.string,
    type: PropTypes.oneOf(['pending', 'submitted', 'success', 'error']),
    title: PropTypes.string,
    description: PropTypes.string,
    txid: PropTypes.string,
    clickAction: PropTypes.func,
  }).isRequired,
  onClose: PropTypes.func.isRequired,
};
