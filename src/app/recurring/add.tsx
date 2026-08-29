/**
 * AetherExpense — Ethos Add Recurring Rule Screen
 *
 * Allows creating recurring income/expense schedules (e.g. Netflix, Rent, Salary).
 * Saves to SQLite `recurring_transactions` table via Drizzle ORM.
 */

import React, { useState, useEffect } from 'react';
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
import { eq, and } from 'drizzle-orm';

import { createDrizzleDB } from '@/database/client';
import { categories, accounts, recurringTransactions } from '@/database/schema';
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
import { todayISO, nowISO } from '@/utils/dates';
import { generateUUID } from '@/utils/uuid';
import { processRecurringTransactions } from '@/utils/recurring';
import type { CategoryRow, AccountRow } from '@/database/schema';

export default function AddRecurringScreen() {
  const sqliteDb = useSQLiteContext();
  const currencyCode = useSettingsStore((s) => s.currency);
  const currencySymbol = getCurrencySymbol(currencyCode);
  const invalidateData = useAppStore((s) => s.invalidateData);

  const [type, setType] = useState<'expense' | 'income'>('expense');
  const [amount, setAmount] = useState('');
  const [merchant, setMerchant] = useState('');
  const [note, setNote] = useState('');
  const [frequency, setFrequency] = useState<'daily' | 'weekly' | 'monthly' | 'yearly'>('monthly');

  const [catList, setCatList] = useState<CategoryRow[]>([]);
  const [selectedCatId, setSelectedCatId] = useState<string>('');
  const [accList, setAccList] = useState<AccountRow[]>([]);
  const [selectedAccId, setSelectedAccId] = useState<string>('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function loadFormOptions() {
      try {
        const db = createDrizzleDB(sqliteDb);

        // Load categories matching selected type
        const cats = await db
          .select()
          .from(categories)
          .where(and(eq(categories.type, type), eq(categories.is_active, 1)))
          .orderBy(categories.sort_order, categories.name);
        setCatList(cats);
        if (cats.length > 0) setSelectedCatId(cats[0].id);

        // Load active accounts
        const accs = await db
          .select()
          .from(accounts)
          .where(eq(accounts.is_active, 1))
          .orderBy(accounts.sort_order, accounts.name);
        setAccList(accs);
        if (accs.length > 0) setSelectedAccId(accs[0].id);

      } catch (err) {
        console.error('[AddRecurringScreen] Error loading options:', err);
      }
    }
    loadFormOptions();
  }, [sqliteDb, type]);

  const handleSave = async () => {
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      Alert.alert('Invalid Amount', 'Please enter an amount greater than 0.');
      return;
    }

    if (!selectedCatId) {
      Alert.alert('Required', 'Please select a category.');
      return;
    }

    if (!selectedAccId) {
      Alert.alert('Required', 'Please select an account.');
      return;
    }

    setSaving(true);
    try {
      const db = createDrizzleDB(sqliteDb);
      const today = todayISO();
      const now = nowISO();

      await db.insert(recurringTransactions).values({
        id:              generateUUID(),
        type,
        amount:          toMinorUnits(amount),
        category_id:     selectedCatId,
        account_id:      selectedAccId,
        note:            note || merchant || null,
        merchant:        merchant || null,
        payment_method:  'cash',
        frequency,
        start_date:      today,
        end_date:        null,
        last_run_date:   null,
        next_run_date:   today,
        is_active:       1,
        notification_id: null,
        created_at:      now,
        updated_at:      now,
      });

      // Execute immediate run check if start date is today
      await processRecurringTransactions(db);

      invalidateData();
      router.back();
    } catch (err) {
      console.error('[AddRecurringScreen] Save error:', err);
      Alert.alert('Error', 'Could not create recurring rule.');
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
        <Text style={styles.headerTitle}>Add Recurring Rule</Text>
        <View style={{ width: 32 }} />
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {/* Type Segmented Control */}
          <View style={styles.segmentedContainer}>
            <Pressable
              onPress={() => setType('expense')}
              style={[styles.segmentBtn, type === 'expense' && styles.segmentBtnActive]}
            >
              <Text style={[styles.segmentText, type === 'expense' && styles.segmentTextActive]}>
                EXPENSE
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setType('income')}
              style={[styles.segmentBtn, type === 'income' && styles.segmentBtnActive]}
            >
              <Text style={[styles.segmentText, type === 'income' && styles.segmentTextActive]}>
                INCOME
              </Text>
            </Pressable>
          </View>

          {/* Amount Hero Section */}
          <View style={styles.amountHeroSection}>
            <Text style={styles.amountSublabel}>AMOUNT</Text>
            <View style={styles.amountWrap}>
              <Text style={styles.amountSymbol}>{currencySymbol}</Text>
              <TextInput
                autoFocus
                value={amount}
                onChangeText={setAmount}
                placeholder="0.00"
                placeholderTextColor={EthosColors.outline}
                keyboardType="decimal-pad"
                style={styles.amountInput}
              />
            </View>
          </View>

          {/* Title / Merchant */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Merchant / Title</Text>
            <TextInput
              value={merchant}
              onChangeText={setMerchant}
              placeholder="e.g. Netflix, Rent, Salary"
              placeholderTextColor={EthosColors.outline}
              style={styles.textInput}
            />
          </View>

          {/* Frequency Selector */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Frequency</Text>
            <View style={styles.segmentedContainer}>
              {(['daily', 'weekly', 'monthly', 'yearly'] as const).map((freq) => {
                const active = frequency === freq;
                return (
                  <Pressable
                    key={freq}
                    onPress={() => setFrequency(freq)}
                    style={[styles.segmentBtn, active && styles.segmentBtnActive]}
                  >
                    <Text style={[styles.segmentText, active && styles.segmentTextActive]}>
                      {freq.toUpperCase()}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* Category Picker */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Category</Text>
            <View style={styles.chipGrid}>
              {catList.map((cat) => {
                const selected = selectedCatId === cat.id;
                return (
                  <Pressable
                    key={cat.id}
                    onPress={() => setSelectedCatId(cat.id)}
                    style={[
                      styles.chip,
                      selected ? styles.chipSelected : styles.chipUnselected,
                    ]}
                  >
                    <Ionicons
                      name={(cat.icon || 'restaurant') as any}
                      size={18}
                      color={selected ? EthosColors.primary : cat.color}
                    />
                    <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
                      {cat.name}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* Account Picker */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Account</Text>
            <View style={styles.chipGrid}>
              {accList.map((acc) => {
                const selected = selectedAccId === acc.id;
                return (
                  <Pressable
                    key={acc.id}
                    onPress={() => setSelectedAccId(acc.id)}
                    style={[
                      styles.chip,
                      selected ? styles.chipSelected : styles.chipUnselected,
                    ]}
                  >
                    <Ionicons
                      name={(acc.icon || 'wallet-outline') as any}
                      size={18}
                      color={selected ? EthosColors.primary : acc.color}
                    />
                    <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
                      {acc.name}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* Note Input */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Note (Optional)</Text>
            <TextInput
              value={note}
              onChangeText={setNote}
              placeholder="Additional details..."
              placeholderTextColor={EthosColors.outline}
              style={styles.textInput}
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Footer Save Button */}
      <View style={styles.footer}>
        <Pressable
          id="save-recurring-btn"
          onPress={handleSave}
          disabled={saving}
          style={({ pressed }) => [
            styles.saveBtn,
            pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] },
          ]}
        >
          <Text style={styles.saveBtnText}>
            {saving ? 'Creating...' : 'Create Recurring Rule'}
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
    color:      EthosColors.primary,
    fontWeight: '500',
  },
  scrollContent: {
    paddingHorizontal: EthosSpacing.containerPadding,
    paddingTop:        EthosSpacing.unit,
    paddingBottom:     120,
    gap:               EthosSpacing.stackLg,
  },
  segmentedContainer: {
    flexDirection:   'row',
    backgroundColor: EthosColors.surfaceContainerHigh,
    borderRadius:    EthosRadius.full,
    padding:         4,
  },
  segmentBtn: {
    flex:            1,
    paddingVertical: EthosSpacing.unit,
    borderRadius:    EthosRadius.full,
    alignItems:      'center',
    justifyContent:  'center',
  },
  segmentBtnActive: {
    backgroundColor: EthosColors.surfaceContainerLowest,
    shadowColor:     '#000',
    shadowOffset:    { width: 0, height: 1 },
    shadowOpacity:   0.1,
    shadowRadius:    2,
    elevation:       2,
  },
  segmentText: {
    ...EthosTypography.labelMd,
    color: EthosColors.outline,
  },
  segmentTextActive: {
    color:      EthosColors.primary,
    fontWeight: '600',
  },
  amountHeroSection: {
    alignItems:        'center',
    justifyContent:    'center',
    paddingVertical:   EthosSpacing.stackMd,
    borderBottomWidth: EthosBorder.width,
    borderBottomColor: EthosColors.outlineVariant,
    gap:               4,
  },
  amountSublabel: {
    ...EthosTypography.labelSm,
    color:         EthosColors.outline,
    letterSpacing: 1.2,
  },
  amountWrap: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'center',
  },
  amountSymbol: {
    ...EthosTypography.displayMd,
    color:       EthosColors.primary,
    marginRight: 6,
  },
  amountInput: {
    ...EthosTypography.displayMd,
    color:       EthosColors.primary,
    fontVariant: ['tabular-nums'],
    minWidth:    120,
    textAlign:   'center',
  },
  inputGroup: {
    gap: EthosSpacing.unit,
  },
  label: {
    ...EthosTypography.labelSm,
    color: EthosColors.outline,
  },
  textInput: {
    ...EthosTypography.bodyMd,
    color:             EthosColors.onSurface,
    backgroundColor:   EthosColors.surfaceContainerLowest,
    borderWidth:       EthosBorder.width,
    borderColor:       EthosBorder.color,
    borderRadius:      EthosRadius.md,
    paddingHorizontal: EthosSpacing.stackMd,
    paddingVertical:   EthosSpacing.stackMd,
  },
  chipGrid: {
    flexDirection: 'row',
    flexWrap:      'wrap',
    gap:           EthosSpacing.unit,
  },
  chip: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               6,
    paddingHorizontal: EthosSpacing.stackMd,
    paddingVertical:   EthosSpacing.stackSm,
    borderRadius:      EthosRadius.full,
    backgroundColor:   EthosColors.surfaceContainerLowest,
  },
  chipUnselected: {
    borderWidth: EthosBorder.width,
    borderColor: EthosColors.outlineVariant,
  },
  chipSelected: {
    borderWidth: 1.5,
    borderColor: EthosColors.primary,
  },
  chipText: {
    ...EthosTypography.labelSm,
    color: EthosColors.outline,
  },
  chipTextSelected: {
    color:      EthosColors.primary,
    fontWeight: '600',
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
