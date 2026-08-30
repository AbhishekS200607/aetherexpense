/**
 * AetherExpense — Ethos Edit Bill Screen
 *
 * Pre-fills bill details for editing amount, due date, frequency, and account/category.
 * Supports updating bill configuration or deleting bill without altering historical transactions.
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
  Switch,
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
import { bills, transactions } from '@/database/schema';
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
import { nowISO } from '@/utils/dates';
import { scheduleBillNotification, cancelBillNotification } from '@/utils/notifications';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';

type BillRow = typeof bills.$inferSelect;

export default function EditBillScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const sqliteDb = useSQLiteContext();
  const currencyCode = useSettingsStore((s) => s.currency);
  const currencySymbol = getCurrencySymbol(currencyCode);
  const invalidateData = useAppStore((s) => s.invalidateData);

  const [bill, setBill] = useState<BillRow | null>(null);
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [frequency, setFrequency] = useState<'one_time' | 'weekly' | 'monthly' | 'yearly'>('monthly');
  const [note, setNote] = useState('');
  const [autoCreateTxn, setAutoCreateTxn] = useState(true);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showDelete, setShowDelete] = useState(false);

  useEffect(() => {
    if (!id) return;
    async function load() {
      try {
        const db = createDrizzleDB(sqliteDb);
        const [b] = await db
          .select()
          .from(bills)
          .where(eq(bills.id, id))
          .limit(1);

        if (b) {
          setBill(b);
          setName(b.name);
          setAmount(String((b.amount / 100).toFixed(2)));
          setDueDate(b.due_date);
          setFrequency(b.frequency as any);
          setNote(b.note || '');
          setAutoCreateTxn(b.auto_create_transaction === 1);
        }
      } catch (err) {
        console.error('[EditBillScreen] Load error:', err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id, sqliteDb]);

  const handleSave = async () => {
    if (!id) return;
    if (!name.trim()) {
      Alert.alert('Required', 'Please enter a bill name.');
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
      const minorAmount = toMinorUnits(amount);
      const formattedAmt = formatCurrency(minorAmount, currencyCode);

      // Cancel previous notification if any
      await cancelBillNotification(bill?.notification_id);

      // Schedule updated local notification if unpaid
      let notifId: string | null = null;
      if (bill?.is_paid === 0) {
        notifId = await scheduleBillNotification(
          id,
          name.trim(),
          formattedAmt,
          dueDate,
          1
        );
      }

      await db
        .update(bills)
        .set({
          name:                    name.trim(),
          amount:                  minorAmount,
          due_date:                dueDate,
          frequency,
          note:                    note || null,
          auto_create_transaction: autoCreateTxn ? 1 : 0,
          notification_id:         notifId,
          updated_at:              now,
        })
        .where(eq(bills.id, id));

      invalidateData();
      router.back();
    } catch (err) {
      console.error('[EditBillScreen] Save error:', err);
      Alert.alert('Error', 'Could not update bill.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!id) return;
    try {
      // Cancel pending local notification
      await cancelBillNotification(bill?.notification_id);

      const db = createDrizzleDB(sqliteDb);

      // Unlink past transactions referencing this bill
      await db
        .update(transactions)
        .set({ bill_id: null })
        .where(eq(transactions.bill_id, id));

      await db.delete(bills).where(eq(bills.id, id));

      invalidateData();
      router.back();
    } catch (err) {
      console.error('[EditBillScreen] Delete error:', err);
      Alert.alert('Error', 'Could not delete bill.');
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
        <Text style={styles.headerTitle}>Edit Bill</Text>
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
              placeholder="e.g. Rent, Electricity"
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

          {/* Delete Action */}
          <View style={styles.secondaryActionsRow}>
            <Pressable onPress={() => setShowDelete(true)} style={styles.deleteBtn}>
              <Ionicons name="trash-outline" size={18} color={EthosColors.error} />
              <Text style={styles.deleteBtnText}>Delete Bill</Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Footer Save Button */}
      <View style={styles.footer}>
        <Pressable
          id="update-bill-btn"
          onPress={handleSave}
          disabled={saving}
          style={({ pressed }) => [
            styles.saveBtn,
            pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] },
          ]}
        >
          <Text style={styles.saveBtnText}>
            {saving ? 'Updating...' : 'Update Bill'}
          </Text>
        </Pressable>
      </View>

      {/* Confirm Delete Dialog */}
      <ConfirmDialog
        visible={showDelete}
        title="Delete Bill?"
        message="Deleting this bill will not delete past transactions generated from it."
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
