import { Ionicons } from '@expo/vector-icons';
import { useNavigation, type NavigationProp } from '@react-navigation/native';
import React from 'react';
import {
  Alert,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type ImageSourcePropType,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ImportWalletScreen from '../../components/onboarding/ImportWalletScreen';
import ScreenLayout from '../../components/layouts/ScreenLayout';
import {
  DEFAULT_WALLET_DERIVATION_MODE,
  UNISAT_WALLET_DERIVATION_MODE,
  type WalletDerivationMode,
  type WalletImportProfile,
} from '../../constants/bitcoin';
import { createEmptySeedPhrase } from '../../constants/mnemonic';
import { useAuthSession, useOnboardingFlow, useWallet } from '../../contexts';
import type { RootNavigatorParamList } from '../../navigation/types';
import { performFullWalletReset } from '../../services/walletResetService';
import * as WalletService from '../../services/walletService';
import { COLORS } from '../../theme';
import { logger } from '../../utils/logger';
import { notify } from '../../utils/notify';

interface GuideStep {
  title: string;
  body: string;
  image: ImageSourcePropType;
}

type GuideProfile = 'xverse' | 'unisat';

interface GuideProfileConfig {
  id: GuideProfile;
  label: string;
  title: string;
  subtitle: string;
  warningText: string;
  restoreTitle: string;
  restoreSubtitle: string;
  importProfile?: WalletImportProfile;
  derivationMode?: WalletDerivationMode;
  steps: GuideStep[];
}

const GUIDE_PROFILES: Record<GuideProfile, GuideProfileConfig> = {
  xverse: {
    id: 'xverse',
    label: 'Xverse',
    title: 'Export your Xverse seed phrase',
    subtitle:
      'Ducat needs the seed phrase for the wallet that owns your Quanta address. Follow the Xverse steps, then restore that wallet here.',
    warningText:
      'Never share your seed phrase. Only enter it inside Ducat when restoring your own wallet.',
    restoreTitle: 'Restore Xverse Wallet',
    restoreSubtitle: 'Enter the 12 or 24 words exported from Xverse.',
    importProfile: 'xverse',
    derivationMode: DEFAULT_WALLET_DERIVATION_MODE,
    steps: [
      {
        title: 'Open the account menu',
        body: 'From the wallet home screen, tap the menu icon in the top-right corner.',
        image: require('../../assets/quanta-guide/open-menu.png'),
      },
      {
        title: 'Go to Settings',
        body: 'Select Settings from the account menu.',
        image: require('../../assets/quanta-guide/select-settings.png'),
      },
      {
        title: 'Open Security',
        body: 'In Settings, choose Security.',
        image: require('../../assets/quanta-guide/open-security.png'),
      },
      {
        title: 'Choose Show seed phrase',
        body: 'Tap Show seed phrase. This is the private key backup for that wallet.',
        image: require('../../assets/quanta-guide/show-seed.png'),
      },
      {
        title: 'Enter your password',
        body: 'Confirm your password to unlock the seed phrase screen.',
        image: require('../../assets/quanta-guide/enter-password.png'),
      },
      {
        title: 'Reveal and copy the words',
        body: 'Tap Reveal, then write the recovery words down in the exact order shown.',
        image: require('../../assets/quanta-guide/reveal-seed.png'),
      },
    ],
  },
  unisat: {
    id: 'unisat',
    label: 'UniSat',
    title: 'Export your UniSat seed phrase',
    subtitle:
      'Use this for UniSat HD wallets. Ducat will restore the seed with UniSat account derivation so Quanta can find the same addresses.',
    warningText:
      'Never share your seed phrase. Only enter it inside Ducat when restoring your own wallet.',
    restoreTitle: 'Restore UniSat Wallet',
    restoreSubtitle: 'Enter the 12 or 24 words exported from UniSat.',
    importProfile: 'unisat',
    derivationMode: UNISAT_WALLET_DERIVATION_MODE,
    steps: [
      {
        title: 'Open the wallet switcher',
        body: 'On the UniSat home screen, tap the wallet name, such as HD Wallet #1.',
        image: require('../../assets/quanta-guide/unisat-open-wallet-list.png'),
      },
      {
        title: 'Open wallet settings',
        body: 'On Switch Wallet, tap the gear icon for the HD wallet you use with Quanta.',
        image: require('../../assets/quanta-guide/unisat-open-wallet-settings.png'),
      },
      {
        title: 'Choose recovery phrase',
        body: 'Tap Show Secret Recovery Phrase from the wallet settings menu.',
        image: require('../../assets/quanta-guide/unisat-show-recovery-phrase.png'),
      },
      {
        title: 'Enter your password',
        body: 'Read the warning, enter your UniSat password, then tap Show Secret Recovery Phrase.',
        image: require('../../assets/quanta-guide/unisat-enter-password.png'),
      },
      {
        title: 'Write down the words',
        body: 'Copy the recovery words in order. The advanced derivation path shown by UniSat is expected.',
        image: require('../../assets/quanta-guide/unisat-reveal-seed.png'),
      },
    ],
  },
};

const GUIDE_PROFILE_OPTIONS: GuideProfile[] = ['xverse', 'unisat'];

export default function QuantaSeedPhraseGuideScreen(): React.ReactElement {
  const navigation = useNavigation<NavigationProp<RootNavigatorParamList>>();
  const insets = useSafeAreaInsets();
  const { resetWallet, loadWallet } = useWallet();
  const { setSeedConfirmed } = useOnboardingFlow();
  const { setIsAuthenticated, setPasskeyEnabled } = useAuthSession();
  const [restoreMode, setRestoreMode] = React.useState(false);
  const [selectedGuideProfile, setSelectedGuideProfile] = React.useState<GuideProfile>('xverse');
  const [importSeedPhrase, setImportSeedPhrase] = React.useState<string[]>(createEmptySeedPhrase());
  const [isRestoring, setIsRestoring] = React.useState(false);
  const [selectedGuideStep, setSelectedGuideStep] = React.useState<GuideStep | null>(null);
  const seedInputRefs = React.useRef<(TextInput | null)[]>([]);
  const activeGuide = GUIDE_PROFILES[selectedGuideProfile];

  const handleRestoreWalletProfileChange = React.useCallback((profile: WalletImportProfile) => {
    setSelectedGuideProfile(profile);
  }, []);

  const handleStartRestore = React.useCallback(() => {
    Alert.alert(
      'Replace current wallet?',
      'This will delete the current wallet, balances, Turbo tokens, vault state, and local transaction state from this device. There is no undo. Only continue if you have backed up the current wallet or intentionally want to replace it.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'I understand',
          style: 'destructive',
          onPress: () => setRestoreMode(true),
        },
      ]
    );
  }, []);

  const handleRestoreImport = React.useCallback(async () => {
    if (isRestoring) {
      return;
    }

    const mnemonic = importSeedPhrase
      .map((word) => word.trim().toLowerCase())
      .join(' ')
      .trim();

    setIsRestoring(true);

    try {
      if (!activeGuide.derivationMode) {
        throw new Error('Wallet import profile is not available yet');
      }

      await WalletService.importWallet(mnemonic, 0, activeGuide.derivationMode);
      await performFullWalletReset({
        preservePinAuth: true,
        resetWallet,
        setSeedConfirmed,
      });
      await WalletService.saveWalletToStorage(mnemonic, 0, activeGuide.derivationMode);
      const loadResult = await loadWallet();

      if (!loadResult.exists || !loadResult.addresses) {
        throw new Error('Restored wallet could not be loaded');
      }

      setPasskeyEnabled(false);
      setSeedConfirmed(true);
      setIsAuthenticated(true);
      setImportSeedPhrase(createEmptySeedPhrase());
      notify.success('Wallet restored from seed phrase');
      navigation.navigate('Main', { screen: 'QuantaTab' });
    } catch (error: unknown) {
      logger.error('[QuantaSeedPhraseGuide] Failed to restore wallet from Quanta seed phrase', {
        error: error instanceof Error ? error.message : String(error),
      });
      notify.error(
        error instanceof Error && error.message.includes('Invalid seed phrase')
          ? 'Invalid seed phrase. Check the words and try again.'
          : 'Failed to restore wallet. Please try again.'
      );
    } finally {
      setIsRestoring(false);
    }
  }, [
    importSeedPhrase,
    activeGuide.derivationMode,
    isRestoring,
    loadWallet,
    navigation,
    resetWallet,
    setIsAuthenticated,
    setPasskeyEnabled,
    setSeedConfirmed,
  ]);

  if (restoreMode) {
    return (
      <View style={[styles.restoreScreen, { paddingTop: Math.max(insets.top, 10) }]}>
        <ImportWalletScreen
          importSeedPhrase={importSeedPhrase}
          setImportSeedPhrase={setImportSeedPhrase}
          seedInputRefs={seedInputRefs}
          isImporting={isRestoring}
          keyboardHeight={0}
          onImport={handleRestoreImport}
          onCancel={() => {
            setRestoreMode(false);
            setImportSeedPhrase(createEmptySeedPhrase());
          }}
          title={activeGuide.restoreTitle}
          subtitle={activeGuide.restoreSubtitle}
          importWalletProfile={activeGuide.importProfile ?? 'xverse'}
          setImportWalletProfile={handleRestoreWalletProfileChange}
          importButtonLabel="Replace Wallet"
          cancelButtonLabel="Back to Guide"
          warningText="Destructive action: importing here replaces the current Ducat wallet on this device."
        />
      </View>
    );
  }

  return (
    <ScreenLayout showBanner={false} style={styles.screen} testID="quanta-seed-guide-screen">
      <View style={[styles.header, { paddingTop: Math.max(insets.top + 8, 20) }]}>
        <Pressable
          accessibilityLabel="Go back"
          accessibilityRole="button"
          hitSlop={10}
          onPress={() => navigation.goBack()}
          style={styles.backButton}
          testID="quanta-seed-guide-back-button"
        >
          <Ionicons name="chevron-back" size={26} color={COLORS.TEXT_PRIMARY} />
        </Pressable>
        <Text style={styles.headerTitle}>Fix wallet match</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.content,
          { paddingBottom: Math.max(insets.bottom + 116, 132) },
        ]}
        contentInsetAdjustmentBehavior="automatic"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.heroCard}>
          <View style={styles.iconFrame}>
            <Ionicons name="key-outline" size={24} color={COLORS.WHITE} />
          </View>
          <View style={styles.titleBlock}>
            <Text style={styles.eyebrow}>Account mismatch</Text>
            <Text style={styles.title}>{activeGuide.title}</Text>
            <Text style={styles.subtitle}>{activeGuide.subtitle}</Text>
          </View>
        </View>

        <View style={styles.guideSelector}>
          {GUIDE_PROFILE_OPTIONS.map((profile) => {
            const guide = GUIDE_PROFILES[profile];
            const isSelected = selectedGuideProfile === profile;

            return (
              <Pressable
                accessibilityLabel={`Show ${guide.label} guide`}
                accessibilityRole="button"
                key={guide.id}
                onPress={() => setSelectedGuideProfile(profile)}
                style={[styles.guideOption, isSelected && styles.guideOptionSelected]}
                testID={`quanta-guide-profile-${guide.id}`}
              >
                <Text style={[styles.guideOptionText, isSelected && styles.guideOptionTextActive]}>
                  {guide.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.warningRow}>
          <Ionicons name="warning-outline" size={18} color={COLORS.YELLOW} />
          <Text style={styles.warningText}>{activeGuide.warningText}</Text>
        </View>

        <View style={styles.steps}>
          {activeGuide.steps.map((step, index) => (
            <View key={step.title} style={styles.stepCard}>
              <View style={styles.stepCopy}>
                <View style={styles.stepHeadingRow}>
                  <View style={styles.stepNumber}>
                    <Text style={styles.stepNumberText}>{index + 1}</Text>
                  </View>
                  <Text style={styles.stepTitle}>{step.title}</Text>
                </View>
                <Text style={styles.stepText}>{step.body}</Text>
              </View>
              <Pressable
                accessibilityLabel={`Open ${step.title} screenshot`}
                accessibilityRole="imagebutton"
                onPress={() => setSelectedGuideStep(step)}
                style={styles.stepImageFrame}
                testID={`quanta-guide-image-${index + 1}`}
              >
                <Image source={step.image} resizeMode="cover" style={styles.stepImage} />
                <View style={styles.expandBadge}>
                  <Ionicons name="expand-outline" size={15} color={COLORS.WHITE} />
                </View>
              </Pressable>
            </View>
          ))}
        </View>
      </ScrollView>
      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom + 12, 24) }]}>
        <Pressable
          accessibilityLabel="Restore wallet from seed phrase"
          accessibilityRole="button"
          onPress={handleStartRestore}
          style={styles.restoreButton}
          testID="quanta-restore-from-seed-button"
        >
          <Ionicons name="key-outline" size={18} color={COLORS.WHITE} />
          <Text style={styles.restoreButtonText}>Restore {activeGuide.label} seed phrase</Text>
        </Pressable>
      </View>
      <Modal
        animationType="fade"
        onRequestClose={() => setSelectedGuideStep(null)}
        transparent
        visible={selectedGuideStep !== null}
      >
        <View style={styles.previewBackdrop}>
          <View style={[styles.previewHeader, { paddingTop: Math.max(insets.top + 10, 22) }]}>
            <Text style={styles.previewTitle} numberOfLines={2}>
              {selectedGuideStep?.title}
            </Text>
            <Pressable
              accessibilityLabel="Close screenshot preview"
              accessibilityRole="button"
              hitSlop={10}
              onPress={() => setSelectedGuideStep(null)}
              style={styles.previewCloseButton}
              testID="quanta-guide-image-preview-close"
            >
              <Ionicons name="close" size={28} color={COLORS.WHITE} />
            </Pressable>
          </View>
          {selectedGuideStep ? (
            <Pressable
              accessibilityLabel="Close screenshot preview"
              onPress={() => setSelectedGuideStep(null)}
              style={styles.previewImageWrap}
            >
              <Image
                source={selectedGuideStep.image}
                resizeMode="contain"
                style={styles.previewImage}
                testID="quanta-guide-image-preview"
              />
            </Pressable>
          ) : null}
        </View>
      </Modal>
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  screen: {
    backgroundColor: COLORS.DARK_BG,
  },
  restoreScreen: {
    flex: 1,
    backgroundColor: COLORS.DARK_BG,
  },
  header: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  backButton: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 21,
  },
  headerTitle: {
    color: COLORS.TEXT_PRIMARY,
    fontSize: 17,
    lineHeight: 21,
    fontFamily: 'CabinetGrotesk-Bold',
    textAlign: 'center',
  },
  headerSpacer: {
    width: 42,
    height: 42,
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: 16,
    paddingTop: 18,
    gap: 16,
  },
  scrollView: {
    flex: 1,
  },
  heroCard: {
    gap: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.045)',
    padding: 18,
  },
  iconFrame: {
    width: 50,
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.14)',
    borderRadius: 25,
    backgroundColor: 'rgba(255, 255, 255, 0.07)',
  },
  titleBlock: {
    gap: 8,
  },
  eyebrow: {
    color: COLORS.PRIMARY_BLUE,
    fontSize: 12,
    lineHeight: 15,
    fontFamily: 'CabinetGrotesk-Bold',
    textTransform: 'uppercase',
  },
  title: {
    color: COLORS.TEXT_PRIMARY,
    fontSize: 27,
    lineHeight: 32,
    fontFamily: 'CabinetGrotesk-Bold',
  },
  subtitle: {
    color: COLORS.TEXT_SECONDARY,
    fontSize: 15,
    lineHeight: 21,
    fontFamily: 'CabinetGrotesk-Regular',
  },
  warningRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    borderWidth: 1,
    borderColor: 'rgba(245, 228, 162, 0.28)',
    borderRadius: 8,
    backgroundColor: 'rgba(245, 228, 162, 0.1)',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  guideSelector: {
    flexDirection: 'row',
    gap: 8,
  },
  guideOption: {
    flex: 1,
    minHeight: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.045)',
  },
  guideOptionSelected: {
    borderColor: COLORS.PRIMARY_BLUE,
    backgroundColor: 'rgba(24, 88, 228, 0.18)',
  },
  guideOptionText: {
    color: COLORS.TEXT_SECONDARY,
    fontSize: 14,
    lineHeight: 18,
    fontFamily: 'CabinetGrotesk-Bold',
    textAlign: 'center',
  },
  guideOptionTextActive: {
    color: COLORS.TEXT_PRIMARY,
  },
  warningText: {
    flex: 1,
    color: COLORS.YELLOW,
    fontSize: 13,
    lineHeight: 18,
    fontFamily: 'CabinetGrotesk-Medium',
  },
  steps: {
    gap: 12,
  },
  stepCard: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.11)',
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    padding: 14,
  },
  stepCopy: {
    flex: 1,
    justifyContent: 'center',
    gap: 11,
  },
  stepHeadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },
  stepNumber: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    backgroundColor: COLORS.PRIMARY_BLUE,
  },
  stepNumberText: {
    color: COLORS.WHITE,
    fontSize: 13,
    lineHeight: 16,
    fontFamily: 'CabinetGrotesk-Bold',
    fontVariant: ['tabular-nums'],
  },
  stepTitle: {
    flex: 1,
    color: COLORS.TEXT_PRIMARY,
    fontSize: 18,
    lineHeight: 22,
    fontFamily: 'CabinetGrotesk-Bold',
  },
  stepText: {
    color: COLORS.TEXT_SECONDARY,
    fontSize: 15,
    lineHeight: 21,
    fontFamily: 'CabinetGrotesk-Regular',
  },
  stepImageFrame: {
    width: 92,
    height: 148,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.16)',
    borderRadius: 8,
    backgroundColor: COLORS.BLACK,
  },
  stepImage: {
    width: '100%',
    height: '100%',
  },
  expandBadge: {
    position: 'absolute',
    right: 6,
    bottom: 6,
    width: 26,
    height: 26,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 13,
    backgroundColor: 'rgba(0, 0, 0, 0.72)',
  },
  previewBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.94)',
  },
  previewHeader: {
    minHeight: 76,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingHorizontal: 18,
  },
  previewTitle: {
    flex: 1,
    color: COLORS.TEXT_PRIMARY,
    fontSize: 18,
    lineHeight: 23,
    fontFamily: 'CabinetGrotesk-Bold',
  },
  previewCloseButton: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 21,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  previewImageWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingBottom: 28,
  },
  previewImage: {
    width: '100%',
    height: '100%',
  },
  footer: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
    backgroundColor: 'rgba(17, 16, 21, 0.98)',
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  restoreButton: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 8,
    backgroundColor: COLORS.PRIMARY_BLUE,
    paddingHorizontal: 18,
  },
  restoreButtonText: {
    color: COLORS.WHITE,
    fontSize: 15,
    lineHeight: 19,
    fontFamily: 'CabinetGrotesk-Bold',
    textAlign: 'center',
  },
});
