# Ducat Design System

A comprehensive design system reference for maintaining visual consistency across the Ducat application. This document serves as the single source of truth for all design decisions and implementation standards.

---

## Table of Contents

1. [Design Principles](#design-principles)
2. [Color System](#color-system)
3. [Typography](#typography)
4. [Spacing & Layout](#spacing--layout)
5. [Iconography](#iconography)
6. [Shadows & Elevation](#shadows--elevation)
7. [Border & Radius](#border--radius)
8. [Component Specifications](#component-specifications)
9. [Responsive Design](#responsive-design)
10. [Motion & Animation](#motion--animation)
11. [Loading States](#loading-states)
12. [Toasts & Snackbars](#toasts--snackbars)
13. [Z-Index Architecture](#z-index-architecture)
14. [Safe Zones & Margins](#safe-zones--margins)
15. [Accessibility Guidelines](#accessibility-guidelines)
16. [Platform-Specific Guidelines](#platform-specific-guidelines)
17. [Implementation Reference](#implementation-reference)

---

## Design Principles

### Core Values

| Principle | Description |
|-----------|-------------|
| **Dark-First** | Optimized for dark mode viewing with deep blacks and high contrast |
| **Clarity** | Financial data must be instantly readable; no visual clutter |
| **Consistency** | Every screen feels familiar through reusable patterns |
| **Hierarchy** | Important actions and information stand out naturally |
| **Trust** | Security-focused UI communicates safety and reliability |

### Visual Language

- Clean, minimal interfaces with purposeful whitespace
- High contrast text for readability
- Accent colors reserved for actionable elements
- Monochromatic base with strategic color highlights

---

## Color System

### Background Colors

| Token | Hex | Usage |
|-------|-----|-------|
| `bg.primary` | `#111015` | Main app background, default screen color |
| `bg.secondary` | `#1D1C21` | Cards, elevated surfaces, headers |
| `bg.tertiary` | `#28272C` | Input fields, nested containers |
| `bg.white` | `#FFFFFF` | Rare; inverse surfaces only |
| `bg.transparent` | `transparent` | Overlay backgrounds |

### Text Colors

| Token | Hex | Usage |
|-------|-----|-------|
| `text.primary` | `#DDDDDD` | Primary body text, headings, button text |
| `text.secondary` | `#8E8D90` | Secondary labels, placeholders, captions |
| `text.tertiary` | `#47464A` | Disabled text, hints, muted elements |
| `text.inverse` | `#111015` | Text on light backgrounds |

> **Note:** Use `#DDDDDD` for all light text needs. Do not use pure white (#FFFFFF).

### Brand Colors

| Token | Hex | Usage |
|-------|-----|-------|
| `brand.primary` | `#1858E4` | Primary actions, links, focus states |
| `brand.accent` | `#59AA8A` | Success states, positive values |

### Mutinynet-Only Color

| Token | Hex | Usage |
|-------|-----|-------|
| `mutinynet.purple` | `#8B5CF6` | **Exclusively** for Mutinynet banner text. Do not use elsewhere. |

### Semantic Colors

| Token | Hex | Usage |
|-------|-----|-------|
| `semantic.success` | `#59AA8A` | Positive transactions, confirmations |
| `semantic.warning` | `#F5A623` | Caution states, pending actions |
| `semantic.error` | `#D04C68` | Errors, destructive actions, negative values |
| `semantic.info` | `#1858E4` | Informational states |
| `semantic.highlight` | `#F5E4A2` | Highlight/accent yellow, soft emphasis |

### Special Colors

| Token | Hex | Usage |
|-------|-----|-------|
| `special.bitcoin` | `#FFB800` | Bitcoin-specific elements |
| `special.overlay` | `rgba(0, 0, 0, 0.7)` | Modal overlays |
| `special.overlayLight` | `rgba(0, 0, 0, 0.5)` | Light overlays |
| `special.errorBg` | `#FFF5F7` | Error background (light) |

### Border Colors

| Token | Hex | Usage |
|-------|-----|-------|
| `border.default` | `#28272C` | Standard borders, dividers |
| `border.light` | `#333333` | Subtle separators |
| `border.focus` | `#1858E4` | Focus ring, active states |

### Color Usage Guidelines

```
Primary Actions:     brand.primary (#1858E4)
Destructive Actions: semantic.error (#D04C68)
Success States:      semantic.success (#59AA8A)
Warning States:      semantic.warning (#F5A623)
Highlight/Accent:    semantic.highlight (#F5E4A2)
Disabled Elements:   text.tertiary (#47464A)
Card Backgrounds:    bg.secondary (#1D1C21)
Mutinynet Banner:    mutinynet.purple (#8B5CF6) - ONLY for Mutinynet
```

### Color Don'ts

- **Never** use `#FFFFFF` for text - use `#DDDDDD` instead
- **Never** use `#8B5CF6` outside of Mutinynet banner
- **Never** use `#666666` for tertiary text - use `#47464A`

---

## Typography

### Font Family

| Weight | Font Name | Usage |
|--------|-----------|-------|
| Regular (400) | `CabinetGrotesk-Regular` | Body text, descriptions |
| Medium (500-600) | `CabinetGrotesk-Medium` | Subheadings, labels, buttons |
| Bold (700) | `CabinetGrotesk-Bold` | Headings, emphasis, amounts |
| Monospace | `Courier` (iOS) / `monospace` (Android) | Addresses, codes, hashes |

### Font Size Scale

| Token | Size | Line Height | Usage |
|-------|------|-------------|-------|
| `xs` | 12px | 1.4 | Captions, badges, timestamps |
| `sm` | 14px | 1.4 | Secondary text, descriptions |
| `md` | 16px | 1.4 | Body text, buttons, options |
| `lg` | 20px | 1.4 | Section headers, list titles |
| `xl` | 24px | 1.1 | Screen subtitles |
| `xxl` | 28px | 1.1 | Secondary headings |
| `xxxl` | 32px | 1.1 | Screen titles |
| `display` | 36px | 1.1 | Featured amounts |
| `giant` | 44px | 1.1 | Hero amounts |
| `hero` | 56px | 1.1 | Dashboard balance |

### Typography Variants

#### Headings

| Variant | Font Size | Font Weight | Font Family |
|---------|-----------|-------------|-------------|
| `h1` | 32px | 700 (Bold) | CabinetGrotesk-Bold |
| `h2` | 28px | 700 (Bold) | CabinetGrotesk-Bold |
| `h3` | 24px | 700 (Bold) | CabinetGrotesk-Bold |
| `h4` | 20px | 600 (SemiBold) | CabinetGrotesk-Medium |
| `h5` | 18px | 600 (SemiBold) | CabinetGrotesk-Medium |
| `h6` | 16px | 600 (SemiBold) | CabinetGrotesk-Medium |

#### Body Text

| Variant | Font Size | Font Weight | Font Family |
|---------|-----------|-------------|-------------|
| `body` | 16px | 400 (Regular) | CabinetGrotesk-Regular |
| `bodyMedium` | 16px | 600 (SemiBold) | CabinetGrotesk-Medium |
| `bodySmall` | 14px | 400 (Regular) | CabinetGrotesk-Regular |

#### Labels & Captions

| Variant | Font Size | Font Weight | Font Family |
|---------|-----------|-------------|-------------|
| `caption` | 12px | 400 (Regular) | CabinetGrotesk-Regular |
| `captionBold` | 12px | 700 (Bold) | CabinetGrotesk-Bold |
| `label` | 12px | 700 (Bold) | CabinetGrotesk-Bold |

#### Buttons

| Variant | Font Size | Font Weight | Font Family |
|---------|-----------|-------------|-------------|
| `button` | 16px | 700 (Bold) | CabinetGrotesk-Bold |
| `buttonMedium` | 16px | 600 (SemiBold) | CabinetGrotesk-Medium |

### Line Heights

| Token | Value | Usage |
|-------|-------|-------|
| `tight` | 1.1 | Headings, large display text |
| `normal` | 1.4 | Body text, general content |
| `relaxed` | 1.6 | Long-form content, descriptions |

### Typography by Screen Element

| Element | Variant | Color |
|---------|---------|-------|
| Screen Title | h1 (32px Bold) | text.primary (#DDDDDD) |
| Section Header | h4 (20px SemiBold) | text.primary (#DDDDDD) |
| List Item Title | body (16px Regular) | text.primary (#DDDDDD) |
| List Item Subtitle | bodySmall (14px Regular) | text.secondary (#8E8D90) |
| Button Text | button (16px Bold) | text.primary (#DDDDDD) |
| Input Placeholder | body (16px Regular) | text.tertiary (#47464A) |
| Amount Display (Hero) | hero (56px Bold) | text.primary (#DDDDDD) |
| Amount Display (Card) | display (36px Bold) | text.primary (#DDDDDD) |

---

## Spacing & Layout

### Spacing Scale (4px base unit)

| Token | Value | Usage |
|-------|-------|-------|
| `0` | 0px | No spacing |
| `xs` | 4px | Tight inline spacing, icon margins |
| `sm` | 8px | Compact element gaps, small padding |
| `md` | 16px | Standard padding, common gaps |
| `lg` | 24px | Section padding, generous gaps |
| `xl` | 32px | Large section separators |
| `xxl` | 48px | Major section breaks |
| `xxxl` | 64px | Screen-level spacing |

### Common Spacing Patterns

```
Component Internal Padding:     16px (md)
Card Internal Padding:          16px - 20px (md - lg)
List Item Vertical Padding:     20px
Screen Horizontal Padding:      16px - 24px (device-dependent)
Section Gap:                    24px - 32px (lg - xl)
Icon-to-Text Gap:               16px (md)
Button Internal Padding:        Horizontal: 24px, Vertical: based on height
```

### Screen Horizontal Padding (Responsive)

| Screen Width | Padding |
|--------------|---------|
| < 375px | 16px |
| 375px - 414px | 20px |
| > 414px | 24px |

---

## Iconography

### Icon Size Scale

| Token | Size | Usage |
|-------|------|-------|
| `xs` | 16px | Inline icons, badges, compact UI |
| `sm` | 20px | Small buttons, list indicators |
| `md` | 24px | **Default** - List items, standard actions |
| `lg` | 32px | Featured actions, prominent icons |
| `xl` | 40px | Hero icons, empty states |

### Default Icon Properties

```typescript
{
  size: 24,           // Default size (md)
  color: '#DDDDDD'    // Default color (text.primary)
}
```

### Icon Categories

| Category | Examples | Description |
|----------|----------|-------------|
| **Navigation** | `back`, `close`, `home`, `settings` | Core navigation elements |
| **Wallet** | `wallet`, `vault`, `asset`, `fuse`, `turbo` | Wallet-specific actions |
| **Security** | `face_id`, `recovery_phrase`, `switch_account` | Security features |
| **Brand** | `unit_logo`, `bitcoin` | Brand elements |
| **UI** | `copy`, `paste`, `delete`, `check`, `share` | General UI actions |

### Icon Usage by Context

| Context | Icon Size | Color |
|---------|-----------|-------|
| Navigation Header (Back) | 24px | text.primary (#DDDDDD) |
| Settings List Item | 24px | text.primary (#DDDDDD) |
| Tab Bar (inactive) | 24px - 28px | text.secondary (#8E8D90) |
| Tab Bar (active) | 24px - 28px | brand.primary (#1858E4) |
| Action Button | 20px - 24px | text.primary (#DDDDDD) |
| Destructive Action | 24px | semantic.error (#D04C68) |
| Empty State | 40px - 48px | text.tertiary (#47464A) |
| Toast/Alert | 20px | semantic.* (based on type) |

### Icon Styling Guidelines

- Stroke-based icons (not filled) for consistency
- Stroke width: 1px for standard, 1.5-2px for emphasis
- Maintain square viewBox (24x24 standard)
- Use `strokeLinecap: round` and `strokeLinejoin: round`

---

## Shadows & Elevation

### Shadow Scale

| Token | iOS Properties | Android Elevation | Usage |
|-------|---------------|-------------------|-------|
| `none` | offset: 0, opacity: 0 | 0 | Flat elements |
| `sm` | offset: {0, 1}, opacity: 0.1, radius: 2 | 2 | Subtle lift, buttons |
| `md` | offset: {0, 2}, opacity: 0.15, radius: 4 | 4 | Cards, dropdowns |
| `lg` | offset: {0, 4}, opacity: 0.2, radius: 8 | 8 | Modals, floating elements |
| `xl` | offset: {0, 8}, opacity: 0.3, radius: 16 | 16 | Popovers, tooltips |

### Shadow Implementation

```typescript
// Small Shadow
{
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 1 },
  shadowOpacity: 0.1,
  shadowRadius: 2,
  elevation: 2,  // Android
}

// Large Shadow
{
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.2,
  shadowRadius: 8,
  elevation: 8,  // Android
}
```

### Elevation Guidelines

| Layer | Elevation | Example |
|-------|-----------|---------|
| Base Content | none | Screen background |
| Cards | sm - md | Transaction cards, asset lists |
| Fixed Headers | md | Sticky navigation |
| Modals | lg | Bottom sheets, dialogs |
| Tooltips | xl | Hover states, popovers |

---

## Border & Radius

### Border Radius Scale

| Token | Value | Usage |
|-------|-------|-------|
| `none` | 0px | Sharp corners, dividers |
| `sm` | 4px | Badges, tags, small elements |
| `md` | 8px | Buttons, inputs, small cards |
| `lg` | 12px | Standard cards, containers |
| `xl` | 16px | Large cards, modals |
| `xxl` | 20px | Device frames, featured cards |
| `full` | 9999px | Pills, circular elements |

### Border Radius by Component

| Component | Border Radius |
|-----------|--------------|
| Primary Button | 8px (md) |
| Input Field | 8px (md) |
| Card | 12px (lg) |
| Modal/Bottom Sheet | 16px - 20px (xl - xxl) |
| Avatar (circular) | 9999px (full) |
| Tag/Badge | 4px (sm) |
| Phone Frame (Storybook) | 24px |

### Border Widths

| Usage | Width |
|-------|-------|
| Standard border | 1px |
| Divider line | 1px |
| Focus ring | 2px |
| Device frame (Storybook) | 3px |

---

## Component Specifications

### Buttons

#### Button Heights

| Size | Height | Usage |
|------|--------|-------|
| `sm` | 36px | Compact actions, inline buttons |
| `md` | 48px | **Default** - Primary actions |
| `lg` | 56px | Featured CTA, onboarding |

#### Button Variants

| Variant | Background | Text Color | Border |
|---------|------------|------------|--------|
| Primary | brand.primary (#1858E4) | text.primary (#DDDDDD) | None |
| Secondary | bg.tertiary (#28272C) | text.primary (#DDDDDD) | None |
| Outline | transparent | brand.primary (#1858E4) | 1px brand.primary |
| Danger | semantic.error (#D04C68) | text.primary (#DDDDDD) | None |
| Ghost | transparent | text.primary (#DDDDDD) | None |

#### Button Styling

```typescript
{
  height: 48,                    // md default
  borderRadius: 8,               // md radius
  paddingHorizontal: 24,         // lg spacing
  fontSize: 16,                  // md font
  fontFamily: 'CabinetGrotesk-Bold',
  fontWeight: '700',
}
```

### Input Fields

| Property | Value |
|----------|-------|
| Height (standard) | 48px |
| Height (large) | 56px |
| Border Radius | 8px (md) |
| Border Color (default) | border.default (#28272C) |
| Border Color (focus) | border.focus (#1858E4) |
| Background | bg.tertiary (#28272C) |
| Padding Horizontal | 16px |
| Font Size | 16px |
| Placeholder Color | text.tertiary (#47464A) |

### Cards

| Property | Value |
|----------|-------|
| Height (standard) | 80px |
| Height (large) | 100px |
| Border Radius | 12px (lg) |
| Background | bg.secondary (#1D1C21) |
| Padding | 16px |
| Border (optional) | 1px border.default |

### Avatars

| Size | Dimensions | Usage |
|------|------------|-------|
| `sm` | 32x32px | Compact lists, inline |
| `md` | 40x40px | Standard lists |
| `lg` | 54x54px | Profile sections |
| `xl` | 72x72px | Featured profiles |

### List Items (Settings Style)

```typescript
{
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'space-between',
  paddingVertical: 20,
  paddingHorizontal: 4,
  borderBottomWidth: 1,
  borderBottomColor: '#28272C',  // border.default
}

// Left side
{
  flexDirection: 'row',
  alignItems: 'center',
  gap: 16,  // Icon to text gap
}

// Title text
{
  fontSize: 16,
  color: '#DDDDDD',  // text.primary
  fontWeight: '400',
}

// Arrow/Chevron
{
  fontSize: 24,
  color: '#47464A',  // text.tertiary
}
```

### Navigation Bar (Header)

| Property | Value |
|----------|-------|
| Height | 56px (content area, excluding status bar) |
| Background | bg.primary (#111015) or bg.secondary (#1D1C21) |
| Padding Horizontal | 20px |
| Title Font | h1 (32px Bold) or h3 (24px Bold) |
| Title Color | text.primary (#DDDDDD) |
| Back Button Size | 40x40px touch target |
| Back Icon Size | 24px |

```typescript
// Navigation Header
{
  flexDirection: 'row',
  alignItems: 'center',
  paddingHorizontal: 20,
  paddingBottom: 20,
  backgroundColor: '#111015',  // bg.primary
}

// Back Button
{
  width: 40,
  height: 40,
  justifyContent: 'center',
  marginRight: 8,
}

// Title
{
  fontSize: 32,
  fontWeight: 'bold',
  color: '#DDDDDD',  // text.primary
  flex: 1,
}
```

### Tab Bar

| Property | Value |
|----------|-------|
| Height | 49px (content) + safe area inset |
| Background | bg.secondary (#1D1C21) |
| Border Top | 1px border.default (#28272C) |
| Item Width | Equal distribution (screen width / tab count) |
| Icon Size | 24px |
| Label Font | caption (12px Regular) |
| Active Color | brand.primary (#1858E4) |
| Inactive Color | text.secondary (#8E8D90) |

```typescript
// Tab Bar Container
{
  flexDirection: 'row',
  height: 49,
  backgroundColor: '#1D1C21',  // bg.secondary
  borderTopWidth: 1,
  borderTopColor: '#28272C',   // border.default
  paddingBottom: safeAreaInsets.bottom,
}

// Tab Item
{
  flex: 1,
  alignItems: 'center',
  justifyContent: 'center',
  paddingVertical: 8,
}

// Tab Label
{
  fontSize: 12,
  marginTop: 4,
  color: '#8E8D90',  // inactive: text.secondary
  // color: '#1858E4', // active: brand.primary
}
```

### Modals & Bottom Sheets

| Property | Value |
|----------|-------|
| Overlay Background | rgba(0, 0, 0, 0.7) |
| Sheet Background | bg.secondary (#1D1C21) |
| Border Radius (top) | 20px (xxl) |
| Handle Bar Width | 36px |
| Handle Bar Height | 4px |
| Handle Bar Color | border.light (#333333) |
| Padding Top | 12px (to handle) |
| Content Padding | 20px |
| Max Height | 90% of screen |

```typescript
// Bottom Sheet Container
{
  backgroundColor: '#1D1C21',  // bg.secondary
  borderTopLeftRadius: 20,
  borderTopRightRadius: 20,
  paddingTop: 12,
  paddingHorizontal: 20,
  paddingBottom: 40,
  maxHeight: '90%',
}

// Handle Bar
{
  width: 36,
  height: 4,
  backgroundColor: '#333333',  // border.light
  borderRadius: 2,
  alignSelf: 'center',
  marginBottom: 20,
}

// Modal Overlay
{
  flex: 1,
  backgroundColor: 'rgba(0, 0, 0, 0.7)',
  justifyContent: 'flex-end',  // bottom sheet
  // justifyContent: 'center', // centered modal
}
```

### Toggles / Switches

| Property | Value |
|----------|-------|
| Track Width | 51px |
| Track Height | 31px |
| Track Border Radius | 16px (full) |
| Thumb Size | 27px |
| Track Color (off) | bg.tertiary (#28272C) |
| Track Color (on) | brand.primary (#1858E4) |
| Thumb Color | text.primary (#DDDDDD) |

```typescript
// Toggle Track (off)
{
  width: 51,
  height: 31,
  borderRadius: 16,
  backgroundColor: '#28272C',  // bg.tertiary
  justifyContent: 'center',
  paddingHorizontal: 2,
}

// Toggle Track (on)
{
  backgroundColor: '#1858E4',  // brand.primary
}

// Toggle Thumb
{
  width: 27,
  height: 27,
  borderRadius: 14,
  backgroundColor: '#DDDDDD',  // text.primary
}
```

### Form Validation States

#### Input States

| State | Border Color | Background | Icon Color |
|-------|--------------|------------|------------|
| Default | border.default (#28272C) | bg.tertiary (#28272C) | - |
| Focus | border.focus (#1858E4) | bg.tertiary (#28272C) | - |
| Valid | semantic.success (#59AA8A) | bg.tertiary (#28272C) | #59AA8A |
| Error | semantic.error (#D04C68) | bg.tertiary (#28272C) | #D04C68 |
| Disabled | border.default (#28272C) | bg.secondary (#1D1C21) | - |

#### Validation Messages

| Type | Color | Icon |
|------|-------|------|
| Error | semantic.error (#D04C68) | `error` or `warning` |
| Success | semantic.success (#59AA8A) | `check` |
| Warning | semantic.warning (#F5A623) | `warning` |
| Info | semantic.info (#1858E4) | `info` |

```typescript
// Error Message Container
{
  flexDirection: 'row',
  alignItems: 'center',
  marginTop: 8,
  gap: 8,
}

// Error Message Text
{
  fontSize: 12,
  color: '#D04C68',  // semantic.error
  fontFamily: 'CabinetGrotesk-Regular',
}

// Input with Error
{
  borderWidth: 1,
  borderColor: '#D04C68',  // semantic.error
  backgroundColor: '#28272C',
}

// Input with Success
{
  borderWidth: 1,
  borderColor: '#59AA8A',  // semantic.success
}
```

#### Form Field Layout

```typescript
// Field Container
{
  marginBottom: 24,
}

// Label
{
  fontSize: 14,
  fontWeight: '500',
  color: '#DDDDDD',  // text.primary
  marginBottom: 8,
}

// Required Indicator
{
  color: '#D04C68',  // semantic.error
}

// Helper Text
{
  fontSize: 12,
  color: '#8E8D90',  // text.secondary
  marginTop: 4,
}
```

---

## Responsive Design

### Device Breakpoints

| Size | Width | Scale Factor | Device Example |
|------|-------|--------------|----------------|
| XS | 320px | 0.75 | iPhone SE |
| S | 375px | 0.85 | iPhone 8 |
| M | 390px | 0.95 | iPhone 14 |
| L | 393px | 1.00 | iPhone 14 Pro |
| XL | 430px | 1.10 | iPhone 14 Pro Max |

### Small Device Detection

```typescript
const isSmallDevice = screenWidth <= 375;
```

### Responsive Adjustments

| Property | Small Device | Standard | Large Device |
|----------|--------------|----------|--------------|
| Horizontal Padding | 16px | 20px | 24px |
| Font Scale | 0.9x | 1.0x | 1.0x |
| Button Height | Use `sm` (36px) | Use `md` (48px) | Use `lg` (56px) |
| Card Padding | 12px | 16px | 20px |

### Storybook Phone Frames

```typescript
{
  width: deviceWidth,
  height: 700,
  borderRadius: 24,
  borderWidth: 3,
  borderColor: '#28272C',
  backgroundColor: '#111015',
  overflow: 'hidden',
}
```

---

## Motion & Animation

### Duration Scale

| Token | Duration | Usage |
|-------|----------|-------|
| `fast` | 150ms | Micro-interactions, button press, toggle |
| `normal` | 300ms | Standard transitions, modals, expand/collapse |
| `slow` | 500ms | Complex animations, page transitions |
| `slower` | 800ms | Elaborate sequences, onboarding animations |

### Easing Curves

| Name | Bezier | Usage |
|------|--------|-------|
| `easeOut` | `cubic-bezier(0.0, 0.0, 0.2, 1)` | **Default for enter** - elements appearing |
| `easeIn` | `cubic-bezier(0.4, 0.0, 1, 1)` | Exit animations - elements disappearing |
| `easeInOut` | `cubic-bezier(0.4, 0.0, 0.2, 1)` | Continuous motion, position changes |
| `spring` | `mass: 1, damping: 15, stiffness: 120` | Bouncy interactions, toggles |
| `linear` | `cubic-bezier(0, 0, 1, 1)` | Progress indicators, continuous loops |

### React Native Animated Implementation

```typescript
import { Animated, Easing } from 'react-native';

// Easing presets matching design system
export const EASING = {
  easeOut: Easing.bezier(0.0, 0.0, 0.2, 1),
  easeIn: Easing.bezier(0.4, 0.0, 1, 1),
  easeInOut: Easing.bezier(0.4, 0.0, 0.2, 1),
  linear: Easing.linear,
};

// Duration presets
export const DURATION = {
  fast: 150,
  normal: 300,
  slow: 500,
  slower: 800,
};

// Fade In Animation
const fadeIn = (animatedValue: Animated.Value) => {
  Animated.timing(animatedValue, {
    toValue: 1,
    duration: DURATION.normal,
    easing: EASING.easeOut,
    useNativeDriver: true,
  }).start();
};

// Slide Up (Bottom Sheet Enter)
const slideUp = (animatedValue: Animated.Value) => {
  Animated.timing(animatedValue, {
    toValue: 0,
    duration: DURATION.normal,
    easing: EASING.easeOut,
    useNativeDriver: true,
  }).start();
};

// Scale Press Feedback
const pressIn = (animatedValue: Animated.Value) => {
  Animated.timing(animatedValue, {
    toValue: 0.96,
    duration: DURATION.fast,
    easing: EASING.easeOut,
    useNativeDriver: true,
  }).start();
};

// Spring Toggle
const springToggle = (animatedValue: Animated.Value, toValue: number) => {
  Animated.spring(animatedValue, {
    toValue,
    mass: 1,
    damping: 15,
    stiffness: 120,
    useNativeDriver: true,
  }).start();
};
```

### Reanimated 2/3 Implementation

```typescript
import { withTiming, withSpring, Easing } from 'react-native-reanimated';

// Worklet-compatible easing
const EASING_REANIMATED = {
  easeOut: Easing.bezier(0.0, 0.0, 0.2, 1),
  easeIn: Easing.bezier(0.4, 0.0, 1, 1),
  easeInOut: Easing.bezier(0.4, 0.0, 0.2, 1),
};

// Timing config
const timingConfig = (duration: number = 300) => ({
  duration,
  easing: EASING_REANIMATED.easeOut,
});

// Spring config for bouncy animations
const springConfig = {
  mass: 1,
  damping: 15,
  stiffness: 120,
};

// Usage in animated style
const animatedStyle = useAnimatedStyle(() => ({
  opacity: withTiming(isVisible ? 1 : 0, timingConfig(300)),
  transform: [
    { translateY: withSpring(isOpen ? 0 : 300, springConfig) },
    { scale: withTiming(isPressed ? 0.96 : 1, timingConfig(150)) },
  ],
}));
```

### Animation Patterns by Component

| Component | Animation | Duration | Easing |
|-----------|-----------|----------|--------|
| Button press | Scale to 0.96 | 150ms | easeOut |
| Button release | Scale to 1.0 | 150ms | easeOut |
| Modal appear | Fade + slide up | 300ms | easeOut |
| Modal dismiss | Fade + slide down | 250ms | easeIn |
| Bottom sheet | Slide up | 300ms | spring |
| Toggle switch | Thumb position | 200ms | spring |
| Toast enter | Slide down + fade | 300ms | easeOut |
| Toast exit | Fade out | 200ms | easeIn |
| List item press | Background opacity | 150ms | linear |
| Skeleton shimmer | Continuous loop | 1500ms | linear |
| Spinner rotation | Continuous loop | 1000ms | linear |

### Reduced Motion Support

```typescript
import { AccessibilityInfo } from 'react-native';

// Check user preference
const [reduceMotion, setReduceMotion] = useState(false);

useEffect(() => {
  AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
  const subscription = AccessibilityInfo.addEventListener(
    'reduceMotionChanged',
    setReduceMotion
  );
  return () => subscription.remove();
}, []);

// Apply reduced motion
const duration = reduceMotion ? 0 : DURATION.normal;
const shouldAnimate = !reduceMotion;
```

---

## Loading States

### Spinner

| Property | Value |
|----------|-------|
| Size (small) | 20px |
| Size (default) | 32px |
| Size (large) | 48px |
| Stroke Width | 3px |
| Color (default) | text.primary (#DDDDDD) |
| Color (on button) | text.primary (#DDDDDD) |
| Color (on brand bg) | text.primary (#DDDDDD) |
| Animation Duration | 1000ms |
| Animation | Linear rotation, continuous |

```typescript
// Spinner Component Styling
{
  width: 32,
  height: 32,
  borderWidth: 3,
  borderRadius: 16,
  borderColor: '#28272C',           // bg.tertiary (track)
  borderTopColor: '#DDDDDD',        // text.primary (active)
}

// Spinner Animation
const spin = useRef(new Animated.Value(0)).current;

useEffect(() => {
  Animated.loop(
    Animated.timing(spin, {
      toValue: 1,
      duration: 1000,
      easing: Easing.linear,
      useNativeDriver: true,
    })
  ).start();
}, []);

const spinStyle = {
  transform: [{
    rotate: spin.interpolate({
      inputRange: [0, 1],
      outputRange: ['0deg', '360deg'],
    }),
  }],
};
```

### Skeleton / Shimmer

| Property | Value |
|----------|-------|
| Base Color | bg.tertiary (#28272C) |
| Highlight Color | #3A393E (lighter tertiary) |
| Border Radius | Match content (8-12px) |
| Animation Duration | 1500ms |
| Animation | Linear horizontal sweep |

```typescript
// Skeleton Base
{
  backgroundColor: '#28272C',  // bg.tertiary
  borderRadius: 8,
  overflow: 'hidden',
}

// Shimmer Gradient (using LinearGradient)
const shimmerColors = [
  '#28272C',   // bg.tertiary
  '#3A393E',   // highlight
  '#28272C',   // bg.tertiary
];

// Shimmer Animation
const shimmer = useRef(new Animated.Value(0)).current;

useEffect(() => {
  Animated.loop(
    Animated.timing(shimmer, {
      toValue: 1,
      duration: 1500,
      easing: Easing.linear,
      useNativeDriver: true,
    })
  ).start();
}, []);

// Translate shimmer across element
const shimmerStyle = {
  transform: [{
    translateX: shimmer.interpolate({
      inputRange: [0, 1],
      outputRange: [-width, width],
    }),
  }],
};
```

### Skeleton Sizing by Content Type

| Content Type | Height | Width | Border Radius |
|--------------|--------|-------|---------------|
| Text line | 16px | 60-100% | 4px |
| Title | 24px | 40-70% | 4px |
| Avatar (sm) | 32px | 32px | 16px (full) |
| Avatar (md) | 40px | 40px | 20px (full) |
| Card | 80px | 100% | 12px |
| Button | 48px | 100% | 8px |
| List item | 60px | 100% | 0 |
| Amount display | 36px | 50% | 4px |

### Loading State Patterns

```typescript
// Full Screen Loading
{
  flex: 1,
  backgroundColor: '#111015',    // bg.primary
  justifyContent: 'center',
  alignItems: 'center',
}

// Inline Loading (button)
// Replace button text with spinner, maintain button size

// Content Placeholder
// Show skeleton matching final content layout

// Pull to Refresh
{
  tintColor: '#DDDDDD',          // text.primary
  backgroundColor: '#111015',    // bg.primary
}
```

---

## Toasts & Snackbars

### Toast Specifications

| Property | Value |
|----------|-------|
| Position | Top (below status bar + 16px) |
| Width | Screen width - 32px (16px margins) |
| Min Height | 48px |
| Max Width | 400px (tablets) |
| Background | bg.secondary (#1D1C21) |
| Border Radius | 12px (lg) |
| Padding | 16px horizontal, 12px vertical |
| Shadow | md (elevation 4) |
| Z-Index | 9999 (toast layer) |

### Toast Variants

| Variant | Icon Color | Left Border | Usage |
|---------|------------|-------------|-------|
| Default | text.primary (#DDDDDD) | None | General notifications |
| Success | semantic.success (#59AA8A) | 3px #59AA8A | Confirmations |
| Error | semantic.error (#D04C68) | 3px #D04C68 | Failures, errors |
| Warning | semantic.warning (#F5A623) | 3px #F5A623 | Cautions |
| Info | semantic.info (#1858E4) | 3px #1858E4 | Informational |

```typescript
// Toast Container
{
  position: 'absolute',
  top: STATUS_BAR_HEIGHT + 16,
  left: 16,
  right: 16,
  maxWidth: 400,
  alignSelf: 'center',
  zIndex: 9999,
}

// Toast Body
{
  flexDirection: 'row',
  alignItems: 'center',
  backgroundColor: '#1D1C21',     // bg.secondary
  borderRadius: 12,
  paddingHorizontal: 16,
  paddingVertical: 12,
  minHeight: 48,
  // Shadow
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.15,
  shadowRadius: 4,
  elevation: 4,
}

// Toast with Left Border (variant)
{
  borderLeftWidth: 3,
  borderLeftColor: '#59AA8A',     // semantic.success (example)
}

// Toast Icon
{
  marginRight: 12,
  width: 20,
  height: 20,
}

// Toast Text
{
  flex: 1,
  fontSize: 14,
  color: '#DDDDDD',               // text.primary
  fontFamily: 'CabinetGrotesk-Regular',
}

// Toast Action Button (optional)
{
  marginLeft: 12,
  paddingHorizontal: 12,
  paddingVertical: 6,
}

// Toast Action Text
{
  fontSize: 14,
  fontWeight: '600',
  color: '#1858E4',               // brand.primary
}
```

### Toast Animation

```typescript
// Enter Animation (slide down + fade)
const enterAnimation = () => {
  Animated.parallel([
    Animated.timing(translateY, {
      toValue: 0,
      duration: 300,
      easing: Easing.bezier(0.0, 0.0, 0.2, 1),
      useNativeDriver: true,
    }),
    Animated.timing(opacity, {
      toValue: 1,
      duration: 300,
      easing: Easing.bezier(0.0, 0.0, 0.2, 1),
      useNativeDriver: true,
    }),
  ]).start();
};

// Exit Animation (fade out)
const exitAnimation = (callback: () => void) => {
  Animated.timing(opacity, {
    toValue: 0,
    duration: 200,
    easing: Easing.bezier(0.4, 0.0, 1, 1),
    useNativeDriver: true,
  }).start(callback);
};

// Initial values
translateY.setValue(-20);
opacity.setValue(0);
```

### Toast Timing

| Type | Auto-dismiss | Swipe to dismiss |
|------|--------------|------------------|
| Success | 3000ms | Yes |
| Info | 4000ms | Yes |
| Warning | 5000ms | Yes |
| Error | No auto-dismiss | Yes |
| With action | No auto-dismiss | Yes |

### Snackbar (Bottom Position Variant)

| Property | Value |
|----------|-------|
| Position | Bottom (above safe area + 16px) |
| All other specs | Same as Toast |

```typescript
// Snackbar Position
{
  position: 'absolute',
  bottom: safeAreaInsets.bottom + 16,
  left: 16,
  right: 16,
  // ... rest same as toast
}
```

---

## Z-Index Architecture

### Z-Index Scale

| Token | Value | Usage |
|-------|-------|-------|
| `base` | 0 | Default content layer |
| `dropdown` | 100 | Dropdown menus, select options |
| `sticky` | 200 | Sticky headers, fixed elements |
| `modal` | 1000 | Modals, bottom sheets, dialogs |
| `toast` | 9999 | Toast notifications, alerts |
| `max` | 99999 | Critical overlays, loading states |

### Layer Hierarchy

```
┌─────────────────────────────────────┐
│ Toast Notifications      (z: 9999) │
├─────────────────────────────────────┤
│ Modal/Bottom Sheet       (z: 1000) │
├─────────────────────────────────────┤
│ Sticky Header            (z: 200)  │
├─────────────────────────────────────┤
│ Dropdown Menu            (z: 100)  │
├─────────────────────────────────────┤
│ Page Content             (z: 0)    │
└─────────────────────────────────────┘
```

---

## Safe Zones & Margins

### Status Bar

```typescript
const STATUS_BAR_HEIGHT = Platform.OS === 'ios' ? 50 : StatusBar.currentHeight || 0;
```

### Screen Layout Template

```
┌────────────────────────────────────────┐
│          Status Bar (50px iOS)         │
├────────────────────────────────────────┤
│  ┌─ Mutinynet Banner (optional) ─────┐ │
│  │    paddingVertical: 8px           │ │
│  └───────────────────────────────────┘ │
├────────────────────────────────────────┤
│  ┌─ Header ─────────────────────────┐  │
│  │ ← Back   Title                   │  │
│  │ h: 40px  paddingHorizontal: 20px │  │
│  └──────────────────────────────────┘  │
├────────────────────────────────────────┤
│                                        │
│     Content Area                       │
│     paddingHorizontal: 20px            │
│     paddingBottom: 40px                │
│                                        │
├────────────────────────────────────────┤
│      Home Indicator Safe Area          │
│            (~34px iOS)                 │
└────────────────────────────────────────┘
```

### Margin Guidelines

| Area | Value |
|------|-------|
| Screen edge to content | 16-24px (device-dependent) |
| Header to content | 0-20px |
| Section to section | 24-32px |
| Content to bottom | 40px minimum |
| Between list items | 0 (border separator) |

### Touch Target Minimums

| Element | Minimum Size |
|---------|--------------|
| Button | 44x44px |
| Icon button | 40x40px |
| List item | Full width x 60px+ |
| Tab bar item | 44x49px |

---

## Accessibility Guidelines

### Color Contrast

| Combination | Ratio | WCAG Level |
|-------------|-------|------------|
| text.primary (#DDDDDD) on bg.primary (#111015) | 11.7:1 | AAA |
| text.secondary (#8E8D90) on bg.primary (#111015) | 5.2:1 | AA |
| text.tertiary (#47464A) on bg.primary (#111015) | 2.4:1 | Decorative only |
| brand.primary (#1858E4) on bg.primary (#111015) | 4.8:1 | AA |
| text.primary (#DDDDDD) on brand.primary (#1858E4) | 4.6:1 | AA |

### Font Size Minimums

| Context | Minimum Size |
|---------|--------------|
| Body text | 14px |
| Interactive elements | 16px |
| Captions/labels | 12px |

### Focus States

- All interactive elements must have visible focus indicator
- Focus ring: 2px solid brand.primary (#1858E4)
- Focus ring offset: 2px

### Screen Reader Support

- All icons should have accessible labels
- Interactive elements need role and label
- Loading states must announce to screen readers

---

## Platform-Specific Guidelines

### Android Adaptations

#### Material Design Alignment

While Ducat maintains its own design language, Android implementations should respect platform conventions where appropriate:

| Component | iOS Behavior | Android Adaptation |
|-----------|--------------|-------------------|
| Navigation | Left-aligned back arrow | Same (no hamburger menu) |
| Modals | Bottom sheet default | Bottom sheet default |
| Buttons | Custom styling | Custom styling (no Material ripple) |
| Inputs | Custom border styling | Custom border styling |
| Alerts | Custom modal | Custom modal (no Material Dialog) |

#### Elevation & Shadows

Android uses `elevation` prop instead of shadow properties. Always include both:

```typescript
// Cross-platform shadow
{
  // iOS
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.15,
  shadowRadius: 4,
  // Android
  elevation: 4,
}
```

| Shadow Level | iOS shadowRadius | Android elevation |
|--------------|------------------|-------------------|
| none | 0 | 0 |
| sm | 2 | 2 |
| md | 4 | 4 |
| lg | 8 | 8 |
| xl | 16 | 16 |

#### Status Bar

```typescript
import { StatusBar, Platform } from 'react-native';

// Status bar height
const STATUS_BAR_HEIGHT = Platform.OS === 'ios'
  ? 50
  : StatusBar.currentHeight || 24;

// Status bar styling
<StatusBar
  barStyle="light-content"
  backgroundColor="#111015"  // Android only - bg.primary
  translucent={false}
/>
```

#### Navigation Bar (Android System)

```typescript
// Android bottom navigation bar color
import { NavigationBar } from 'react-native-bars';

NavigationBar.setBackgroundColorAsync('#111015');  // bg.primary
NavigationBar.setButtonStyleAsync('light');
```

#### Font Rendering

Android renders fonts differently. Account for these differences:

```typescript
// Platform-specific font adjustments
const fontFamily = Platform.select({
  ios: 'CabinetGrotesk-Regular',
  android: 'CabinetGrotesk-Regular',
});

// Android may need includeFontPadding disabled
const textStyle = Platform.select({
  ios: {},
  android: { includeFontPadding: false },
});
```

#### Touch Feedback

Use custom opacity feedback instead of Material ripple:

```typescript
// TouchableOpacity with consistent feedback
<TouchableOpacity
  activeOpacity={0.7}
  style={styles.button}
>
  {children}
</TouchableOpacity>

// For list items
<Pressable
  style={({ pressed }) => [
    styles.listItem,
    pressed && { backgroundColor: '#1D1C21' },  // bg.secondary
  ]}
>
  {children}
</Pressable>
```

#### Input Fields

Android TextInput has different default padding:

```typescript
// Normalize input styling
{
  paddingVertical: Platform.OS === 'android' ? 12 : 14,
  paddingHorizontal: 16,
  // Remove Android underline
  ...(Platform.OS === 'android' && {
    underlineColorAndroid: 'transparent',
  }),
}
```

#### Safe Areas

```typescript
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const insets = useSafeAreaInsets();

// Platform-aware safe area
const topPadding = Platform.OS === 'ios'
  ? insets.top
  : StatusBar.currentHeight || 0;

const bottomPadding = Platform.OS === 'ios'
  ? Math.max(insets.bottom, 16)
  : 16;
```

#### Keyboard Handling

```typescript
import { KeyboardAvoidingView, Platform } from 'react-native';

<KeyboardAvoidingView
  behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
  keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
>
  {content}
</KeyboardAvoidingView>
```

### iOS-Specific Notes

#### Haptic Feedback

```typescript
import * as Haptics from 'expo-haptics';

// Button press
Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

// Success action
Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

// Error
Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
```

#### Dynamic Island / Notch Awareness

Account for various iPhone notch sizes in header layouts. Use safe area insets rather than hardcoded values.

#### Home Indicator

On iPhones without home button, account for ~34px bottom safe area.

---

## Implementation Reference

### Theme Import Pattern

```typescript
import {
  colors,
  spacing,
  radii,
  fonts,
  fontSizes,
  sizes,
  shadows
} from '@/styles/theme';
```

### Legacy Color Mapping

For backwards compatibility, the `COLORS` constant maps to the new token system:

```typescript
COLORS.DARK_BG         → colors.bg.primary      (#111015)
COLORS.CARD_BG         → colors.bg.secondary    (#1D1C21)
COLORS.VERY_LIGHT_GRAY → colors.text.primary    (#DDDDDD)
COLORS.SECONDARY_TEXT  → colors.text.secondary  (#8E8D90)
COLORS.MEDIUM_GRAY     → colors.text.tertiary   (#47464A)
COLORS.BORDER_COLOR    → colors.border.default  (#28272C)
COLORS.PRIMARY_BLUE    → colors.brand.primary   (#1858E4)
COLORS.DANGER_RED      → colors.semantic.error  (#D04C68)
COLORS.SUCCESS_GREEN   → colors.semantic.success (#59AA8A)
COLORS.WARNING_ORANGE  → colors.semantic.warning (#F5A623)
COLORS.YELLOW          → colors.semantic.highlight (#F5E4A2)
```

> **Note:** `COLORS.PURPLE` (#8B5CF6) should only be used for Mutinynet banner.

### Storybook Device Scaling

```typescript
const DEVICE_CONFIGS = [
  { width: 320, size: 'XS', label: 'iPhone SE', scale: 0.75 },
  { width: 375, size: 'S', label: 'iPhone 8', scale: 0.85 },
  { width: 390, size: 'M', label: 'iPhone 14', scale: 0.95 },
  { width: 393, size: 'L', label: 'iPhone 14 Pro', scale: 1.0 },
  { width: 430, size: 'XL', label: 'iPhone 14 Pro Max', scale: 1.1 },
];
```

### Mutinynet Banner Styling

```typescript
{
  backgroundColor: '#1D1C21',  // bg.secondary
  paddingVertical: 8,
  alignItems: 'center',
}

// Banner Text
{
  color: '#8B5CF6',            // mutinynet.purple (ONLY for Mutinynet)
  fontWeight: '500',
  fontSize: 14,
}
```

---

## Quick Reference Card

### Most Used Tokens

| Token | Value | Usage |
|-------|-------|-------|
| `bg.primary` | #111015 | Screen background |
| `bg.secondary` | #1D1C21 | Cards, headers |
| `text.primary` | #DDDDDD | Main text, button text |
| `text.secondary` | #8E8D90 | Secondary text |
| `text.tertiary` | #47464A | Disabled, hints |
| `brand.primary` | #1858E4 | Actions, links |
| `semantic.success` | #59AA8A | Success states |
| `semantic.error` | #D04C68 | Errors, danger |
| `semantic.warning` | #F5A623 | Warnings |
| `semantic.highlight` | #F5E4A2 | Yellow accent |
| `border.default` | #28272C | Dividers |
| `spacing.md` | 16px | Standard spacing |
| `radii.md` | 8px | Buttons, inputs |
| `radii.lg` | 12px | Cards |
| `sizes.icon.md` | 24px | Standard icons |
| `sizes.buttonHeight.md` | 48px | Standard buttons |
| `fontSizes.md` | 16px | Body text |
| `fontSizes.xxxl` | 32px | Screen titles |

### Restricted Colors

| Color | Hex | Rule |
|-------|-----|------|
| Pure White | #FFFFFF | **Never use for text** - use #DDDDDD |
| Purple | #8B5CF6 | **Mutinynet banner only** |
| Old Tertiary | #666666 | **Deprecated** - use #47464A |

---

*This design system is maintained as the single source of truth for all visual design decisions in the Ducat application. All components should reference these tokens to ensure consistency across the platform.*

**Version:** 1.0.0
**Last Updated:** November 2024
