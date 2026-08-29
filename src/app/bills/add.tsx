/**
 * AetherExpense — Ethos Add Bill Screen
 *
 * Allows creating upcoming bills & reminders (Electricity, Rent, Internet, Subscriptions).
 * Saves bill obligation record to SQLite `bills` table via Drizzle ORM.
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
  Switch,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSQLiteContext } from 'expo-sqlite';
import { eq, and } from 'drizzle-orm';

import { createDrizzleDB } from '@/database/client';
import { categories, accounts, bills } from '@/database/schema';
import { useSettingsStore } from '@/store/settingsStore';
import { useAppStore } from '@/store/appStore';
import {
  EthosColors,
  EthosTypography,
  EthosSpacing,
  EthosRadius,
  EthosBorder,
} from '@/theme/ethos';
import { toMinorUnits, getCurrencySymbol, formatCurrency } from '@/utils/currency';
import { todayISO, nowISO } from '@/utils/dates';
import { generateUUID } from '@/utils/uuid';
import { scheduleBillNotification } from '@/utils/notifications';
import type { CategoryRow, AccountRow } from '@/database/schema';

export default function AddBillScreen() {
  const sqliteDb = useSQLiteContext();
  const currencyCode = useSettingsStore((s) => s.currency);
  const currencySymbol = getCurrencySymbol(currencyCode);
  const invalidateData = useAppStore((s) => s.invalidateData);

  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [dueDate, setDueDate] = useState(todayISO());
  const [frequency, setFrequency] = useState<'one_time' | 'weekly' | 'monthly' | 'yearly'>('monthly');
  const [note, setNote] = useState('');
  const [autoCreateTxn, setAutoCreateTxn] = useState(true);

  const [catList, setCatList] = useState<CategoryRow[]>([]);
  const [selectedCatId, setSelectedCatId] = useState<string>('');
  const [accList, setAccList] = useState<AccountRow[]>([]);
  const [selectedAccId, setSelectedAccId] = useState<string>('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function loadFormOptions() {
      try {
        const db = createDrizzleDB(sqliteDb);

        // Load active expense categories
        const cats = await db
          .select()
          .from(categories)
          .where(and(eq(categories.type, 'expense'), eq(categories.is_active, 1)))
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
        console.error('[AddBillScreen] Error loading options:', err);
      }
    }
    loadFormOptions();
  }, [sqliteDb]);

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert('Required', 'Please enter a bill name (e.g. Rent, Electricity).');
      return;
    }

    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      Alert.alert('Invalid Amount', 'Please enter a bill amount greater than 0.');
      return;
    }

    setSaving(true);
    try {
      const db = createDrizzleDB(sqliteDb);
      const now = nowISO();
      const billId = generateUUID();
      const minorAmount = toMinorUnits(amount);
      const formattedAmt = formatCurrency(minorAmount, currencyCode);

      // Schedule local notification if reminder date is in future
      const notifId = await scheduleBillNotification(
        billId,
        name.trim(),
        formattedAmt,
        dueDate || todayISO(),
        1
      );

      await db.insert(bills).values({
        id:                      billId,
        name:                    name.trim(),
        amount:                  minorAmount,
        category_id:             selectedCatId || null,
        account_id:              selectedAccId || null,
        due_date:                dueDate || todayISO(),
        frequency,
        note:                    note || null,
        is_paid:                 0,
        paid_date:               null,
        auto_create_transaction: autoCreateTxn ? 1 : 0,
        transaction_id:          null,
        is_active:               1,
        reminder_days_before:    1,
        notification_id:         notifId,
        recurring_id:            null,
        created_at:              now,
        updated_at:              now,
      });

      invalidateData();
      router.back();
    } catch (err) {
      console.error('[AddBillScreen] Save error:', err);
      Alert.alert('Error', 'Could not create bill.');
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
        <Text style={styles.headerTitle}>Add Bill</Text>
        <View style={{ width: 32 }} />
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {/* Amount Hero Section */}
          <View style={styles.amountHeroSection}>
            <Text style={styles.amountSublabel}>BILL AMOUNT</Text>
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

          {/* Bill Name */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Bill Name</Text>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="e.g. Rent, Electricity, Internet, Credit Card"
              placeholderTextColor={EthosColors.outline}
              style={styles.textInput}
            />
          </View>

          {/* Due Date */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Due Date (YYYY-MM-DD)</Text>
            <TextInput
              value={dueDate}
              onChangeText={setDueDate}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={EthosColors.outline}
              style={styles.textInput}
            />
          </View>

          {/* Frequency Selector */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Repeat Frequency</Text>
            <View style={styles.segmentedContainer}>
              {(['one_time', 'weekly', 'monthly', 'yearly'] as const).map((freq) => {
                const active = frequency === freq;
                return (
                  <Pressable
                    key={freq}
                    onPress={() => setFrequency(freq)}
                    style={[styles.segmentBtn, active && styles.segmentBtnActive]}
                  >
                    <Text style={[styles.segmentText, active && styles.segmentTextActive]}>
                      {freq.replace('_', ' ').toUpperCase()}
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
                      name={(cat.icon || 'receipt-outline') as any}
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
            <Text style={styles.label}>Payment Account</Text>
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

          {/* Auto-create Transaction Toggle */}
          <View style={styles.switchRow}>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={styles.switchLabel}>Auto-create Transaction on Payment</Text>
              <Text style={styles.switchSubtext}>
                Automatically generates expense transaction when marked paid
              </Text>
            </View>
            <Switch
              value={autoCreateTxn}
              onValueChange={setAutoCreateTxn}
              trackColor={{ false: EthosColors.outlineVariant, true: EthosColors.primary }}
            />
          </View>

          {/* Note Input */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Note (Optional)</Text>
            <TextInput
              value={note}
              onChangeText={setNote}
              placeholder="Account #, Consumer ID, or notes..."
              placeholderTextColor={EthosColors.outline}
              style={styles.textInput}
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Footer Save Button */}
      <View style={styles.footer}>
        <Pressable
          id="save-bill-btn"
          onPress={handleSave}
          disabled={saving}
          style={({ pressed }) => [
            styles.saveBtn,
            pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] },
          ]}
        >
          <Text style={styles.saveBtnText}>
            {saving ? 'Creating...' : 'Create Bill'}
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
    ...EthosTypography.labelSm,
    color: EthosColors.outline,
  },
  segmentTextActive: {
    color:      EthosColors.primary,
    fontWeight: '600',
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
  switchRow: {
    flexDirection:     'row',
    alignItems:        'center',
    justifyContent:    'space-between',
    backgroundColor:   EthosColors.surfaceContainerLowest,
    borderWidth:       EthosBorder.width,
    borderColor:       EthosBorder.color,
    borderRadius:      EthosRadius.md,
    paddingHorizontal: EthosSpacing.stackMd,
    paddingVertical:   EthosSpacing.stackMd,
  },
  switchLabel: {
    ...EthosTypography.bodyMd,
    fontWeight: '500',
    color:      EthosColors.onSurface,
  },
  switchSubtext: {
    ...EthosTypography.labelSm,
    color: EthosColors.outline,
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
