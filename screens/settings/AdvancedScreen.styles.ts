/**
 * AdvancedScreen Styles
 */

import { StyleSheet, Dimensions } from 'react-native';
import { COLORS } from '../../theme';

// Get device dimensions for responsive sizing
const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Responsive horizontal padding
const HORIZONTAL_PADDING = SCREEN_WIDTH < 375 ? 16 : SCREEN_WIDTH > 414 ? 24 : 20;

export const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.DARK_BG,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 0,
    paddingHorizontal: HORIZONTAL_PADDING,
    paddingBottom: 20,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    marginRight: 8,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    paddingHorizontal: HORIZONTAL_PADDING,
    paddingBottom: 40,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: COLORS.VERY_LIGHT_GRAY,
    fontFamily: 'CabinetGrotesk-Bold',
    flex: 1,
  },
  section: {
    marginBottom: 30,
  },
  sectionTitle: {
    fontSize: 14,
    color: '#888',
    fontFamily: 'CabinetGrotesk-Regular',
    marginBottom: 16,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  clearCacheButton: {
    backgroundColor: '#1A1A1A',
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 107, 107, 0.2)',
  },
  clearCacheContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  clearCacheTextContainer: {
    flex: 1,
  },
  clearCacheTitle: {
    fontSize: 16,
    color: '#FF6B6B',
    fontWeight: '500',
    fontFamily: 'CabinetGrotesk-Medium',
    marginBottom: 4,
  },
  clearCacheSubtitle: {
    fontSize: 13,
    color: '#888',
    fontFamily: 'CabinetGrotesk-Regular',
    lineHeight: 18,
  },
  spinner: {
    marginLeft: 12,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 20,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.BORDER_COLOR,
  },
  optionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 16,
  },
  optionTitle: {
    fontSize: 16,
    color: COLORS.VERY_LIGHT_GRAY,
    fontWeight: '400',
    fontFamily: 'CabinetGrotesk-Regular',
  },
  optionRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  optionRightText: {
    fontSize: 14,
    color: '#888',
    fontFamily: 'CabinetGrotesk-Regular',
  },
  optionArrow: {
    fontSize: 24,
    color: '#666',
    marginLeft: 4,
    fontFamily: 'CabinetGrotesk-Regular',
  },
  journalPanel: {
    marginTop: 20,
    padding: 16,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: COLORS.BORDER_COLOR,
  },
  journalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 14,
  },
  journalTitle: {
    fontSize: 16,
    color: COLORS.VERY_LIGHT_GRAY,
    fontWeight: '600',
    fontFamily: 'CabinetGrotesk-Medium',
  },
  journalSubtitle: {
    marginTop: 4,
    fontSize: 13,
    color: '#888',
    fontFamily: 'CabinetGrotesk-Regular',
  },
  journalClearButton: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  journalClearText: {
    fontSize: 12,
    color: COLORS.VERY_LIGHT_GRAY,
    fontFamily: 'CabinetGrotesk-Medium',
  },
  journalEmptyText: {
    fontSize: 14,
    color: '#888',
    fontFamily: 'CabinetGrotesk-Regular',
  },
  journalEntry: {
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.BORDER_COLOR,
  },
  journalEntryTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  journalEntryTitle: {
    flex: 1,
    fontSize: 14,
    color: COLORS.VERY_LIGHT_GRAY,
    fontFamily: 'CabinetGrotesk-Medium',
  },
  journalEntryStage: {
    fontSize: 12,
    color: '#9BE870',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    fontFamily: 'CabinetGrotesk-Medium',
  },
  journalEntryLabel: {
    marginTop: 4,
    fontSize: 13,
    color: '#B8B8B8',
    fontFamily: 'CabinetGrotesk-Regular',
  },
  journalEntryMeta: {
    marginTop: 4,
    fontSize: 12,
    color: '#777',
    fontFamily: 'CabinetGrotesk-Regular',
  },
  journalRecoveryText: {
    marginTop: 8,
    fontSize: 12,
    color: '#FFB86B',
    lineHeight: 16,
    fontFamily: 'CabinetGrotesk-Regular',
  },
  passwordModalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.72)',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  passwordModalCard: {
    borderRadius: 28,
    padding: 22,
    backgroundColor: COLORS.DARK_BG,
    borderWidth: 1,
    borderColor: COLORS.BORDER_COLOR,
  },
  passwordModalTitle: {
    fontSize: 26,
    color: COLORS.VERY_LIGHT_GRAY,
    fontFamily: 'CabinetGrotesk-Bold',
    marginBottom: 8,
  },
  passwordModalBody: {
    fontSize: 15,
    lineHeight: 22,
    color: '#A6A6A6',
    fontFamily: 'CabinetGrotesk-Regular',
    marginBottom: 18,
  },
  passwordInput: {
    minHeight: 56,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.BORDER_COLOR,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    color: COLORS.VERY_LIGHT_GRAY,
    fontSize: 17,
    fontFamily: 'CabinetGrotesk-Regular',
    paddingHorizontal: 16,
    marginBottom: 18,
  },
  passwordErrorText: {
    color: '#FF6B6B',
    fontSize: 13,
    fontFamily: 'CabinetGrotesk-Regular',
    marginTop: -8,
    marginBottom: 14,
  },
  passwordModalActions: {
    flexDirection: 'row',
    gap: 12,
  },
  passwordModalButton: {
    flex: 1,
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 999,
  },
  passwordModalSecondaryButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  passwordModalPrimaryButton: {
    backgroundColor: COLORS.PRIMARY_BLUE,
  },
  passwordModalSecondaryText: {
    color: COLORS.VERY_LIGHT_GRAY,
    fontSize: 16,
    fontFamily: 'CabinetGrotesk-Medium',
  },
  passwordModalPrimaryText: {
    color: COLORS.WHITE,
    fontSize: 16,
    fontFamily: 'CabinetGrotesk-Medium',
  },
});
