/**
 * NotificationModal Component
 * Displays rich notifications with title, body, optional link, and icon
 */

import React from 'react';
import PropTypes from 'prop-types';
import { View, Text, StyleSheet, TouchableOpacity, Linking, Modal } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { COLORS } from '../utils/colors';

export default function NotificationModal({ visible, notification, onClose }) {
  if (!visible || !notification) {
    return null;
  }

  const { type, title, message, link, linkText } = notification;

  // Determine icon based on type
  const getIcon = () => {
    switch (type) {
      case 'success':
        return { name: 'check-circle', color: COLORS.SUCCESS_GREEN };
      case 'error':
        return { name: 'alert-circle', color: COLORS.DANGER_RED };
      case 'warning':
        return { name: 'alert-triangle', color: COLORS.WARNING_ORANGE };
      case 'info':
        return { name: 'info', color: COLORS.PRIMARY_BLUE };
      default:
        return { name: 'check-circle', color: COLORS.SUCCESS_GREEN };
    }
  };

  const icon = getIcon();

  const handleLinkPress = () => {
    if (link) {
      Linking.openURL(link).catch((err) => console.error('Failed to open link:', err));
    }
  };

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent={true}
    >
      <View style={styles.overlay}>
        <View style={styles.modalContainer}>
          {/* Header with icon and close button */}
          <View style={styles.header}>
            <Feather name={icon.name} size={24} color={icon.color} />
            <TouchableOpacity onPress={onClose} style={styles.closeButton} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Feather name="x" size={24} color={COLORS.VERY_LIGHT_GRAY} />
            </TouchableOpacity>
          </View>

          {/* Title */}
          {title && <Text style={styles.title}>{title}</Text>}

          {/* Message body */}
          <Text style={styles.message}>{message}</Text>

          {/* Optional link */}
          {link && linkText && (
            <TouchableOpacity onPress={handleLinkPress} style={styles.linkContainer}>
              <Feather name="external-link" size={18} color={COLORS.PRIMARY_BLUE} />
              <Text style={styles.linkText}>{linkText}</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  modalContainer: {
    backgroundColor: COLORS.DARK_CARD_BG,
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 400,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  closeButton: {
    padding: 4,
  },
  title: {
    fontSize: 24,
    fontFamily: 'CabinetGrotesk-Bold',
    color: COLORS.WHITE,
    marginBottom: 12,
  },
  message: {
    fontSize: 16,
    fontFamily: 'CabinetGrotesk-Regular',
    color: COLORS.LIGHT_GRAY,
    lineHeight: 24,
    marginBottom: 20,
  },
  linkContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: COLORS.MEDIUM_GRAY,
  },
  linkText: {
    fontSize: 16,
    fontFamily: 'CabinetGrotesk-Medium',
    color: COLORS.PRIMARY_BLUE,
  },
});

NotificationModal.propTypes = {
  visible: PropTypes.bool.isRequired,
  notification: PropTypes.shape({
    type: PropTypes.oneOf(['success', 'error', 'warning', 'info']),
    title: PropTypes.string,
    message: PropTypes.string.isRequired,
    link: PropTypes.string,
    linkText: PropTypes.string,
  }),
  onClose: PropTypes.func.isRequired,
};
