/**
 * Storybook Design Tokens
 * Centralized design system values for all stories
 * Reference: /DESIGN_SYSTEM.md
 */

// =============================================================================
// COLOR TOKENS
// =============================================================================

export const colors = {
  // Background
  bg: {
    primary: '#111015',      // Main app background
    secondary: '#1D1C21',    // Cards, elevated surfaces, headers
    tertiary: '#28272C',     // Input fields, nested containers
  },

  // Text
  text: {
    primary: '#DDDDDD',      // Primary body text, headings, button text
    secondary: '#8E8D90',    // Secondary labels, placeholders, captions
    tertiary: '#47464A',     // Disabled text, hints, muted elements (chevrons)
  },

  // Brand
  brand: {
    primary: '#1858E4',      // Primary actions, links, focus states
    accent: '#59AA8A',       // Success states, positive values
  },

  // Mutinynet Only - DO NOT use elsewhere
  mutinynet: {
    purple: '#8B5CF6',       // EXCLUSIVELY for Mutinynet banner
  },

  // Semantic
  semantic: {
    success: '#59AA8A',      // Positive transactions, confirmations
    warning: '#F5A623',      // Caution states, pending actions
    error: '#D04C68',        // Errors, destructive actions, negative values
    info: '#1858E4',         // Informational states
    highlight: '#F5E4A2',    // Highlight/accent yellow
  },

  // Border
  border: {
    default: '#28272C',      // Standard borders, dividers
    light: '#333333',        // Subtle separators
    focus: '#1858E4',        // Focus ring, active states
  },
} as const;

// =============================================================================
// SPACING TOKENS (4px base unit)
// =============================================================================

export const spacing = {
  0: 0,
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
  xxxl: 64,
} as const;

// =============================================================================
// TYPOGRAPHY TOKENS
// =============================================================================

export const fonts = {
  regular: 'CabinetGrotesk-Regular',
  medium: 'CabinetGrotesk-Medium',
  bold: 'CabinetGrotesk-Bold',
} as const;

export const fontSizes = {
  xs: 12,      // Captions, badges, timestamps
  sm: 14,      // Secondary text, descriptions
  md: 16,      // Body text, buttons, options
  lg: 20,      // Section headers, list titles
  xl: 24,      // Screen subtitles
  xxl: 28,     // Secondary headings
  xxxl: 32,    // Screen titles
  display: 36, // Featured amounts
  giant: 44,   // Hero amounts
  hero: 56,    // Dashboard balance
} as const;

export const fontWeights = {
  regular: '400' as const,
  medium: '500' as const,
  semibold: '600' as const,
  bold: '700' as const,
};

// =============================================================================
// BORDER RADIUS TOKENS
// =============================================================================

export const radii = {
  none: 0,
  sm: 4,       // Badges, tags
  md: 8,       // Buttons, inputs
  lg: 12,      // Standard cards
  xl: 16,      // Large cards, modals
  xxl: 20,     // Device frames
  phone: 24,   // Phone frame (storybook)
  full: 9999,  // Pills, circular elements
} as const;

// =============================================================================
// COMPONENT SIZES
// =============================================================================

export const sizes = {
  icon: {
    xs: 16,
    sm: 20,
    md: 24,    // Default
    lg: 32,
    xl: 40,
  },
  buttonHeight: {
    sm: 36,
    md: 48,    // Default
    lg: 56,
  },
  touchTarget: {
    min: 44,   // Minimum touch target
  },
  backButton: {
    width: 40,
    height: 40,
  },
} as const;

// =============================================================================
// DEVICE CONFIGURATIONS (for responsive stories)
// =============================================================================

export const DEVICE_CONFIGS = [
  { width: 320, size: 'XS' as const, label: 'iPhone SE', scale: 0.75 },
  { width: 375, size: 'S' as const, label: 'iPhone 8', scale: 0.85 },
  { width: 390, size: 'M' as const, label: 'iPhone 14', scale: 0.95 },
  { width: 393, size: 'L' as const, label: 'iPhone 14 Pro', scale: 1.0 },
  { width: 430, size: 'XL' as const, label: 'iPhone 14 Pro Max', scale: 1.1 },
];

export type ScreenSize = 'XS' | 'S' | 'M' | 'L' | 'XL';

// =============================================================================
// PHONE FRAME STYLING (for storybook)
// =============================================================================

export const phoneFrame = {
  borderRadius: radii.phone,
  borderWidth: 3,
  borderColor: colors.border.default,
  height: 700,
  overflow: 'hidden' as const,
};

// =============================================================================
// SCREEN LAYOUT TOKENS
// =============================================================================

export const layout = {
  screen: {
    paddingHorizontal: spacing.lg,  // 20px
    paddingBottom: spacing.xxl - 8, // 40px
  },
  header: {
    paddingHorizontal: spacing.lg,  // 20px
    paddingBottom: spacing.lg,      // 20px
  },
  section: {
    marginBottom: spacing.xl - 2,   // 30px
  },
  listItem: {
    paddingVertical: spacing.lg - 4, // 20px
    paddingHorizontal: spacing.xs,   // 4px
    gap: spacing.md,                 // 16px (icon to text)
  },
};

// =============================================================================
// MUTINYNET BANNER STYLING
// =============================================================================

export const mutinynetBanner = {
  backgroundColor: colors.bg.secondary,
  paddingVertical: spacing.sm,
  text: {
    color: colors.mutinynet.purple,
    fontSize: fontSizes.sm,
    fontWeight: fontWeights.medium,
  },
};
