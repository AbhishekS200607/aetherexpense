/**
 * AetherExpense — Ethos Edit Budget Screen
 *
 * Allows updating budget amount, period, and warning threshold.
 * Supports budget deletion without deleting historical transactions.
 */

import React, { useEffect, useState } from 'react';
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
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSQLiteContext } from 'expo-sqlite';
import { eq } from 'drizzle-orm';

import { createDrizzleDB } from '@/database/client';
import { budgets, categories } from '@/database/schema';
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
import { nowISO } from '@/utils/dates';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import type { BudgetRow, CategoryRow } from '@/database/schema';

export default function EditBudgetScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const sqliteDb = useSQLiteContext();
  const currencyCode = useSettingsStore((s) => s.currency);
  const currencySymbol = getCurrencySymbol(currencyCode);
  const invalidateData = useAppStore((s) => s.invalidateData);

  const [budgetObj, setBudgetObj] = useState<BudgetRow | null>(null);
  const [categoryObj, setCategoryObj] = useState<CategoryRow | null>(null);
  const [amount, setAmount] = useState('');
  const [period, setPeriod] = useState<'monthly' | 'weekly' | 'yearly'>('monthly');
  const [warnAt, setWarnAt] = useState('80');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showDelete, setShowDelete] = useState(false);

  useEffect(() => {
    if (!id) return;
    async function load() {
      try {
        const db = createDrizzleDB(sqliteDb);
        const [b] = await db
          .select()
          .from(budgets)
          .where(eq(budgets.id, id))
          .limit(1);

        if (b) {
          setBudgetObj(b);
          setAmount(String((b.amount / 100).toFixed(2)));
          setPeriod(b.period as any);
          setWarnAt(String(b.warn_at));

          if (b.category_id) {
            const [cat] = await db
              .select()
              .from(categories)
              .where(eq(categories.id, b.category_id))
              .limit(1);
            if (cat) setCategoryObj(cat);
          }
        }
      } catch (err) {
        console.error('[EditBudgetScreen] Load error:', err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id, sqliteDb]);

  const handleSave = async () => {
    if (!id) return;

    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      Alert.alert('Invalid Amount', 'Please enter a budget amount greater than 0.');
      return;
    }

    setSaving(true);
    try {
      const db = createDrizzleDB(sqliteDb);

      await db
        .update(budgets)
        .set({
          amount:     toMinorUnits(amount),
          period,
          warn_at:    parseInt(warnAt, 10) || 80,
          updated_at: nowISO(),
        })
        .where(eq(budgets.id, id));

      invalidateData();
      router.back();
    } catch (err) {
      console.error('[EditBudgetScreen] Update error:', err);
      Alert.alert('Error', 'Could not update budget.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!id) return;
    try {
      const db = createDrizzleDB(sqliteDb);
      // Soft-delete budget so historical transaction references remain intact
      await db
        .update(budgets)
        .set({ is_active: 0, updated_at: nowISO() })
        .where(eq(budgets.id, id));

      invalidateData();
      router.back();
    } catch (err) {
      console.error('[EditBudgetScreen] Delete error:', err);
      Alert.alert('Error', 'Could not delete budget.');
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator color={EthosColors.primary} size="large" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      {/* Top Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.navBtn}>
          <Ionicons name="arrow-back" size={24} color={EthosColors.onSurface} />
        </Pressable>
        <Text style={styles.headerTitle}>Edit Budget</Text>
        <View style={{ width: 32 }} />
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {/* Amount Hero Section */}
          <View style={styles.amountHeroSection}>
            <Text style={styles.amountSublabel}>
              {categoryObj ? categoryObj.name.toUpperCase() : 'CATEGORY'} BUDGET
            </Text>
            <View style={styles.amountWrap}>
              <Text style={styles.amountSymbol}>{currencySymbol}</Text>
              <TextInput
                value={amount}
                onChangeText={setAmount}
                placeholder="0.00"
                placeholderTextColor={EthosColors.outline}
                keyboardType="decimal-pad"
                style={styles.amountInput}
              />
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

          {/* Delete Action */}
          <View style={styles.secondaryActionsRow}>
            <Pressable onPress={() => setShowDelete(true)} style={styles.deleteBtn}>
              <Ionicons name="trash-outline" size={18} color={EthosColors.error} />
              <Text style={styles.deleteBtnText}>Delete Budget</Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Footer Save Button */}
      <View style={styles.footer}>
        <Pressable
          id="update-budget-btn"
          onPress={handleSave}
          disabled={saving}
          style={({ pressed }) => [
            styles.saveBtn,
            pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] },
          ]}
        >
          <Text style={styles.saveBtnText}>
            {saving ? 'Updating...' : 'Update Budget'}
          </Text>
        </Pressable>
      </View>

      {/* Confirm Delete Dialog */}
      <ConfirmDialog
        visible={showDelete}
        title="Delete Budget?"
        message="Deleting this budget will not delete any transactions."
        confirmLabel="Delete"
        danger
        onConfirm={handleDelete}
        onCancel={() => setShowDelete(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: EthosColors.surface,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
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
  secondaryActionsRow: {
    alignItems:     'center',
    justifyContent: 'center',
    marginTop:      EthosSpacing.stackLg,
    paddingTop:     EthosSpacing.stackMd,
    borderTopWidth: EthosBorder.width,
    borderTopColor: EthosColors.outlineVariant,
  },
  deleteBtn: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           6,
    padding:       EthosSpacing.unit,
  },
  deleteBtnText: {
    ...EthosTypography.labelMd,
    color: EthosColors.error,
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
