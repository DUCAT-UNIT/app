/**
 * Atomic Style Utilities
 * Composable style primitives - like Tailwind for React Native
 *
 * Usage:
 * import { u } from '../styles';
 * <View style={[u.flex1, u.bgPrimary, u.p4]} />
 */

import { StyleSheet } from 'react-native';
import { colors, spacing, radii, fonts, fontSizes, fontWeights, layout } from './theme';

// =============================================================================
// FLEX & LAYOUT
// =============================================================================

const flexStyles = StyleSheet.create({
  // Flex
  flex1: { flex: 1 },
  flexGrow: { flexGrow: 1 },
  flexShrink: { flexShrink: 1 },
  flexNone: { flex: 0 },

  // Direction
  row: { flexDirection: 'row' },
  col: { flexDirection: 'column' },
  rowReverse: { flexDirection: 'row-reverse' },
  colReverse: { flexDirection: 'column-reverse' },

  // Wrap
  wrap: { flexWrap: 'wrap' },
  nowrap: { flexWrap: 'nowrap' },

  // Justify
  justifyStart: { justifyContent: 'flex-start' },
  justifyEnd: { justifyContent: 'flex-end' },
  justifyCenter: { justifyContent: 'center' },
  justifyBetween: { justifyContent: 'space-between' },
  justifyAround: { justifyContent: 'space-around' },
  justifyEvenly: { justifyContent: 'space-evenly' },

  // Align
  itemsStart: { alignItems: 'flex-start' },
  itemsEnd: { alignItems: 'flex-end' },
  itemsCenter: { alignItems: 'center' },
  itemsStretch: { alignItems: 'stretch' },

  // Self
  selfStart: { alignSelf: 'flex-start' },
  selfEnd: { alignSelf: 'flex-end' },
  selfCenter: { alignSelf: 'center' },
  selfStretch: { alignSelf: 'stretch' },

  // Common combinations
  center: { alignItems: 'center', justifyContent: 'center' },
  rowCenter: { flexDirection: 'row', alignItems: 'center' },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  rowEnd: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end' },
  colCenter: { flexDirection: 'column', alignItems: 'center' },
});

// =============================================================================
// POSITIONING
// =============================================================================

const positionStyles = StyleSheet.create({
  relative: { position: 'relative' },
  absolute: { position: 'absolute' },
  absoluteFill: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  top0: { top: 0 },
  left0: { left: 0 },
  right0: { right: 0 },
  bottom0: { bottom: 0 },
  inset0: { top: 0, left: 0, right: 0, bottom: 0 },
});

// =============================================================================
// SPACING (Padding & Margin)
// =============================================================================

const spacingStyles = StyleSheet.create({
  // Padding - all sides
  p0: { padding: spacing[0] },
  p1: { padding: spacing.xs },
  p2: { padding: spacing.sm },
  p3: { padding: spacing.md },
  p4: { padding: spacing.lg },
  p5: { padding: spacing.xl },
  p6: { padding: spacing.xxl },

  // Padding - horizontal
  px0: { paddingHorizontal: spacing[0] },
  px1: { paddingHorizontal: spacing.xs },
  px2: { paddingHorizontal: spacing.sm },
  px3: { paddingHorizontal: spacing.md },
  px4: { paddingHorizontal: spacing.lg },
  px5: { paddingHorizontal: spacing.xl },

  // Padding - vertical
  py0: { paddingVertical: spacing[0] },
  py1: { paddingVertical: spacing.xs },
  py2: { paddingVertical: spacing.sm },
  py3: { paddingVertical: spacing.md },
  py4: { paddingVertical: spacing.lg },
  py5: { paddingVertical: spacing.xl },

  // Padding - sides
  pt0: { paddingTop: 0 },
  pt2: { paddingTop: spacing.sm },
  pt3: { paddingTop: spacing.md },
  pt4: { paddingTop: spacing.lg },
  pb0: { paddingBottom: 0 },
  pb2: { paddingBottom: spacing.sm },
  pb3: { paddingBottom: spacing.md },
  pb4: { paddingBottom: spacing.lg },
  pb5: { paddingBottom: spacing.xl },
  pl0: { paddingLeft: 0 },
  pl2: { paddingLeft: spacing.sm },
  pl3: { paddingLeft: spacing.md },
  pr0: { paddingRight: 0 },
  pr2: { paddingRight: spacing.sm },
  pr3: { paddingRight: spacing.md },

  // Margin - all sides
  m0: { margin: spacing[0] },
  m1: { margin: spacing.xs },
  m2: { margin: spacing.sm },
  m3: { margin: spacing.md },
  m4: { margin: spacing.lg },
  m5: { margin: spacing.xl },

  // Margin - horizontal
  mx0: { marginHorizontal: spacing[0] },
  mx1: { marginHorizontal: spacing.xs },
  mx2: { marginHorizontal: spacing.sm },
  mx3: { marginHorizontal: spacing.md },
  mx4: { marginHorizontal: spacing.lg },
  mxAuto: { marginHorizontal: 'auto' },

  // Margin - vertical
  my0: { marginVertical: spacing[0] },
  my1: { marginVertical: spacing.xs },
  my2: { marginVertical: spacing.sm },
  my3: { marginVertical: spacing.md },
  my4: { marginVertical: spacing.lg },

  // Margin - sides
  mt0: { marginTop: 0 },
  mt1: { marginTop: spacing.xs },
  mt2: { marginTop: spacing.sm },
  mt3: { marginTop: spacing.md },
  mt4: { marginTop: spacing.lg },
  mt5: { marginTop: spacing.xl },
  mb0: { marginBottom: 0 },
  mb1: { marginBottom: spacing.xs },
  mb2: { marginBottom: spacing.sm },
  mb3: { marginBottom: spacing.md },
  mb4: { marginBottom: spacing.lg },
  mb5: { marginBottom: spacing.xl },
  ml0: { marginLeft: 0 },
  ml2: { marginLeft: spacing.sm },
  ml3: { marginLeft: spacing.md },
  mr0: { marginRight: 0 },
  mr2: { marginRight: spacing.sm },
  mr3: { marginRight: spacing.md },
  mr4: { marginRight: spacing.lg },

  // Gap
  gap1: { gap: spacing.xs },
  gap2: { gap: spacing.sm },
  gap3: { gap: spacing.md },
  gap4: { gap: spacing.lg },

  // Screen padding
  pScreen: { paddingHorizontal: layout.padding },
});

// =============================================================================
// BACKGROUNDS
// =============================================================================

const bgStyles = StyleSheet.create({
  bgPrimary: { backgroundColor: colors.bg.primary },
  bgSecondary: { backgroundColor: colors.bg.secondary },
  bgTertiary: { backgroundColor: colors.bg.tertiary },
  bgWhite: { backgroundColor: colors.bg.white },
  bgTransparent: { backgroundColor: colors.bg.transparent },
  bgBrand: { backgroundColor: colors.brand.primary },
  bgBrandSecondary: { backgroundColor: colors.brand.secondary },
  bgAccent: { backgroundColor: colors.brand.accent },
  bgSuccess: { backgroundColor: colors.semantic.success },
  bgWarning: { backgroundColor: colors.semantic.warning },
  bgError: { backgroundColor: colors.semantic.error },
  bgErrorLight: { backgroundColor: colors.special.errorBg },
  bgOverlay: { backgroundColor: colors.special.overlay },
  bgOverlayLight: { backgroundColor: colors.special.overlayLight },
});

// =============================================================================
// TEXT
// =============================================================================

const textStyles = StyleSheet.create({
  // Font family
  fontRegular: { fontFamily: fonts.regular },
  fontMedium: { fontFamily: fonts.medium },
  fontBold: { fontFamily: fonts.bold },
  fontMono: { fontFamily: fonts.mono },

  // Font size
  textXs: { fontSize: fontSizes.xs },
  textSm: { fontSize: fontSizes.sm },
  textMd: { fontSize: fontSizes.md },
  textLg: { fontSize: fontSizes.lg },
  textXl: { fontSize: fontSizes.xl },
  text2xl: { fontSize: fontSizes.xxl },
  text3xl: { fontSize: fontSizes.xxxl },
  textDisplay: { fontSize: fontSizes.display },
  textGiant: { fontSize: fontSizes.giant },
  textHero: { fontSize: fontSizes.hero },

  // Font weight
  weightLight: { fontWeight: fontWeights.light },
  weightRegular: { fontWeight: fontWeights.regular },
  weightMedium: { fontWeight: fontWeights.medium },
  weightSemibold: { fontWeight: fontWeights.semibold },
  weightBold: { fontWeight: fontWeights.bold },

  // Text color
  textPrimary: { color: colors.text.primary },
  textSecondary: { color: colors.text.secondary },
  textTertiary: { color: colors.text.tertiary },
  textInverse: { color: colors.text.inverse },
  textWhite: { color: colors.text.white },
  textBlack: { color: colors.text.black },
  textBrand: { color: colors.brand.primary },
  textBrandSecondary: { color: colors.brand.secondary },
  textAccent: { color: colors.brand.accent },
  textSuccess: { color: colors.semantic.success },
  textWarning: { color: colors.semantic.warning },
  textError: { color: colors.semantic.error },

  // Text align
  textLeft: { textAlign: 'left' },
  textCenter: { textAlign: 'center' },
  textRight: { textAlign: 'right' },

  // Line height
  leadingTight: { lineHeight: 18 },
  leadingNormal: { lineHeight: 22 },
  leadingRelaxed: { lineHeight: 28 },

  // Typography presets
  h1: {
    fontFamily: fonts.bold,
    fontSize: fontSizes.xxxl,
    fontWeight: fontWeights.bold,
    color: colors.text.primary,
  },
  h2: {
    fontFamily: fonts.bold,
    fontSize: fontSizes.xl,
    fontWeight: fontWeights.bold,
    color: colors.text.primary,
  },
  h3: {
    fontFamily: fonts.bold,
    fontSize: fontSizes.lg,
    fontWeight: fontWeights.bold,
    color: colors.text.primary,
  },
  h4: {
    fontFamily: fonts.medium,
    fontSize: fontSizes.md,
    fontWeight: fontWeights.semibold,
    color: colors.text.primary,
  },
  body: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.md,
    color: colors.text.primary,
  },
  bodyMedium: {
    fontFamily: fonts.medium,
    fontSize: fontSizes.md,
    fontWeight: fontWeights.semibold,
    color: colors.text.primary,
  },
  caption: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.xs,
    color: colors.text.secondary,
  },
  label: {
    fontFamily: fonts.bold,
    fontSize: fontSizes.xs,
    fontWeight: fontWeights.bold,
    color: colors.text.secondary,
  },
});

// =============================================================================
// BORDERS
// =============================================================================

const borderStyles = StyleSheet.create({
  // Border width
  border0: { borderWidth: 0 },
  border1: { borderWidth: 1 },
  border2: { borderWidth: 2 },
  borderB1: { borderBottomWidth: 1 },
  borderB2: { borderBottomWidth: 2 },
  borderT1: { borderTopWidth: 1 },

  // Border color
  borderDefault: { borderColor: colors.border.default },
  borderLight: { borderColor: colors.border.light },
  borderFocus: { borderColor: colors.border.focus },
  borderBrand: { borderColor: colors.brand.primary },
  borderAccent: { borderColor: colors.brand.accent },
  borderError: { borderColor: colors.semantic.error },
  borderTransparent: { borderColor: 'transparent' },

  // Border radius
  roundedNone: { borderRadius: radii.none },
  roundedSm: { borderRadius: radii.sm },
  roundedMd: { borderRadius: radii.md },
  roundedLg: { borderRadius: radii.lg },
  roundedXl: { borderRadius: radii.xl },
  rounded2xl: { borderRadius: radii.xxl },
  roundedFull: { borderRadius: radii.full },

  // Border radius - specific corners
  roundedTopLg: { borderTopLeftRadius: radii.lg, borderTopRightRadius: radii.lg },
  roundedBottomLg: { borderBottomLeftRadius: radii.lg, borderBottomRightRadius: radii.lg },
});

// =============================================================================
// SIZING
// =============================================================================

const sizeStyles = StyleSheet.create({
  // Width
  wFull: { width: '100%' },
  wHalf: { width: '50%' },
  wScreen: { width: layout.screen.width },
  wAuto: { width: 'auto' },

  // Height
  hFull: { height: '100%' },
  hScreen: { height: layout.screen.height },
  hAuto: { height: 'auto' },

  // Min/Max
  minH0: { minHeight: 0 },
  maxWFull: { maxWidth: '100%' },
  maxW300: { maxWidth: 300 },
  maxW400: { maxWidth: 400 },
  maxW420: { maxWidth: 420 },
});

// =============================================================================
// MISC
// =============================================================================

const miscStyles = StyleSheet.create({
  // Overflow
  overflowHidden: { overflow: 'hidden' },
  overflowVisible: { overflow: 'visible' },

  // Opacity
  opacity0: { opacity: 0 },
  opacity30: { opacity: 0.3 },
  opacity50: { opacity: 0.5 },
  opacity70: { opacity: 0.7 },
  opacity100: { opacity: 1 },

  // Z-index
  z0: { zIndex: 0 },
  z10: { zIndex: 10 },
  z100: { zIndex: 100 },
  z1000: { zIndex: 1000 },
  zMax: { zIndex: 99999 },
});

// =============================================================================
// EXPORT COMBINED UTILITIES
// =============================================================================

export const u = {
  ...flexStyles,
  ...positionStyles,
  ...spacingStyles,
  ...bgStyles,
  ...textStyles,
  ...borderStyles,
  ...sizeStyles,
  ...miscStyles,
};

export default u;
