import React from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import type { Meta, StoryObj } from '@storybook/react';
import { COLORS } from '../../../theme';
import PressableButton from '../../../components/ui/PressableButton';
import Icon from '../../../components/icons';

// ============================================================================
// BUTTON COMPONENT - Matches actual app styling from ConfirmationScreen.styles.ts
// ============================================================================
interface ButtonProps {
  variant: 'primary' | 'secondary' | 'destructive' | 'outline' | 'ghost' | 'success';
  label: string;
  disabled?: boolean;
  loading?: boolean;
  icon?: string;
  size?: 'small' | 'medium' | 'large';
}

const Button = ({ variant, label, disabled = false, loading = false, icon, size = 'medium' }: ButtonProps) => {
  const getButtonStyle = () => {
    const base: object[] = [styles.button];
    switch (variant) {
      case 'primary': base.push(styles.primaryButton); break;
      case 'secondary': base.push(styles.secondaryButton); break;
      case 'destructive': base.push(styles.destructiveButton); break;
      case 'outline': base.push(styles.outlineButton); break;
      case 'ghost': base.push(styles.ghostButton); break;
      case 'success': base.push(styles.successButton); break;
    }
    switch (size) {
      case 'small': base.push(styles.buttonSmall); break;
      case 'large': base.push(styles.buttonLarge); break;
    }
    if (disabled || loading) base.push(styles.buttonDisabled);
    return base;
  };

  const getTextStyle = () => {
    const base: object[] = [styles.buttonText];
    if (variant === 'outline') base.push({ color: COLORS.PRIMARY_BLUE });
    if (variant === 'ghost') base.push({ color: COLORS.PRIMARY_BLUE });
    if (size === 'small') base.push(styles.buttonTextSmall);
    if (size === 'large') base.push(styles.buttonTextLarge);
    return base;
  };

  const iconColor = (variant === 'outline' || variant === 'ghost') ? COLORS.PRIMARY_BLUE : COLORS.WHITE;

  return (
    <PressableButton disabled={disabled || loading} onPress={() => {}} style={getButtonStyle()}>
      {loading ? (
        <ActivityIndicator size="small" color={iconColor} />
      ) : (
        <View style={styles.buttonContent}>
          {icon && <Icon name={icon} size={size === 'small' ? 16 : 20} color={iconColor} />}
          <Text style={getTextStyle()}>{label}</Text>
        </View>
      )}
    </PressableButton>
  );
};

// ============================================================================
// VARIANT STORY TEMPLATE
// ============================================================================
interface VariantStoryProps {
  variant: ButtonProps['variant'];
  title: string;
  description: string;
  disabled?: boolean;
  loading?: boolean;
}

const VariantStory = ({ variant, title, description, disabled = false, loading = false }: VariantStoryProps) => (
  <View style={styles.container}>
    <Text style={styles.title}>{title}</Text>
    <Text style={styles.description}>{description}</Text>

    <View style={styles.sizesRow}>
      <View style={styles.sizeItem}>
        <Text style={styles.sizeLabel}>SMALL</Text>
        <Button variant={variant} label={title} size="small" disabled={disabled} loading={loading} />
      </View>
      <View style={styles.sizeItem}>
        <Text style={styles.sizeLabel}>MEDIUM</Text>
        <Button variant={variant} label={title} size="medium" disabled={disabled} loading={loading} />
      </View>
      <View style={styles.sizeItem}>
        <Text style={styles.sizeLabel}>LARGE</Text>
        <Button variant={variant} label={title} size="large" disabled={disabled} loading={loading} />
      </View>
    </View>

    <View style={styles.withIconSection}>
      <Text style={styles.sectionLabel}>WITH ICON</Text>
      <View style={styles.iconRow}>
        <Button variant={variant} label="Send" icon="send" disabled={disabled} loading={loading} />
        <Button variant={variant} label="Receive" icon="receive" disabled={disabled} loading={loading} />
      </View>
    </View>
  </View>
);

// ============================================================================
// OVERVIEW
// ============================================================================
const OverviewStory = () => (
  <View style={styles.container}>
    <Text style={styles.title}>Button Overview</Text>
    <Text style={styles.description}>All available button variants at a glance. Select a specific variant from the sidebar to see sizes and states.</Text>

    <View style={styles.overviewGrid}>
      {[
        { variant: 'primary' as const, label: 'Primary', desc: 'Main CTA' },
        { variant: 'secondary' as const, label: 'Secondary', desc: 'Alternative actions' },
        { variant: 'success' as const, label: 'Success', desc: 'Positive actions' },
        { variant: 'destructive' as const, label: 'Destructive', desc: 'Dangerous actions' },
        { variant: 'outline' as const, label: 'Outline', desc: 'Tertiary actions' },
        { variant: 'ghost' as const, label: 'Ghost', desc: 'Subtle actions' },
      ].map(({ variant, label, desc }) => (
        <View key={variant} style={styles.overviewCard}>
          <Button variant={variant} label={label} />
          <Text style={styles.overviewLabel}>{desc}</Text>
        </View>
      ))}
    </View>
  </View>
);

// ============================================================================
// STORYBOOK META
// ============================================================================
const meta: Meta<VariantStoryProps> = {
  title: 'Primitives/Button',
  argTypes: {
    disabled: {
      control: 'boolean',
      description: 'Disable the button',
      table: { defaultValue: { summary: 'false' } }
    },
    loading: {
      control: 'boolean',
      description: 'Show loading spinner',
      table: { defaultValue: { summary: 'false' } }
    },
  },
  args: {
    disabled: false,
    loading: false,
  },
};

export default meta;
type Story = StoryObj<VariantStoryProps>;

// ============================================================================
// STORIES
// ============================================================================

export const Overview: Story = {
  render: () => <OverviewStory />,
  parameters: { controls: { disable: true } },
};

export const Primary: Story = {
  args: {
    variant: 'primary',
    title: 'Primary',
    description: 'The main call-to-action button. Use for the most important action on a screen like "Send", "Confirm", or "Continue".',
  },
  render: (args) => <VariantStory {...args} />,
};

export const Secondary: Story = {
  args: {
    variant: 'secondary',
    title: 'Secondary',
    description: 'A less prominent button for secondary actions. Use alongside primary buttons for options like "Cancel" or "Back".',
  },
  render: (args) => <VariantStory {...args} />,
};

export const Success: Story = {
  args: {
    variant: 'success',
    title: 'Success',
    description: 'Indicates a positive action. Use for confirmations like "Approve", "Accept", or "Complete".',
  },
  render: (args) => <VariantStory {...args} />,
};

export const Destructive: Story = {
  args: {
    variant: 'destructive',
    title: 'Destructive',
    description: 'Warns users of dangerous or irreversible actions. Use for "Delete", "Remove", or destructive operations.',
  },
  render: (args) => <VariantStory {...args} />,
};

export const Outline: Story = {
  args: {
    variant: 'outline',
    title: 'Outline',
    description: 'A subtle button with a border. Use for tertiary actions that need visibility but not prominence.',
  },
  render: (args) => <VariantStory {...args} />,
};

export const Ghost: Story = {
  args: {
    variant: 'ghost',
    title: 'Ghost',
    description: 'A minimal button with no background. Use for inline actions or when you need a button that blends with content.',
  },
  render: (args) => <VariantStory {...args} />,
};

// ============================================================================
// STYLES - Matching actual app styling (ConfirmationScreen.styles.ts)
// ============================================================================
const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: COLORS.VERY_LIGHT_GRAY,
    marginBottom: 8,
  },
  description: {
    fontSize: 15,
    color: COLORS.SECONDARY_TEXT,
    lineHeight: 22,
    marginBottom: 40,
  },

  // Sizes row
  sizesRow: {
    flexDirection: 'row',
    gap: 32,
    marginBottom: 40,
  },
  sizeItem: {
    alignItems: 'center',
    gap: 16,
  },
  sizeLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.SECONDARY_TEXT,
    letterSpacing: 1,
  },

  // With icon section
  withIconSection: {
    borderTopWidth: 1,
    borderTopColor: COLORS.BORDER_COLOR,
    paddingTop: 32,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.SECONDARY_TEXT,
    letterSpacing: 1,
    marginBottom: 16,
  },
  iconRow: {
    flexDirection: 'row',
    gap: 16,
  },

  // Overview grid
  overviewGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 24,
  },
  overviewCard: {
    alignItems: 'center',
    gap: 12,
    padding: 16,
    backgroundColor: COLORS.CARD_BG,
    borderRadius: 12,
    minWidth: 140,
  },
  overviewLabel: {
    fontSize: 12,
    color: COLORS.SECONDARY_TEXT,
  },

  // Button styles - Matching app patterns (borderRadius: 12)
  button: {
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.WHITE,
  },
  primaryButton: {
    backgroundColor: COLORS.PRIMARY_BLUE,
  },
  secondaryButton: {
    backgroundColor: COLORS.CARD_BG,
    borderWidth: 1,
    borderColor: COLORS.BORDER_COLOR,
  },
  destructiveButton: {
    backgroundColor: COLORS.DANGER_RED,
  },
  successButton: {
    backgroundColor: COLORS.SUCCESS_GREEN,
  },
  outlineButton: {
    backgroundColor: COLORS.PRIMARY_BLUE + '15',
    borderWidth: 1,
    borderColor: COLORS.PRIMARY_BLUE,
  },
  ghostButton: {
    backgroundColor: 'transparent',
  },
  buttonLarge: {
    paddingVertical: 16,
    paddingHorizontal: 24,
    minHeight: 52,
  },
  buttonTextLarge: {
    fontSize: 18,
  },
  buttonSmall: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    minHeight: 40,
  },
  buttonTextSmall: {
    fontSize: 14,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
});
