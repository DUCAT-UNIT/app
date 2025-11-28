import React, { useState } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import type { Meta, StoryObj } from '@storybook/react';
import { COLORS, SPACING, BORDER_RADIUS } from '../../../theme';
import BottomSheet from '../../../components/common/BottomSheet';
import Icon from '../../../components/icons';

// Demo sheet content
const SheetContent = ({ type }: { type: 'simple' | 'list' | 'form' | 'actions' }) => {
  switch (type) {
    case 'list':
      return (
        <View style={styles.sheetContent}>
          {['Bitcoin (BTC)', 'UNIT', 'TurboUNIT'].map((item, index) => (
            <TouchableOpacity key={item} style={styles.listItem}>
              <Icon name={index === 0 ? 'btc_logo' : 'unit_logo'} size={32} />
              <Text style={styles.listItemText}>{item}</Text>
              <Icon name="chevron_down" size={20} color={COLORS.SECONDARY_TEXT} />
            </TouchableOpacity>
          ))}
        </View>
      );
    case 'form':
      return (
        <View style={styles.sheetContent}>
          <View style={styles.formField}>
            <Text style={styles.formLabel}>Amount</Text>
            <View style={styles.formInput}>
              <Text style={styles.formInputText}>0.00</Text>
            </View>
          </View>
          <View style={styles.formField}>
            <Text style={styles.formLabel}>Address</Text>
            <View style={styles.formInput}>
              <Text style={styles.formInputText}>bc1q...</Text>
            </View>
          </View>
          <TouchableOpacity style={styles.formButton}>
            <Text style={styles.formButtonText}>Continue</Text>
          </TouchableOpacity>
        </View>
      );
    case 'actions':
      return (
        <View style={styles.sheetContent}>
          <TouchableOpacity style={styles.actionItem}>
            <View style={styles.actionIcon}>
              <Icon name="send" size={24} color={COLORS.WHITE} />
            </View>
            <View style={styles.actionInfo}>
              <Text style={styles.actionTitle}>Send</Text>
              <Text style={styles.actionDesc}>Transfer to another wallet</Text>
            </View>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionItem}>
            <View style={styles.actionIcon}>
              <Icon name="receive" size={24} color={COLORS.WHITE} />
            </View>
            <View style={styles.actionInfo}>
              <Text style={styles.actionTitle}>Receive</Text>
              <Text style={styles.actionDesc}>Get your wallet address</Text>
            </View>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.actionItem, styles.actionItemLast]}>
            <View style={[styles.actionIcon, { backgroundColor: COLORS.DANGER_RED }]}>
              <Icon name="close" size={24} color={COLORS.WHITE} />
            </View>
            <View style={styles.actionInfo}>
              <Text style={styles.actionTitle}>Close Vault</Text>
              <Text style={styles.actionDesc}>Repay debt and withdraw collateral</Text>
            </View>
          </TouchableOpacity>
        </View>
      );
    default:
      return (
        <View style={styles.sheetContent}>
          <Text style={styles.simpleText}>
            This is a simple bottom sheet with some content.
            It can be dismissed by tapping the backdrop or swiping down.
          </Text>
        </View>
      );
  }
};

const BottomSheetComponent = () => {
  const [simpleSheet, setSimpleSheet] = useState(false);
  const [listSheet, setListSheet] = useState(false);
  const [formSheet, setFormSheet] = useState(false);
  const [actionsSheet, setActionsSheet] = useState(false);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Bottom Sheet</Text>
      <Text style={styles.subtitle}>Swipe-to-dismiss sheet pattern with overlay</Text>

      {/* Interactive Demos */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Sheet Variants</Text>
        <Text style={styles.description}>
          Tap each button to see different sheet configurations.
        </Text>

        <View style={styles.buttonGrid}>
          <TouchableOpacity
            style={styles.demoButton}
            onPress={() => setSimpleSheet(true)}
          >
            <Text style={styles.demoButtonText}>Simple Sheet</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.demoButton}
            onPress={() => setListSheet(true)}
          >
            <Text style={styles.demoButtonText}>List Sheet</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.demoButton}
            onPress={() => setFormSheet(true)}
          >
            <Text style={styles.demoButtonText}>Form Sheet</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.demoButton}
            onPress={() => setActionsSheet(true)}
          >
            <Text style={styles.demoButtonText}>Actions Sheet</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Features */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Features</Text>
        <View style={styles.featureList}>
          {[
            { icon: 'done', text: 'Swipe down to dismiss' },
            { icon: 'done', text: 'Tap backdrop to close' },
            { icon: 'done', text: 'Spring animation' },
            { icon: 'done', text: 'Animated backdrop opacity' },
            { icon: 'done', text: 'Optional title & close button' },
            { icon: 'done', text: 'Auto-dismiss on app background' },
          ].map((feature) => (
            <View key={feature.text} style={styles.featureItem}>
              <Icon name={feature.icon} size={16} color={COLORS.SUCCESS_GREEN} />
              <Text style={styles.featureText}>{feature.text}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* Anatomy */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Sheet Anatomy</Text>
        <View style={styles.anatomyPreview}>
          <View style={styles.anatomyHandle}>
            <View style={styles.handle} />
            <Text style={styles.anatomyLabel}>Swipe Handle</Text>
          </View>
          <View style={styles.anatomyHeader}>
            <Text style={styles.anatomyHeaderTitle}>Title</Text>
            <View style={styles.anatomyClose}>
              <Icon name="close" size={20} color={COLORS.WHITE} />
            </View>
            <Text style={styles.anatomyLabel}>Header (optional)</Text>
          </View>
          <View style={styles.anatomyContent}>
            <Text style={styles.anatomyContentText}>Content Area</Text>
            <Text style={styles.anatomyLabel}>Children</Text>
          </View>
        </View>
      </View>

      {/* Props */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Props</Text>
        <View style={styles.propsTable}>
          {[
            { name: 'visible', type: 'boolean', desc: 'Show/hide sheet' },
            { name: 'onClose', type: '() => void', desc: 'Close callback' },
            { name: 'title', type: 'string', desc: 'Optional header title' },
            { name: 'children', type: 'ReactNode', desc: 'Sheet content' },
            { name: 'showCloseButton', type: 'boolean', desc: 'Show X button (default: true)' },
          ].map((prop) => (
            <View key={prop.name} style={styles.propRow}>
              <Text style={styles.propName}>{prop.name}</Text>
              <Text style={styles.propType}>{prop.type}</Text>
              <Text style={styles.propDesc}>{prop.desc}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* Usage */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Usage</Text>
        <View style={styles.codeBlock}>
          <Text style={styles.code}>
{`import BottomSheet from '../components/common/BottomSheet';

<BottomSheet
  visible={showSheet}
  onClose={() => setShowSheet(false)}
  title="Select Asset"
>
  <YourContent />
</BottomSheet>`}
          </Text>
        </View>
      </View>

      {/* Bottom Sheets */}
      <BottomSheet
        visible={simpleSheet}
        onClose={() => setSimpleSheet(false)}
        title="Simple Sheet"
      >
        <SheetContent type="simple" />
      </BottomSheet>

      <BottomSheet
        visible={listSheet}
        onClose={() => setListSheet(false)}
        title="Select Asset"
      >
        <SheetContent type="list" />
      </BottomSheet>

      <BottomSheet
        visible={formSheet}
        onClose={() => setFormSheet(false)}
        title="Send Bitcoin"
      >
        <SheetContent type="form" />
      </BottomSheet>

      <BottomSheet
        visible={actionsSheet}
        onClose={() => setActionsSheet(false)}
        title="Vault Actions"
      >
        <SheetContent type="actions" />
      </BottomSheet>
    </ScrollView>
  );
};

const meta: Meta<typeof BottomSheetComponent> = {
  title: 'Patterns/BottomSheet',
  component: BottomSheetComponent,
};

export default meta;

type Story = StoryObj<typeof BottomSheetComponent>;

export const Default: Story = {};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.DARK_BG,
  },
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: COLORS.WHITE,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: COLORS.SECONDARY_TEXT,
    marginBottom: 24,
  },
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.VERY_LIGHT_GRAY,
    marginBottom: 8,
  },
  description: {
    fontSize: 13,
    color: COLORS.SECONDARY_TEXT,
    marginBottom: 16,
  },
  buttonGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  demoButton: {
    backgroundColor: COLORS.PRIMARY_BLUE,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: BORDER_RADIUS.md,
  },
  demoButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.WHITE,
  },
  featureList: {
    backgroundColor: COLORS.CARD_BG,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  featureText: {
    fontSize: 14,
    color: COLORS.VERY_LIGHT_GRAY,
    marginLeft: 8,
  },
  anatomyPreview: {
    backgroundColor: COLORS.CARD_BG,
    borderRadius: BORDER_RADIUS.lg,
    overflow: 'hidden',
  },
  anatomyHandle: {
    alignItems: 'center',
    padding: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.BORDER_COLOR,
  },
  handle: {
    width: 40,
    height: 5,
    backgroundColor: COLORS.MEDIUM_GRAY,
    borderRadius: 3,
    marginBottom: 4,
  },
  anatomyLabel: {
    fontSize: 10,
    color: COLORS.PRIMARY_BLUE,
    marginTop: 4,
  },
  anatomyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.BORDER_COLOR,
  },
  anatomyHeaderTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.WHITE,
  },
  anatomyClose: {
    padding: 4,
  },
  anatomyContent: {
    padding: SPACING.lg,
    alignItems: 'center',
  },
  anatomyContentText: {
    fontSize: 16,
    color: COLORS.SECONDARY_TEXT,
  },
  sheetContent: {
    paddingHorizontal: 20,
  },
  simpleText: {
    fontSize: 16,
    color: COLORS.SECONDARY_TEXT,
    lineHeight: 24,
    textAlign: 'center',
    paddingVertical: SPACING.lg,
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md,
    backgroundColor: COLORS.CARD_BG,
    borderRadius: BORDER_RADIUS.md,
    marginBottom: 8,
  },
  listItemText: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.WHITE,
    marginLeft: 12,
  },
  formField: {
    marginBottom: SPACING.md,
  },
  formLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.SECONDARY_TEXT,
    marginBottom: 8,
  },
  formInput: {
    backgroundColor: COLORS.CARD_BG,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.BORDER_COLOR,
  },
  formInputText: {
    fontSize: 16,
    color: COLORS.WHITE,
  },
  formButton: {
    backgroundColor: COLORS.PRIMARY_BLUE,
    paddingVertical: 16,
    borderRadius: BORDER_RADIUS.md,
    alignItems: 'center',
    marginTop: SPACING.md,
  },
  formButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.WHITE,
  },
  actionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.BORDER_COLOR,
  },
  actionItemLast: {
    borderBottomWidth: 0,
  },
  actionIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.PRIMARY_BLUE,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  actionInfo: {
    flex: 1,
  },
  actionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.WHITE,
    marginBottom: 2,
  },
  actionDesc: {
    fontSize: 14,
    color: COLORS.SECONDARY_TEXT,
  },
  propsTable: {
    backgroundColor: COLORS.CARD_BG,
    borderRadius: BORDER_RADIUS.md,
    padding: 12,
  },
  propRow: {
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.BORDER_COLOR,
  },
  propName: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.PRIMARY_BLUE,
    marginBottom: 2,
  },
  propType: {
    fontSize: 11,
    color: COLORS.TEAL,
    marginBottom: 2,
  },
  propDesc: {
    fontSize: 12,
    color: COLORS.SECONDARY_TEXT,
  },
  codeBlock: {
    backgroundColor: COLORS.CARD_BG,
    padding: 12,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.BORDER_COLOR,
  },
  code: {
    fontFamily: 'monospace',
    fontSize: 11,
    color: COLORS.LIGHT_GRAY,
  },
});
