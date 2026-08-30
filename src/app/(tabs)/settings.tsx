/**
 * AetherExpense — Settings Tab
 *
 * Uses the Ethos Design System matching the rest of the application (white surface aesthetic).
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSettingsStore } from '@/store/settingsStore';
import { manualUpdateCheck } from '@/utils/updates';
import {
  EthosColors,
  EthosTypography,
  EthosSpacing,
  EthosRadius,
  EthosBorder,
} from '@/theme/ethos';

interface SettingRowProps {
  icon:         string;
  iconColor:    string;
  label:        string;
  value?:       string;
  onPress?:     () => void;
  rightElement?: React.ReactNode;
  id:           string;
  isLast?:      boolean;
}

function SettingRow({ icon, iconColor, label, value, onPress, rightElement, id, isLast }: SettingRowProps) {
  return (
    <Pressable
      id={id}
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        !isLast && styles.rowBorder,
        pressed && onPress && styles.rowPressed,
      ]}
      accessibilityLabel={label}
    >
      <View style={[styles.rowIcon, { backgroundColor: `${iconColor}18` }]}>
        <Ionicons name={icon as any} size={18} color={iconColor} />
      </View>

      <Text style={styles.rowLabel}>{label}</Text>

      {rightElement ?? (
        <View style={styles.rowRight}>
          {value && <Text style={styles.rowValue}>{value}</Text>}
          {onPress && (
            <Ionicons name="chevron-forward" size={18} color={EthosColors.outline} />
          )}
        </View>
      )}
    </Pressable>
  );
}

interface SectionProps { title: string; children: React.ReactNode }

function Section({ title, children }: SectionProps) {
  return (
    <View style={styles.sectionWrap}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.bentoCard}>{children}</View>
    </View>
  );
}

export default function SettingsScreen() {
  const currency = useSettingsStore((s) => s.currency);
  const dateFormat = useSettingsStore((s) => s.date_format);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Settings</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* General */}
        <Section title="General">
          <SettingRow
            id="settings-currency"
            icon="cash-outline"
            iconColor="#10B981"
            label="Currency"
            value={currency}
          />
          <SettingRow
            id="settings-date-format"
            icon="calendar-outline"
            iconColor="#6366F1"
            label="Date Format"
            value={dateFormat}
            isLast
          />
        </Section>

        {/* Accounts & Wallets */}
        <Section title="Accounts & Wallets">
          <SettingRow
            id="settings-accounts"
            icon="wallet-outline"
            iconColor="#059669"
            label="Manage Accounts & Wallets"
            onPress={() => router.push('/accounts' as any)}
            isLast
          />
        </Section>

        {/* Categories */}
        <Section title="Categories">
          <SettingRow
            id="settings-categories"
            icon="pricetag-outline"
            iconColor="#EC4899"
            label="Manage Categories"
            onPress={() => router.push('/categories' as any)}
            isLast
          />
        </Section>

        {/* Automation & Reminders */}
        <Section title="Automation & Reminders">
          <SettingRow
            id="settings-bills"
            icon="receipt-outline"
            iconColor="#10B981"
            label="Manage Bills & Reminders"
            onPress={() => router.push('/bills' as any)}
          />
          <SettingRow
            id="settings-recurring"
            icon="refresh-outline"
            iconColor="#6366F1"
            label="Manage Recurring Rules"
            onPress={() => router.push('/recurring' as any)}
            isLast
          />
        </Section>

        {/* Security */}
        <Section title="Security">
          <SettingRow
            id="settings-security"
            icon="shield-checkmark-outline"
            iconColor="#EF4444"
            label="App Lock & Security"
            onPress={() => router.push('/settings/security')}
            isLast
          />
        </Section>

        {/* Data */}
        <Section title="Data">
          <SettingRow
            id="settings-data-manage"
            icon="server-outline"
            iconColor="#64748B"
            label="Data Management"
            onPress={() => router.push('/settings/data')}
            isLast
          />
        </Section>

        {/* App Info & Updates */}
        <Section title="About & Updates">
          <SettingRow
            id="settings-check-updates"
            icon="cloud-download-outline"
            iconColor="#0284C7"
            label="Check for Updates"
            onPress={manualUpdateCheck}
            isLast
          />
        </Section>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: EthosColors.background,
  },
  header: {
    paddingHorizontal: EthosSpacing.containerPadding,
    paddingVertical:   EthosSpacing.stackMd,
    backgroundColor:   EthosColors.surface,
    borderBottomWidth: EthosBorder.width,
    borderBottomColor: EthosBorder.color,
  },
  headerTitle: {
    ...EthosTypography.headlineLg,
    color:      EthosColors.onSurface,
    fontWeight: '500',
  },
  scrollContent: {
    paddingHorizontal: EthosSpacing.containerPadding,
    paddingTop:        EthosSpacing.stackMd,
    paddingBottom:     96,
    gap:               EthosSpacing.stackLg,
  },
  sectionWrap: {
    gap: EthosSpacing.unit,
  },
  sectionTitle: {
    ...EthosTypography.labelSm,
    color:         EthosColors.outline,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  bentoCard: {
    backgroundColor: EthosColors.surfaceContainerLowest,
    borderRadius:    EthosRadius.lg,
    borderWidth:     EthosBorder.width,
    borderColor:     EthosBorder.color,
    overflow:        'hidden',
  },
  row: {
    flexDirection:     'row',
    alignItems:        'center',
    paddingHorizontal: EthosSpacing.containerPadding,
    paddingVertical:   EthosSpacing.stackMd,
  },
  rowBorder: {
    borderBottomWidth: EthosBorder.width,
    borderBottomColor: EthosBorder.color,
  },
  rowPressed: {
    backgroundColor: EthosColors.surfaceContainerLow,
  },
  rowIcon: {
    width:           36,
    height:          36,
    borderRadius:    EthosRadius.md,
    alignItems:      'center',
    justifyContent:  'center',
    marginRight:     EthosSpacing.stackMd,
  },
  rowLabel: {
    ...EthosTypography.bodyMd,
    fontWeight: '500',
    color:      EthosColors.primary,
    flex:       1,
  },
  rowRight: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           6,
  },
  rowValue: {
    ...EthosTypography.labelSm,
    color: EthosColors.outline,
  },
});
