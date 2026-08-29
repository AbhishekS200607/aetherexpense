/**
 * AetherExpense — Ethos Add Budget Screen
 *
 * Allows setting monthly or custom spending limits per expense category.
 * Only permits valid Expense categories (prevents assigning budgets to Income categories).
 * Stores budget amount as integer minor units (paise) in SQLite database via Drizzle ORM.
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
import { categories, budgets } from '@/database/schema';
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
import type { CategoryRow } from '@/database/schema';

export default function AddBudgetScreen() {
  const sqliteDb = useSQLiteContext();
  const currencyCode = useSettingsStore((s) => s.currency);
  const currencySymbol = getCurrencySymbol(currencyCode);
  const invalidateData = useAppStore((s) => s.invalidateData);

  const [expenseCats, setExpenseCats] = useState<CategoryRow[]>([]);
  const [selectedCatId, setSelectedCatId] = useState<string>('');
  const [amount, setAmount] = useState('');
  const [period, setPeriod] = useState<'monthly' | 'weekly' | 'yearly'>('monthly');
  const [warnAt, setWarnAt] = useState('80');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function loadExpenseCategories() {
      try {
        const db = createDrizzleDB(sqliteDb);
        const rows = await db
          .select()
          .from(categories)
          .where(and(eq(categories.type, 'expense'), eq(categories.is_active, 1)))
          .orderBy(categories.sort_order, categories.name);

        setExpenseCats(rows);
        if (rows.length > 0) {
          setSelectedCatId(rows[0].id);
        }
      } catch (err) {
        console.error('[AddBudgetScreen] Error loading categories:', err);
      }
    }
    loadExpenseCategories();
  }, [sqliteDb]);

  const handleSave = async () => {
    if (!selectedCatId) {
      Alert.alert('Required', 'Please select an expense category.');
      return;
    }

    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      Alert.alert('Invalid Amount', 'Please enter a budget amount greater than 0.');
      return;
    }

    setSaving(true);
    try {
      const db = createDrizzleDB(sqliteDb);
      const selectedCat = expenseCats.find((c) => c.id === selectedCatId);
      const now = nowISO();

      await db.insert(budgets).values({
        id:          generateUUID(),
        name:        selectedCat ? selectedCat.name : 'Category Budget',
        amount:      toMinorUnits(amount),
        period,
        start_date:  todayISO(),
        end_date:    null,
        category_id: selectedCatId,
        warn_at:     parseInt(warnAt, 10) || 80,
        is_active:   1,
        created_at:  now,
        updated_at:  now,
      });

      invalidateData();
      router.back();
    } catch (err) {
      console.error('[AddBudgetScreen] Save error:', err);
      Alert.alert('Error', 'Could not create budget.');
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
        <Text style={styles.headerTitle}>Add Budget</Text>
        <View style={{ width: 32 }} />
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {/* Amount Hero Section */}
          <View style={styles.amountHeroSection}>
            <Text style={styles.amountSublabel}>BUDGET AMOUNT</Text>
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

          {/* Expense Category Picker */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Select Expense Category</Text>
            <View style={styles.catGrid}>
              {expenseCats.map((cat) => {
                const selected = selectedCatId === cat.id;
                return (
                  <Pressable
                    key={cat.id}
                    onPress={() => setSelectedCatId(cat.id)}
                    style={[
                      styles.catChip,
                      selected ? styles.catChipSelected : styles.catChipUnselected,
                    ]}
                  >
                    <Ionicons
                      name={(cat.icon || 'restaurant') as any}
                      size={18}
                      color={selected ? EthosColors.primary : cat.color}
                    />
                    <Text
                      style={[
                        styles.catChipText,
                        selected && styles.catChipTextSelected,
                      ]}
                      numberOfLines={1}
                    >
                      {cat.name}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* Period Selection */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Budget Period</Text>
            <View style={styles.segmentedContainer}>
              {(['monthly', 'weekly', 'yearly'] as const).map((p) => {
                const active = period === p;
                return (
                  <Pressable
                    key={p}
                    onPress={() => setPeriod(p)}
                    style={[
                      styles.segmentBtn,
                      active && styles.segmentBtnActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.segmentText,
                        active && styles.segmentTextActive,
                      ]}
                    >
                      {p.toUpperCase()}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* Warning Threshold Picker */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Warning Threshold</Text>
            <View style={styles.segmentedContainer}>
              {[ '70', '80', '90' ].map((pct) => {
                const active = warnAt === pct;
                return (
                  <Pressable
                    key={pct}
                    onPress={() => setWarnAt(pct)}
                    style={[
                      styles.segmentBtn,
                      active && styles.segmentBtnActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.segmentText,
                        active && styles.segmentTextActive,
                      ]}
                    >
                      {pct}% Limit
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Footer Save Button */}
      <View style={styles.footer}>
        <Pressable
          id="save-budget-btn"
          onPress={handleSave}
          disabled={saving}
          style={({ pressed }) => [
            styles.saveBtn,
            pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] },
          ]}
        >
          <Text style={styles.saveBtnText}>
            {saving ? 'Creating...' : 'Create Budget'}
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
  catGrid: {
    flexDirection: 'row',
    flexWrap:      'wrap',
    gap:           EthosSpacing.unit,
  },
  catChip: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               6,
    paddingHorizontal: EthosSpacing.stackMd,
    paddingVertical:   EthosSpacing.stackSm,
    borderRadius:      EthosRadius.full,
    backgroundColor:   EthosColors.surfaceContainerLowest,
  },
  catChipUnselected: {
    borderWidth: EthosBorder.width,
    borderColor: EthosColors.outlineVariant,
  },
  catChipSelected: {
    borderWidth: 1.5,
    borderColor: EthosColors.primary,
  },
  catChipText: {
    ...EthosTypography.labelSm,
    color: EthosColors.outline,
  },
  catChipTextSelected: {
    color:      EthosColors.primary,
    fontWeight: '600',
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
