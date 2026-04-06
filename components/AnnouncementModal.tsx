/**
 * AnnouncementModal Component
 * Displays a server-driven announcement popup with optional image and CTA button.
 */

import React from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  ScrollView,
  Image,
  Linking,
  StyleSheet,
} from 'react-native';
import { useResponsive } from '../hooks/useResponsive';
import { colors, spacing, fonts, fontSizes, radii } from '../styles/theme';
import { COLORS } from '../theme';
import { logger } from '../utils/logger';
import type { RemoteConfigAnnouncement } from '../types/remoteConfig';

interface AnnouncementModalProps {
  visible: boolean;
  announcement: RemoteConfigAnnouncement;
  onDismiss: () => void;
}

const AnnouncementModal = React.memo(function AnnouncementModal({
  visible,
  announcement,
  onDismiss,
}: AnnouncementModalProps) {
  const { s, sf } = useResponsive();

  const handleCtaPress = async (): Promise<void> => {
    if (!announcement.ctaUrl) return;
    try {
      await Linking.openURL(announcement.ctaUrl);
    } catch (err: unknown) {
      logger.error('[AnnouncementModal] Failed to open CTA URL', {
        url: announcement.ctaUrl,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={modalStyles.overlay}>
        <ScrollView
          contentContainerStyle={{
            flexGrow: 1,
            justifyContent: 'center',
            alignItems: 'center',
          }}
          showsVerticalScrollIndicator={false}
        >
          <View
            style={[
              modalStyles.modal,
              {
                borderRadius: s(radii.xl),
                padding: s(spacing.xl),
                marginVertical: s(spacing.xl),
              },
            ]}
          >
            {/* Title */}
            <Text
              style={[
                modalStyles.title,
                { fontSize: sf(fontSizes.xl), marginBottom: s(spacing.md) },
              ]}
            >
              {announcement.title}
            </Text>

            {/* Optional Image */}
            {announcement.imageUrl ? (
              <Image
                source={{ uri: announcement.imageUrl }}
                style={[modalStyles.image, { marginBottom: s(spacing.md) }]}
                resizeMode="contain"
              />
            ) : null}

            {/* Body */}
            <Text
              style={[
                modalStyles.body,
                {
                  fontSize: sf(fontSizes.md),
                  marginBottom: s(spacing.lg),
                  lineHeight: sf(22),
                },
              ]}
            >
              {announcement.body}
            </Text>

            {/* Buttons */}
            <View style={[modalStyles.buttons, { gap: s(12) }]}>
              {/* CTA Button (optional) */}
              {announcement.ctaLabel && announcement.ctaUrl ? (
                <TouchableOpacity
                  style={[
                    modalStyles.button,
                    modalStyles.ctaButton,
                    {
                      paddingVertical: s(spacing.md),
                      paddingHorizontal: s(spacing.lg),
                      borderRadius: s(radii.lg),
                    },
                  ]}
                  onPress={handleCtaPress}
                  testID="announcement-cta-btn"
                >
                  <Text style={[modalStyles.ctaText, { fontSize: sf(fontSizes.md) }]}>
                    {announcement.ctaLabel}
                  </Text>
                </TouchableOpacity>
              ) : null}

              {/* Dismiss Button */}
              <TouchableOpacity
                style={[
                  modalStyles.button,
                  modalStyles.dismissButton,
                  {
                    paddingVertical: s(spacing.md),
                    paddingHorizontal: s(spacing.lg),
                    borderRadius: s(radii.lg),
                  },
                ]}
                onPress={onDismiss}
                testID="announcement-dismiss-btn"
              >
                <Text style={[modalStyles.dismissText, { fontSize: sf(fontSizes.md) }]}>
                  Dismiss
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
});

const modalStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modal: {
    backgroundColor: colors.bg.secondary,
    width: '85%',
    maxWidth: 400,
  },
  title: {
    fontFamily: fonts.bold,
    fontWeight: 'bold' as const,
    color: colors.text.primary,
    textAlign: 'center',
  },
  image: {
    width: '100%',
    height: 180,
    borderRadius: 12,
  },
  body: {
    fontFamily: fonts.regular,
    color: colors.text.primary,
    textAlign: 'center',
  },
  buttons: {
    flexDirection: 'column',
  },
  button: {
    alignItems: 'center',
  },
  ctaButton: {
    backgroundColor: colors.brand.primary,
  },
  ctaText: {
    fontFamily: fonts.medium,
    fontWeight: '600' as const,
    color: colors.text.primary,
  },
  dismissButton: {
    backgroundColor: COLORS.OFF_WHITE,
  },
  dismissText: {
    fontFamily: fonts.medium,
    fontWeight: '600' as const,
    color: COLORS.DARK_GRAY,
  },
});

export default AnnouncementModal;
