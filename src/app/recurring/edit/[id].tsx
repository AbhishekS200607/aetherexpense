/**
 * AetherExpense — Ethos Edit Recurring Rule Screen
 *
 * Pre-fills recurring rule configuration.
 * Allows updating future occurrences, pausing/resuming, and deleting recurring rules.
 * Does NOT alter previously generated historical transactions.
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
import { recurringTransactions, categories, accounts } from '@/database/schema';
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

type RecurringTransactionRow = typeof recurringTransactions.$inferSelect;

export default function EditRecurringScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const sqliteDb = useSQLiteContext();
  const currencyCode = useSettingsStore((s) => s.currency);
  const currencySymbol = getCurrencySymbol(currencyCode);
  const invalidateData = useAppStore((s) => s.invalidateData);

  const [rule, setRule] = useState<RecurringTransactionRow | null>(null);
  const [amount, setAmount] = useState('');
  const [merchant, setMerchant] = useState('');
  const [note, setNote] = useState('');
  const [frequency, setFrequency] = useState<'daily' | 'weekly' | 'monthly' | 'yearly'>('monthly');
  const [isActive, setIsActive] = useState(1);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showDelete, setShowDelete] = useState(false);

  useEffect(() => {
    if (!id) return;
    async function load() {
      try {
        const db = createDrizzleDB(sqliteDb);
        const [r] = await db
          .select()
          .from(recurringTransactions)
          .where(eq(recurringTransactions.id, id))
          .limit(1);

        if (r) {
          setRule(r);
          setAmount(String((r.amount / 100).toFixed(2)));
          setMerchant(r.merchant || '');
          setNote(r.note || '');
          setFrequency(r.frequency as any);
          setIsActive(r.is_active);
        }
      } catch (err) {
        console.error('[EditRecurringScreen] Load error:', err);
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
      Alert.alert('Invalid Amount', 'Please enter an amount greater than 0.');
      return;
    }

    setSaving(true);
    try {
      const db = createDrizzleDB(sqliteDb);
      const now = nowISO();

      await db
        .update(recurringTransactions)
        .set({
          amount:    toMinorUnits(amount),
          merchant:  merchant || null,
          note:      note || merchant || null,
          frequency,
          is_active: isActive,
          updated_at:now,
        })
        .where(eq(recurringTransactions.id, id));

      invalidateData();
      router.back();
    } catch (err) {
      console.error('[EditRecurringScreen] Save error:', err);
      Alert.alert('Error', 'Could not update recurring rule.');
    } finally {
      setSaving(false);
    }
  };

  const handleTogglePause = async () => {
    if (!id) return;
    const newActiveState = isActive === 1 ? 0 : 1;
    try {
      const db = createDrizzleDB(sqliteDb);
      await db
        .update(recurringTransactions)
        .set({
          is_active:  newActiveState,
          updated_at: nowISO(),
        })
        .where(eq(recurringTransactions.id, id));

      setIsActive(newActiveState);
      invalidateData();
    } catch (err) {
      console.error('[EditRecurringScreen] Pause toggle error:', err);
    }
  };

  const handleDelete = async () => {
    if (!id) return;
    try {
      const db = createDrizzleDB(sqliteDb);
      // Soft-delete or remove rule record without touching generated transactions
      await db.delete(recurringTransactions).where(eq(recurringTransactions.id, id));

      invalidateData();
      router.back();
    } catch (err) {
      console.error('[EditRecurringScreen] Delete error:', err);
      Alert.alert('Error', 'Could not delete recurring rule.');
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
        <Text style={styles.headerTitle}>Edit Recurring Rule</Text>
        <View style={{ width: 32 }} />
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {/* Pause / Active Banner */}
          <View style={styles.statusBannerRow}>
            <Text style={styles.statusLabel}>
              Status: {isActive === 1 ? 'Active' : 'Paused'}
            </Text>
            <Pressable
              onPress={handleTogglePause}
              style={[
                styles.pauseToggleBtn,
                isActive === 1 ? styles.pauseBtnBg : styles.resumeBtnBg,
              ]}
            >
              <Text style={styles.pauseToggleText}>
                {isActive === 1 ? 'Pause Schedule' : 'Resume Schedule'}
              </Text>
            </Pressable>
          </View>

          {/* Amount Hero Section */}
          <View style={styles.amountHeroSection}>
            <Text style={styles.amountSublabel}>AMOUNT</Text>
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

          {/* Delete Action */}
          <View style={styles.secondaryActionsRow}>
            <Pressable onPress={() => setShowDelete(true)} style={styles.deleteBtn}>
              <Ionicons name="trash-outline" size={18} color={EthosColors.error} />
              <Text style={styles.deleteBtnText}>Delete Recurring Rule</Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Footer Save Button */}
      <View style={styles.footer}>
        <Pressable
          id="update-recurring-btn"
          onPress={handleSave}
          disabled={saving}
          style={({ pressed }) => [
            styles.saveBtn,
            pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] },
          ]}
        >
          <Text style={styles.saveBtnText}>
            {saving ? 'Updating...' : 'Update Recurring Rule'}
          </Text>
        </Pressable>
      </View>

      {/* Confirm Delete Dialog */}
      <ConfirmDialog
        visible={showDelete}
        title="Delete Recurring Rule?"
        message="Deleting this rule will not delete past transactions generated from it."
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
    color:      EthosColors.primary,
    fontWeight: '500',
  },
  scrollContent: {
    paddingHorizontal: EthosSpacing.containerPadding,
    paddingTop:        EthosSpacing.unit,
    paddingBottom:     120,
    gap:               EthosSpacing.stackLg,
  },
  statusBannerRow: {
    flexDirection:     'row',
    alignItems:        'center',
    justifyContent:    'space-between',
    backgroundColor:   EthosColors.surfaceContainerLowest,
    borderWidth:       EthosBorder.width,
    borderColor:       EthosBorder.color,
    borderRadius:      EthosRadius.md,
    paddingHorizontal: EthosSpacing.stackMd,
    paddingVertical:   EthosSpacing.stackSm,
  },
  statusLabel: {
    ...EthosTypography.labelMd,
    fontWeight: '600',
    color:      EthosColors.onSurface,
  },
  pauseToggleBtn: {
    paddingHorizontal: EthosSpacing.stackSm + 4,
    paddingVertical:   6,
    borderRadius:      EthosRadius.full,
  },
  pauseBtnBg: {
    backgroundColor: 'rgba(217, 119, 6, 0.15)',
  },
  resumeBtnBg: {
    backgroundColor: 'rgba(5, 150, 105, 0.15)',
  },
  pauseToggleText: {
    ...EthosTypography.labelSm,
    fontWeight: '600',
    color:      EthosColors.primary,
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
