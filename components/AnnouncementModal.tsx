/**
 * AnnouncementModal Component
 * Full-screen announcement overlay with optional hero image and CTA.
 */

import React from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  Image,
  Linking,
  StyleSheet,
  Dimensions,
  StatusBar,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, fonts, fontSizes, spacing } from '../styles/theme';
import { logger } from '../utils/logger';
import type { RemoteConfigAnnouncement } from '../types/remoteConfig';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

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
  const hasImage = !!announcement.imageUrl;
  const hasCta = !!announcement.ctaLabel && !!announcement.ctaUrl;

  const handleCtaPress = async (): Promise<void> => {
    if (!announcement.ctaUrl) return;
    try {
      await Linking.openURL(announcement.ctaUrl);
    } catch (err: unknown) {
      logger.warn('[AnnouncementModal] Failed to open CTA URL', {
        url: announcement.ctaUrl,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  };

  return (
    <Modal visible={visible} animationType="fade" statusBarTranslucent>
      <StatusBar barStyle="light-content" />
      <View style={styles.container}>
        {/* Hero Image — top half */}
        {hasImage ? (
          <View style={styles.imageContainer}>
            <Image
              source={{ uri: announcement.imageUrl! }}
              style={styles.heroImage}
              resizeMode="cover"
            />
            <LinearGradient
              colors={['transparent', colors.bg.primary]}
              style={styles.imageGradient}
              start={{ x: 0.5, y: 0 }}
              end={{ x: 0.5, y: 1 }}
            />
          </View>
        ) : (
          <View style={styles.noImageHeader}>
            <View style={styles.iconCircle}>
              <Text style={styles.iconEmoji}>{'📣'}</Text>
            </View>
          </View>
        )}

        {/* Content */}
        <View style={styles.content}>
          <Text style={styles.title}>{announcement.title}</Text>
          <Text style={styles.body}>{announcement.body}</Text>
        </View>

        {/* Buttons — pinned to bottom */}
        <View style={styles.footer}>
          {hasCta && (
            <TouchableOpacity
              style={styles.ctaButton}
              onPress={handleCtaPress}
              activeOpacity={0.8}
              testID="announcement-cta-btn"
            >
              <Text style={styles.ctaText}>{announcement.ctaLabel}</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={styles.dismissButton}
            onPress={onDismiss}
            activeOpacity={0.7}
            testID="announcement-dismiss-btn"
          >
            <Text style={styles.dismissText}>
              {hasCta ? 'Maybe Later' : 'Got It'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg.primary,
  },
  imageContainer: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT * 0.45,
    position: 'relative',
  },
  heroImage: {
    width: '100%',
    height: '100%',
  },
  imageGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 120,
  },
  noImageHeader: {
    height: SCREEN_HEIGHT * 0.3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: colors.bg.tertiary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconEmoji: {
    fontSize: 48,
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
  },
  title: {
    fontSize: 28,
    fontFamily: fonts.bold,
    color: colors.text.primary,
    marginBottom: spacing.md,
  },
  body: {
    fontSize: fontSizes.md,
    fontFamily: fonts.regular,
    color: colors.text.secondary,
    lineHeight: 24,
  },
  footer: {
    paddingHorizontal: spacing.xl,
    paddingBottom: 50,
    gap: 12,
  },
  ctaButton: {
    backgroundColor: colors.brand.primary,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  ctaText: {
    fontSize: fontSizes.md,
    fontFamily: fonts.bold,
    color: '#FFFFFF',
  },
  dismissButton: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  dismissText: {
    fontSize: fontSizes.md,
    fontFamily: fonts.medium,
    color: colors.text.tertiary,
  },
});

export default AnnouncementModal;
