/**
 * AetherExpense — Ethos Add Account Screen
 *
 * Form for creating a new Cash, Bank, UPI, Credit Card, or Custom account.
 * Stores opening balance as integer minor units (paise).
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  Pressable,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSQLiteContext } from 'expo-sqlite';
import { generateUUID as uuidv4 } from '@/utils/uuid';

import { createDrizzleDB } from '@/database/client';
import { accounts } from '@/database/schema';
import { useSettingsStore } from '@/store/settingsStore';
import { useAppStore } from '@/store/appStore';
import {
  EthosColors,
  EthosTypography,
  EthosSpacing,
  EthosRadius,
  EthosBorder,
} from '@/theme/ethos';
import { toMinorUnits, getCurrencySymbol } from '@/utils/currency';
import { ACCOUNT_TYPE_CONFIG } from '@/utils/accounts';
import { nowISO } from '@/utils/dates';

const ACCOUNT_TYPES = [
  'cash',
  'bank',
  'upi',
  'debit_card',
  'credit_card',
  'savings',
  'custom',
] as const;

const PALETTE_COLORS = [
  '#059669', // Emerald
  '#2563EB', // Blue
  '#7C3AED', // Violet
  '#DC2626', // Red
  '#D97706', // Amber
  '#0284C7', // Sky
  '#000000', // Black
];

export default function AddAccountScreen() {
  const sqliteDb = useSQLiteContext();
  const currencyCode = useSettingsStore((s) => s.currency);
  const currencySymbol = getCurrencySymbol(currencyCode);
  const invalidateData = useAppStore((s) => s.invalidateData);

  const [name, setName] = useState('');
  const [type, setType] = useState<typeof ACCOUNT_TYPES[number]>('bank');
  const [openingBalance, setOpeningBalance] = useState('');
  const [selectedColor, setSelectedColor] = useState('#2563EB');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert('Required', 'Please enter an account name.');
      return;
    }

    setSaving(true);
    try {
      const db = createDrizzleDB(sqliteDb);
      const now = nowISO();
      const cfg = ACCOUNT_TYPE_CONFIG[type] || ACCOUNT_TYPE_CONFIG.cash;

      await db.insert(accounts).values({
        id:              uuidv4(),
        name:            name.trim(),
        type:            type as any,
        opening_balance: toMinorUnits(openingBalance || '0'),
        icon:            cfg.defaultIcon,
        color:           selectedColor,
        is_active:       1,
        sort_order:      10,
        created_at:      now,
        updated_at:      now,
      });

      invalidateData();
      router.back();
    } catch (err) {
      console.error('[AddAccountScreen] Save error:', err);
      Alert.alert('Error', 'Could not create account.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      {/* Top Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.navBtn}>
          <Ionicons name="arrow-back" size={24} color={EthosColors.onSurface} />
        </Pressable>
        <Text style={styles.headerTitle}>Add Account</Text>
        <View style={{ width: 32 }} />
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {/* Account Name Input */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Account Name</Text>
            <TextInput
              autoFocus
              value={name}
              onChangeText={setName}
              placeholder="e.g. HDFC Salary Account"
              placeholderTextColor={EthosColors.outline}
              style={styles.underlinedInput}
            />
          </View>

          {/* Account Type Selection */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Account Type</Text>
            <View style={styles.typeGrid}>
              {ACCOUNT_TYPES.map((t) => {
                const cfg = ACCOUNT_TYPE_CONFIG[t];
                const active = type === t;
                return (
                  <Pressable
                    key={t}
                    onPress={() => {
                      setType(t);
                      setSelectedColor(cfg.defaultColor);
                    }}
                    style={[
                      styles.typeChip,
                      active ? styles.typeChipActive : styles.typeChipInactive,
                    ]}
                  >
                    <Ionicons
                      name={cfg.defaultIcon as any}
                      size={18}
                      color={active ? EthosColors.primary : EthosColors.outline}
                    />
                    <Text
                      style={[
                        styles.typeChipText,
                        active && styles.typeChipTextActive,
                      ]}
                      numberOfLines={1}
                    >
                      {cfg.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* Opening Balance Input */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Opening Balance ({currencySymbol})</Text>
            <TextInput
              value={openingBalance}
              onChangeText={setOpeningBalance}
              placeholder="0.00"
              placeholderTextColor={EthosColors.outline}
              keyboardType="decimal-pad"
              style={styles.underlinedInput}
            />
          </View>

          {/* Color Accent Picker */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Account Color</Text>
            <View style={styles.colorRow}>
              {PALETTE_COLORS.map((c) => {
                const active = selectedColor === c;
                return (
                  <Pressable
                    key={c}
                    onPress={() => setSelectedColor(c)}
                    style={[
                      styles.colorDot,
                      { backgroundColor: c },
                      active && styles.colorDotActive,
                    ]}
                  />
                );
              })}
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Footer Save Button */}
      <View style={styles.footer}>
        <Pressable
          id="save-account-btn"
          onPress={handleSave}
          disabled={saving}
          style={({ pressed }) => [
            styles.saveBtn,
            pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] },
          ]}
        >
          <Text style={styles.saveBtnText}>
            {saving ? 'Saving...' : 'Save Account'}
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: EthosColors.surface,
  },
  header: {
    flexDirection:     'row',
    alignItems:        'center',
    justifyContent:    'space-between',
    paddingHorizontal: EthosSpacing.containerPadding,
    paddingVertical:   EthosSpacing.stackMd,
    backgroundColor:   EthosColors.surface,
  },
  navBtn: {
    padding: 4,
  },
  headerTitle: {
    ...EthosTypography.headlineLg,
    color: EthosColors.primary,
    fontWeight: '500',
  },
  scrollContent: {
    paddingHorizontal: EthosSpacing.containerPadding,
    paddingTop:        EthosSpacing.stackLg,
    paddingBottom:     120,
    gap:               EthosSpacing.stackLg,
  },
  inputGroup: {
    gap: EthosSpacing.unit,
  },
  label: {
    ...EthosTypography.labelSm,
    color: EthosColors.outline,
  },
  underlinedInput: {
    ...EthosTypography.bodyMd,
    color:             EthosColors.onSurface,
    paddingVertical:   EthosSpacing.unit,
    borderBottomWidth: EthosBorder.width,
    borderBottomColor: EthosColors.outlineVariant,
  },
  typeGrid: {
    flexDirection: 'row',
    flexWrap:      'wrap',
    gap:           EthosSpacing.unit,
  },
  typeChip: {
    flexDirection:   'row',
    alignItems:      'center',
    gap:             6,
    paddingHorizontal: EthosSpacing.stackMd,
    paddingVertical:   EthosSpacing.stackSm,
    borderRadius:    EthosRadius.full,
    backgroundColor: EthosColors.surfaceContainerLowest,
  },
  typeChipInactive: {
    borderWidth: EthosBorder.width,
    borderColor: EthosColors.outlineVariant,
  },
  typeChipActive: {
    borderWidth: 1.5,
    borderColor: EthosColors.primary,
  },
  typeChipText: {
    ...EthosTypography.labelSm,
    color: EthosColors.outline,
  },
  typeChipTextActive: {
    color:      EthosColors.primary,
    fontWeight: '600',
  },
  colorRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           EthosSpacing.gutter,
  },
  colorDot: {
    width:        32,
    height:       32,
    borderRadius: EthosRadius.full,
  },
  colorDotActive: {
    borderWidth: 3,
    borderColor: EthosColors.onSurface,
  },
  footer: {
    position:          'absolute',
    bottom:            0,
    left:              0,
    right:             0,
    backgroundColor:   EthosColors.surfaceContainerLowest,
    borderTopWidth:    EthosBorder.width,
    borderTopColor:    EthosColors.outlineVariant,
    paddingHorizontal: EthosSpacing.containerPadding,
    paddingVertical:   EthosSpacing.stackMd,
  },
  saveBtn: {
    backgroundColor: EthosColors.primary,
    borderRadius:    EthosRadius.md,
    paddingVertical: EthosSpacing.stackMd,
    alignItems:      'center',
    justifyContent:  'center',
  },
  saveBtnText: {
    ...EthosTypography.labelMd,
    color:      EthosColors.onPrimary,
    fontWeight: '600',
  },
});
