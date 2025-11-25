/**
 * CashuReceiveScreen Styles
 */

import { StyleSheet, Dimensions } from 'react-native';
import { COLORS } from '../../theme';

const SCREEN_WIDTH = Dimensions.get('window').width;
export const HORIZONTAL_PADDING = SCREEN_WIDTH < 375 ? 16 : 20;
export const QR_SIZE = SCREEN_WIDTH < 375 ? Math.min(SCREEN_WIDTH * 0.5, 180) : Math.min(SCREEN_WIDTH * 0.6, 220);
export const LOGO_SIZE = Math.floor(QR_SIZE * 0.21);

export default StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.DARK_BG,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: HORIZONTAL_PADDING,
    paddingVertical: 16,
    marginTop: 8,
  },
  headerTitle: {
    fontSize: SCREEN_WIDTH < 375 ? 18 : 20,
    fontWeight: '700',
    fontFamily: 'CabinetGrotesk-Bold',
    color: COLORS.VERY_LIGHT_GRAY,
  },
  choiceContainer: {
    flex: 1,
    paddingHorizontal: HORIZONTAL_PADDING,
    paddingTop: 24,
    gap: 16,
  },
  choiceCard: {
    backgroundColor: COLORS.CARD_BG,
    borderRadius: 16,
    padding: 28,
    alignItems: 'center',
    gap: 16,
    borderWidth: 1,
    borderColor: COLORS.BORDER_COLOR,
  },
  choiceTitle: {
    fontSize: 20,
    fontWeight: '700',
    fontFamily: 'CabinetGrotesk-Bold',
    color: COLORS.VERY_LIGHT_GRAY,
  },
  choiceDesc: {
    fontSize: 14,
    fontFamily: 'CabinetGrotesk-Regular',
    color: COLORS.SECONDARY_TEXT,
    textAlign: 'center',
    lineHeight: 20,
  },
  scrollContent: {
    paddingHorizontal: HORIZONTAL_PADDING,
    paddingTop: 32,
    paddingBottom: 32,
    alignItems: 'center',
    flexGrow: 1,
  },
  qrContainer: {
    backgroundColor: COLORS.WHITE,
    padding: SCREEN_WIDTH < 375 ? 16 : 20,
    borderRadius: 16,
    marginBottom: 32,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
  },
  instructionText: {
    fontSize: SCREEN_WIDTH < 375 ? 16 : 18,
    fontWeight: '700',
    fontFamily: 'CabinetGrotesk-Bold',
    color: COLORS.VERY_LIGHT_GRAY,
    marginBottom: 24,
    textAlign: 'center',
  },
  addressContainer: {
    width: '100%',
    backgroundColor: COLORS.CARD_BG,
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: COLORS.BORDER_COLOR,
  },
  addressLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  addressLabelText: {
    fontSize: 12,
    fontFamily: 'CabinetGrotesk-Medium',
    color: COLORS.SECONDARY_TEXT,
    fontWeight: '600',
  },
  tapToCopyText: {
    fontSize: 12,
    color: COLORS.PRIMARY_BLUE,
    fontFamily: 'CabinetGrotesk-Medium',
  },
  addressText: {
    fontSize: 14,
    fontFamily: 'CabinetGrotesk-Regular',
    color: COLORS.VERY_LIGHT_GRAY,
    lineHeight: 20,
  },
  waitingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    padding: 20,
    backgroundColor: COLORS.CARD_BG,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.BORDER_COLOR,
  },
  waitingText: {
    fontSize: 14,
    fontFamily: 'CabinetGrotesk-Medium',
    color: COLORS.SECONDARY_TEXT,
  },
  inputContainer: {
    flex: 1,
    paddingHorizontal: HORIZONTAL_PADDING,
    paddingTop: 24,
    paddingBottom: 24,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    fontFamily: 'CabinetGrotesk-Medium',
    color: COLORS.VERY_LIGHT_GRAY,
    marginBottom: 12,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.CARD_BG,
    borderRadius: 12,
    padding: 16,
    gap: 12,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: COLORS.BORDER_COLOR,
  },
  textAreaWrapper: {
    alignItems: 'flex-start',
  },
  input: {
    flex: 1,
    fontSize: 16,
    fontFamily: 'CabinetGrotesk-Regular',
    color: COLORS.VERY_LIGHT_GRAY,
  },
  textArea: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  pasteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.BORDER_COLOR,
    backgroundColor: 'transparent',
    marginBottom: 16,
  },
  pasteButtonText: {
    fontSize: 16,
    fontWeight: '600',
    fontFamily: 'CabinetGrotesk-Medium',
    color: COLORS.VERY_LIGHT_GRAY,
  },
  button: {
    backgroundColor: COLORS.PRIMARY_BLUE,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
    fontFamily: 'CabinetGrotesk-Medium',
    color: COLORS.WHITE,
  },
  helpText: {
    fontSize: 13,
    fontFamily: 'CabinetGrotesk-Regular',
    color: COLORS.SECONDARY_TEXT,
    textAlign: 'center',
    marginTop: 16,
    lineHeight: 18,
    paddingHorizontal: 20,
  },
});
