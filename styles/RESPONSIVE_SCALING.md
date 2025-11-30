# Responsive Scaling Methodology

## Overview

This app uses **explicit multiplier scaling** with `s()` and `sf()` helper functions to achieve pixel-perfect responsive designs across all device sizes.

## Device Configurations

| Size | Width | Scale | Device Example |
|------|-------|-------|----------------|
| XS   | 320px | 0.75  | iPhone SE 1st gen |
| S    | 375px | 0.85  | iPhone SE 3rd gen, iPhone 8 |
| M    | 390px | 0.95  | iPhone 14 |
| L    | 393px | 1.00  | iPhone 14 Pro (base design) |
| XL   | 430px | 1.10  | iPhone 14 Pro Max |

## Core Functions

### `s(value: number): number`
Scales dimension values (width, height, padding, margin, gap, borderRadius).
```tsx
s(50) // Returns 43 on iPhone SE 3 (50 * 0.85)
```

### `sf(value: number, min?: number): number`
Scales font sizes with optional minimum value (default min: 10).
```tsx
sf(14) // Returns 12 on iPhone SE 3 (14 * 0.85)
sf(14, 12) // Returns at least 12, even on small screens
```

## Usage Pattern

### 1. Import useResponsive hook
```tsx
import { useResponsive } from '../../hooks/useResponsive';
```

### 2. Destructure s() and sf() in component
```tsx
const { s, sf } = useResponsive();
```

### 3. Apply to inline styles
```tsx
<View style={{
  width: s(50),
  height: s(50),
  padding: s(12),
  borderRadius: s(8),
  marginBottom: s(8),
  gap: s(12)
}}>
  <Text style={{ fontSize: sf(14) }}>Hello</Text>
</View>
```

### 4. For reusable components, create style hooks
```tsx
// hooks/useMyComponentStyles.ts
import { useResponsive } from './useResponsive';

export function useMyComponentStyles() {
  const { s, sf } = useResponsive();

  return {
    container: {
      padding: s(16),
      borderRadius: s(12),
    },
    title: {
      fontSize: sf(18),
      marginBottom: s(8),
    },
    icon: {
      width: s(40),
      height: s(40),
    },
  };
}
```

## What to Scale

### Always scale with s():
- `width`, `height` (fixed dimensions)
- `padding`, `paddingHorizontal`, `paddingVertical`
- `margin`, `marginTop`, `marginBottom`, etc.
- `gap`
- `borderRadius`
- `borderWidth` (if > 1)
- Icon `size` props

### Always scale with sf():
- `fontSize`
- `lineHeight` (if specified)

### Don't scale:
- `flex` values
- `opacity`
- Percentage values (`'100%'`)
- `flexDirection`, `alignItems`, `justifyContent`
- Colors

## Example: Complete Component

```tsx
import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { useResponsive } from '../../hooks/useResponsive';
import Icon from '../icons';
import { COLORS } from '../../theme';

export function ActionButton({ onPress, iconName, label }) {
  const { s, sf } = useResponsive();

  return (
    <TouchableOpacity
      style={{ alignItems: 'center' }}
      onPress={onPress}
    >
      <View style={{
        width: s(50),
        height: s(50),
        borderRadius: s(8),
        backgroundColor: '#DDDDDD',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: s(2)
      }}>
        <Icon name={iconName} size={s(24)} color={COLORS.DARK_BG} />
      </View>
      <Text style={{
        fontSize: sf(13),
        color: COLORS.WHITE,
        fontWeight: '600'
      }}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}
```

## File Locations

- `app/styles/responsive.ts` - Device configs and helper functions
- `app/contexts/ResponsiveContext.tsx` - React context provider
- `app/hooks/useResponsive.ts` - Main hook with s() and sf()
- `app/hooks/use*Styles.ts` - Component-specific style hooks
