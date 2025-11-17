import { StyleSheet, Platform, StatusBar, Dimensions } from 'react-native';
import { COLORS } from '../theme';

// Get device dimensions for responsive sizing
const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Get safe area top inset - accounts for notch/status bar on different devices
const STATUS_BAR_HEIGHT = Platform.OS === 'ios' ? 50 : StatusBar.currentHeight || 0;

// Responsive horizontal padding based on screen width
// Small devices (< 375): 16px
// Medium devices (375-414): 20px
// Large devices (> 414): 24px
const HORIZONTAL_PADDING = SCREEN_WIDTH < 375 ? 16 : SCREEN_WIDTH > 414 ? 24 : 20;

// Helper function to get Cabinet Grotesk font based on weight
const _getCabinetFont = (weight) => {
  if (weight === 'bold' || weight === '700' || weight === '800' || weight === '900') {
    return 'CabinetGrotesk-Bold';
  } else if (weight === '500' || weight === '600') {
    return 'CabinetGrotesk-Medium';
  }
  return 'CabinetGrotesk-Regular';
};

export const commonStyles = StyleSheet.create({
  container: {
    flexGrow: 1,
    backgroundColor: COLORS.DARK_BG,
    alignItems: 'center',
    justifyContent: 'flex-start',
    padding: HORIZONTAL_PADDING,
    paddingTop: HORIZONTAL_PADDING,
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    marginBottom: 0,
  },
  titleContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 32,
    fontFamily: 'CabinetGrotesk-Bold',
    fontWeight: 'bold',
    color: COLORS.DARK_GRAY,
    marginBottom: 4,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    fontFamily: 'CabinetGrotesk-Regular',
    fontWeight: '300',
    color: COLORS.PURPLE,
    marginBottom: 32,
    textAlign: 'center',
    letterSpacing: 0.5,
  },
  topAddAccountButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.PRIMARY_BLUE,
    justifyContent: 'center',
    alignItems: 'center',
  },
  button: {
    backgroundColor: COLORS.PRIMARY_BLUE,
    paddingVertical: 16,
    borderRadius: 12,
    marginTop: 8,
    width: '100%',
    alignItems: 'center',
  },
  buttonText: {
    color: COLORS.VERY_LIGHT_GRAY,
    fontSize: 16,
    fontFamily: 'CabinetGrotesk-Bold',
    fontWeight: 'bold',
    textAlign: 'center',
  },
  resetButton: {
    backgroundColor: COLORS.DANGER_RED,
    marginTop: 32,
  },
  secondaryButton: {
    backgroundColor: COLORS.MEDIUM_GRAY,
    marginTop: 8,
  },
  stepIndicator: {
    fontSize: 16,
    fontFamily: 'CabinetGrotesk-Bold',
    color: COLORS.PRIMARY_BLUE,
    fontWeight: 'bold',
    marginBottom: 12,
    textAlign: 'center',
  },
  introIconContainer: {
    alignItems: 'center',
    marginVertical: 20,
  },
  introIcon: {
    fontSize: 60,
    color: COLORS.PRIMARY_BLUE,
  },
  introTitle: {
    fontSize: 28,
    fontFamily: 'CabinetGrotesk-Bold',
    fontWeight: 'bold',
    color: COLORS.VERY_LIGHT_GRAY,
    marginBottom: 16,
    textAlign: 'center',
  },
  introText: {
    fontSize: 16,
    fontFamily: 'CabinetGrotesk-Regular',
    color: COLORS.SECONDARY_TEXT,
    lineHeight: 22,
    marginBottom: 32,
    textAlign: 'center',
    paddingHorizontal: 12,
  },
  infoBox: {
    backgroundColor: 'transparent',
    borderRadius: 0,
    padding: 0,
    marginBottom: 32,
  },
  infoTitle: {
    fontSize: 16,
    fontFamily: 'CabinetGrotesk-Bold',
    fontWeight: 'bold',
    color: COLORS.DARK_GRAY,
    marginBottom: 12,
  },
  infoItem: {
    fontSize: 16,
    fontFamily: 'CabinetGrotesk-Regular',
    color: COLORS.VERY_LIGHT_GRAY,
    lineHeight: 28,
    textAlign: 'center',
  },
  infoText: {
    fontSize: 16,
    fontFamily: 'CabinetGrotesk-Bold',
    color: COLORS.SECONDARY_TEXT,
    lineHeight: 22,
  },
  warningText: {
    fontSize: 16,
    fontFamily: 'CabinetGrotesk-Regular',
    color: COLORS.DANGER_RED,
    backgroundColor: COLORS.PINK_WHITE,
    padding: 16,
    borderRadius: 8,
    marginBottom: 25,
    textAlign: 'center',
    lineHeight: 20,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 32,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  addAccountButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.PRIMARY_BLUE,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addAccountText: {
    fontSize: 20,
    fontFamily: 'CabinetGrotesk-Bold',
    color: COLORS.VERY_LIGHT_GRAY,
    fontWeight: 'bold',
  },
  addressToggle: {
    flexDirection: 'row',
    backgroundColor: COLORS.CARD_BG,
    borderRadius: 8,
    overflow: 'hidden',
  },
  toggleButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  toggleButtonLeft: {
    borderTopLeftRadius: 8,
    borderBottomLeftRadius: 8,
  },
  toggleButtonRight: {
    borderTopRightRadius: 8,
    borderBottomRightRadius: 8,
  },
  toggleButtonActive: {
    backgroundColor: COLORS.PRIMARY_BLUE,
  },
  toggleText: {
    fontSize: 12,
    fontFamily: 'CabinetGrotesk-Medium',
    color: COLORS.SECONDARY_TEXT,
    fontWeight: '600',
  },
  toggleTextActive: {
    color: COLORS.VERY_LIGHT_GRAY,
  },
  loadingContainer: {
    height: 44,
    justifyContent: 'center',
  },
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  modalContent: {
    backgroundColor: COLORS.CARD_BG,
    borderRadius: 16,
    padding: 24,
    width: '80%',
    maxWidth: 300,
    overflow: 'hidden',
  },
  modalTitle: {
    fontSize: 20,
    fontFamily: 'CabinetGrotesk-Bold',
    color: COLORS.VERY_LIGHT_GRAY,
    fontWeight: 'bold',
    marginBottom: 16,
    textAlign: 'center',
  },
  modalLabel: {
    fontSize: 16,
    fontFamily: 'CabinetGrotesk-Bold',
    color: COLORS.VERY_LIGHT_GRAY,
    marginBottom: 12,
  },
  accountInput: {
    backgroundColor: COLORS.VERY_LIGHT_GRAY,
    color: COLORS.DARK_GRAY,
    padding: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: COLORS.PRIMARY_BLUE,
    fontSize: 16,
    fontFamily: 'CabinetGrotesk-Regular',
    marginBottom: 20,
  },
  modalButtons: {
    flexDirection: 'row',
  },
  modalButton: {
    flex: 1,
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  modalButtonCancel: {
    backgroundColor: COLORS.MEDIUM_GRAY,
    marginRight: 16,
  },
  modalButtonConfirm: {
    backgroundColor: COLORS.PRIMARY_BLUE,
  },
  modalButtonText: {
    color: COLORS.VERY_LIGHT_GRAY,
    fontSize: 16,
    fontFamily: 'CabinetGrotesk-Medium',
    fontWeight: '600',
  },
  choicesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  choiceButton: {
    width: '48%',
    backgroundColor: COLORS.CARD_BG,
    padding: 8,
    borderRadius: 8,
    marginBottom: 4,
    borderWidth: 2,
    borderColor: COLORS.BORDER_COLOR,
  },
  choiceButtonSelected: {
    backgroundColor: COLORS.PRIMARY_BLUE,
    borderColor: COLORS.PRIMARY_BLUE,
  },
  choiceText: {
    color: COLORS.VERY_LIGHT_GRAY,
    fontSize: 16,
    fontFamily: 'CabinetGrotesk-Medium',
    textAlign: 'center',
    fontWeight: '600',
  },
  choiceTextSelected: {
    color: COLORS.VERY_LIGHT_GRAY,
    fontWeight: 'bold',
  },
  addressTypeSelector: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  addressTypeButton: {
    width: '48%',
    backgroundColor: COLORS.CARD_BG,
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: COLORS.BORDER_COLOR,
    alignItems: 'center',
  },
  addressTypeButtonSelected: {
    backgroundColor: COLORS.PRIMARY_BLUE,
    borderColor: COLORS.PRIMARY_BLUE,
  },
  addressTypeText: {
    color: COLORS.VERY_LIGHT_GRAY,
    fontSize: 16,
    fontFamily: 'CabinetGrotesk-Bold',
    fontWeight: 'bold',
    marginBottom: 4,
  },
  addressTypeTextSelected: {
    color: COLORS.VERY_LIGHT_GRAY,
  },
  addressTypeSubtext: {
    color: COLORS.SECONDARY_TEXT,
    fontSize: 12,
    fontFamily: 'CabinetGrotesk-Regular',
  },
  warning: {
    fontSize: 12,
    fontFamily: 'CabinetGrotesk-Bold',
    color: COLORS.DANGER_RED,
    marginTop: 16,
    textAlign: 'center',
    fontWeight: 'bold',
    lineHeight: 18,
  },
  label: {
    fontSize: 12,
    fontFamily: 'CabinetGrotesk-Bold',
    color: COLORS.VERY_LIGHT_GRAY,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  switchingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 2000,
    borderRadius: 16,
  },
  switchingText: {
    color: COLORS.VERY_LIGHT_GRAY,
    fontSize: 16,
    fontFamily: 'CabinetGrotesk-Medium',
    fontWeight: '600',
    marginTop: 12,
  },
  // Bottom sheet styles
  modalBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  bottomSheetBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    zIndex: 999,
  },
  bottomSheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: COLORS.DARK_BG,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 40,
    paddingHorizontal: 20,
    paddingTop: 16,
    minHeight: '50%',
    maxHeight: '90%',
    zIndex: 1000,
  },
  bottomSheetHandle: {
    width: 40,
    height: 4,
    backgroundColor: COLORS.MEDIUM_GRAY,
    borderRadius: 4,
    alignSelf: 'center',
    marginBottom: 20,
  },
  bottomSheetTitle: {
    fontSize: 24,
    fontFamily: 'CabinetGrotesk-Bold',
    fontWeight: 'bold',
    color: COLORS.VERY_LIGHT_GRAY,
    marginBottom: 25,
    textAlign: 'center',
  },
  // Amount input bottom sheet styles
  bottomSheetBackButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  bottomSheetBackArrow: {
    fontSize: 24,
    fontFamily: 'CabinetGrotesk-Regular',
    color: COLORS.PRIMARY_BLUE,
    marginRight: 4,
  },
  bottomSheetBackText: {
    fontSize: 16,
    fontFamily: 'CabinetGrotesk-Regular',
    color: COLORS.PRIMARY_BLUE,
  },
  copyHint: {
    fontSize: 12,
    fontFamily: 'CabinetGrotesk-Regular',
    color: COLORS.PRIMARY_BLUE,
    fontStyle: 'italic',
  },
  copyButton: {
    padding: 4,
  },
  accountIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.PRIMARY_BLUE,
    justifyContent: 'center',
    alignItems: 'center',
  },
  accountIconText: {
    fontSize: 16,
    fontFamily: 'CabinetGrotesk-Regular',
  },
  copyIconButton: {
    padding: 4,
  },
  copyIcon: {
    fontSize: 20,
    fontFamily: 'CabinetGrotesk-Regular',
  },
  headerIconButton: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerIcon: {
    fontSize: 20,
    fontFamily: 'CabinetGrotesk-Regular',
  },
  headerIconImage: {
    width: 24,
    height: 24,
    tintColor: COLORS.VERY_LIGHT_GRAY,
  },
  logoImage: {
    width: 40,
    height: 40,
  },
  dangerOption: {
    borderBottomWidth: 0,
  },
  dangerText: {
    color: COLORS.DANGER_RED,
  },
  // Toast notification styles
  toastContainer: {
    position: 'absolute',
    bottom: 100,
    left: 20,
    right: 20,
    backgroundColor: COLORS.WHITE,
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    zIndex: 999999,
  },
  toastContainerError: {
    backgroundColor: COLORS.DANGER_RED,
  },
  toastText: {
    fontSize: 16,
    fontFamily: 'CabinetGrotesk-Medium',
    color: COLORS.BLACK,
    fontWeight: '600',
    textAlign: 'center',
  },
  // Success screen styles
  successCloseButton: {
    position: 'absolute',
    top: 16,
    right: 20,
    zIndex: 10,
    padding: 12,
  },
  successCloseText: {
    fontSize: 28,
    fontFamily: 'CabinetGrotesk-Regular',
    color: COLORS.SECONDARY_TEXT,
    fontWeight: '300',
  },
  successCheckmarkContainer: {
    marginBottom: 20,
    marginTop: 12,
  },
  successCheckmark: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'transparent',
    borderWidth: 3,
    borderColor: COLORS.LIGHT_GREEN,
    justifyContent: 'center',
    alignItems: 'center',
  },
  successCheckmarkText: {
    fontSize: 40,
    fontFamily: 'CabinetGrotesk-Bold',
    color: COLORS.LIGHT_GREEN,
    fontWeight: 'bold',
  },
  successTitle: {
    fontSize: 24,
    fontFamily: 'CabinetGrotesk-Bold',
    fontWeight: 'bold',
    color: COLORS.VERY_LIGHT_GRAY,
    marginBottom: 32,
    textAlign: 'center',
  },
  successTxid: {
    fontSize: 12,
    color: COLORS.PRIMARY_BLUE,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    textAlign: 'center',
    marginBottom: 20,
  },
  // Confirmation Modal styles
  confirmationModal: {
    backgroundColor: COLORS.VERY_DARK_GRAY,
    borderRadius: 20,
    padding: 32,
    width: '85%',
    maxWidth: 400,
  },
  confirmationModalIconContainer: {
    alignItems: 'center',
    marginBottom: 16,
  },
  confirmationModalTitle: {
    fontSize: 24,
    fontFamily: 'CabinetGrotesk-Bold',
    fontWeight: 'bold',
    color: COLORS.VERY_LIGHT_GRAY,
    marginBottom: 16,
    textAlign: 'center',
  },
  confirmationModalText: {
    fontSize: 16,
    fontFamily: 'CabinetGrotesk-Regular',
    color: COLORS.VERY_LIGHT_GRAY,
    marginBottom: 25,
    textAlign: 'center',
    lineHeight: 22,
  },
  confirmationModalButtons: {
    gap: 12,
  },
  confirmationModalButton: {
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 12,
    alignItems: 'center',
  },
  confirmationModalButtonPrimary: {
    backgroundColor: COLORS.PRIMARY_BLUE,
  },
  confirmationModalButtonDestructive: {
    backgroundColor: COLORS.DANGER_RED,
  },
  confirmationModalButtonCancel: {
    backgroundColor: COLORS.OFF_WHITE,
  },
  confirmationModalButtonText: {
    fontSize: 16,
    fontFamily: 'CabinetGrotesk-Medium',
    fontWeight: '600',
    color: COLORS.VERY_LIGHT_GRAY,
  },
  confirmationModalButtonTextCancel: {
    fontSize: 16,
    fontFamily: 'CabinetGrotesk-Medium',
    fontWeight: '600',
    color: COLORS.DARK_GRAY,
  },
  errorText: {
    fontSize: 16,
    fontFamily: 'CabinetGrotesk-Regular',
    color: COLORS.DANGER_RED,
    marginBottom: 20,
    textAlign: 'center',
  },
});
