/**
 * AddressInputScreen Styles
 * Modern, clean design for address input
 */

import { StyleSheet } from 'react-native';
import { COLORS } from '../../theme';

export default StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.DARK_BG,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    marginRight: 8,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: COLORS.VERY_LIGHT_GRAY,
    fontFamily: 'CabinetGrotesk-Bold',
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  // Hero section with asset indicator
  heroSection: {
    alignItems: 'center',
    paddingVertical: 24,
    marginBottom: 8,
  },
  assetIconContainer: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: COLORS.CARD_BG,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 2,
    borderColor: COLORS.BORDER_COLOR,
  },
  heroTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: COLORS.VERY_LIGHT_GRAY,
    fontFamily: 'CabinetGrotesk-Bold',
    marginBottom: 4,
  },
  heroSubtitle: {
    fontSize: 14,
    color: COLORS.SECONDARY_TEXT,
    fontFamily: 'CabinetGrotesk-Regular',
  },
  // Input section
  inputSection: {
    marginBottom: 16,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  labelRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  label: {
    fontSize: 14,
    color: COLORS.SECONDARY_TEXT,
    fontFamily: 'CabinetGrotesk-Medium',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  switch: {
    transform: [{ scaleX: 0.8 }, { scaleY: 0.8 }],
  },
  inputContainer: {
    backgroundColor: COLORS.CARD_BG,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.BORDER_COLOR,
    overflow: 'hidden',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: COLORS.VERY_LIGHT_GRAY,
    fontFamily: 'CabinetGrotesk-Regular',
    minHeight: 52,
    paddingTop: 4,
    lineHeight: 22,
  },
  // Action buttons row inside input container
  actionButtonsRow: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: COLORS.BORDER_COLOR,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    gap: 8,
  },
  actionButtonDivider: {
    width: 1,
    backgroundColor: COLORS.BORDER_COLOR,
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.PRIMARY_BLUE,
    fontFamily: 'CabinetGrotesk-Medium',
  },
  // Legacy paste button (for inline use)
  pasteButton: {
    backgroundColor: COLORS.PRIMARY_BLUE,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginLeft: 12,
  },
  errorContainer: {
    minHeight: 24,
    paddingTop: 8,
    paddingHorizontal: 4,
  },
  errorText: {
    fontSize: 13,
    color: COLORS.DANGER_RED,
    fontFamily: 'CabinetGrotesk-Regular',
  },
  // Valid address indicator
  validIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingTop: 8,
    paddingHorizontal: 4,
  },
  validText: {
    fontSize: 13,
    color: COLORS.GREEN,
    fontFamily: 'CabinetGrotesk-Regular',
  },
  // Bottom button
  buttonContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: COLORS.DARK_BG,
    borderTopWidth: 1,
    borderTopColor: COLORS.BORDER_COLOR,
  },
  continueButton: {
    backgroundColor: COLORS.PRIMARY_BLUE,
    borderRadius: 14,
    paddingVertical: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  continueButtonDisabled: {
    backgroundColor: COLORS.MID_DARK_GRAY,
    opacity: 0.5,
  },
  continueButtonText: {
    fontSize: 17,
    fontWeight: '600',
    color: COLORS.WHITE,
    fontFamily: 'CabinetGrotesk-Bold',
  },
  // Turbo warning
  turboWarningContainer: {
    backgroundColor: COLORS.YELLOW + '15',
    borderRadius: 12,
    padding: 16,
    marginTop: 8,
    borderWidth: 1,
    borderColor: COLORS.YELLOW + '25',
  },
  turboWarningTextContainer: {
    alignItems: 'center',
  },
  turboWarningTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.VERY_LIGHT_GRAY,
    fontFamily: 'CabinetGrotesk-Bold',
    marginBottom: 4,
    textAlign: 'center',
  },
  turboWarningText: {
    fontSize: 13,
    lineHeight: 18,
    color: COLORS.SECONDARY_TEXT,
    fontFamily: 'CabinetGrotesk-Regular',
    textAlign: 'center',
  },
  // Info hint
  hintContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: COLORS.CARD_BG,
    borderRadius: 12,
    padding: 14,
    marginTop: 16,
    gap: 10,
  },
  hintIconContainer: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: COLORS.PRIMARY_BLUE + '20',
    justifyContent: 'center',
    alignItems: 'center',
  },
  hintText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
    color: COLORS.SECONDARY_TEXT,
    fontFamily: 'CabinetGrotesk-Regular',
  },
});
