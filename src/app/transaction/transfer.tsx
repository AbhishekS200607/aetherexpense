/**
 * AetherExpense — Ethos Transfer Money Between Accounts Screen
 *
 * Transmitting money from one Account/Wallet to another (e.g. Bank -> Cash).
 * Transfers do NOT count as income or expense in total spending/income totals.
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
import { generateUUID as uuidv4 } from '@/utils/uuid';
import { eq } from 'drizzle-orm';

import { createDrizzleDB } from '@/database/client';
import { accounts, transactions, categories } from '@/database/schema';
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
import { todayISO, currentTimeHHMM, nowISO } from '@/utils/dates';
import type { AccountRow } from '@/database/schema';

export default function TransferScreen() {
  const sqliteDb = useSQLiteContext();
  const currencyCode = useSettingsStore((s) => s.currency);
  const currencySymbol = getCurrencySymbol(currencyCode);
  const invalidateData = useAppStore((s) => s.invalidateData);

  const [accList, setAccList] = useState<AccountRow[]>([]);
  const [fromAccountId, setFromAccountId] = useState<string>('');
  const [toAccountId, setToAccountId] = useState<string>('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(todayISO());
  const [time, setTime] = useState(currentTimeHHMM());
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function loadAccounts() {
      const db = createDrizzleDB(sqliteDb);
      const rows = await db
        .select()
        .from(accounts)
        .where(eq(accounts.is_active, 1))
        .orderBy(accounts.sort_order);

      setAccList(rows);
      if (rows.length >= 2) {
        setFromAccountId(rows[0].id);
        setToAccountId(rows[1].id);
      } else if (rows.length === 1) {
        setFromAccountId(rows[0].id);
      }
    }
    loadAccounts();
  }, [sqliteDb]);

  const handleCompleteTransfer = async () => {
    if (!fromAccountId || !toAccountId) {
      Alert.alert('Required', 'Please select both source and target accounts.');
      return;
    }
    if (fromAccountId === toAccountId) {
      Alert.alert('Invalid Transfer', 'Source and target accounts must be different.');
      return;
    }
    const numericAmt = parseFloat(amount);
    if (isNaN(numericAmt) || numericAmt <= 0) {
      Alert.alert('Invalid Amount', 'Please enter an amount greater than 0.');
      return;
    }

    setSaving(true);
    try {
      await sqliteDb.withTransactionAsync(async () => {
        const db = createDrizzleDB(sqliteDb);

        // Find or fallback a category for transfer
        const cats = await db.select().from(categories).limit(1);
        const defaultCatId = cats[0]?.id ?? 'default-cat';

        const now = nowISO();
        await db.insert(transactions).values({
          id:                     uuidv4(),
          type:                   'transfer',
          amount:                 toMinorUnits(amount),
          category_id:            defaultCatId,
          account_id:             fromAccountId,
          transfer_to_account_id: toAccountId,
          date,
          time,
          note:                   note.trim() || 'Account Transfer',
          merchant:               null,
          payment_method:         'bank',
          is_recurring:           0,
          created_at:             now,
          updated_at:             now,
        });
      });

      invalidateData();
      router.back();
    } catch (err) {
      console.error('[TransferScreen] Save error:', err);
      Alert.alert('Error', 'Could not complete transfer.');
    } finally {
      setSaving(false);
    }
  };

  const fromAccObj = accList.find((a) => a.id === fromAccountId);
  const toAccObj = accList.find((a) => a.id === toAccountId);

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      {/* Top Navbar */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.navBtn}>
          <Ionicons name="arrow-back" size={24} color={EthosColors.onSurface} />
        </Pressable>
        <Text style={styles.headerTitle}>Transfer Money</Text>
        <View style={{ width: 32 }} />
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {/* Amount Input Hero */}
          <View style={styles.amountHeroSection}>
            <Text style={styles.amountSublabel}>TRANSFER AMOUNT</Text>
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

          {/* Account Transfer Selection */}
          <View style={styles.transferFlowCard}>
            {/* From Account */}
            <View style={styles.accountPickGroup}>
              <Text style={styles.pickLabel}>FROM ACCOUNT</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
                {accList.map((acc) => {
                  const selected = acc.id === fromAccountId;
                  return (
                    <Pressable
                      key={acc.id}
                      onPress={() => setFromAccountId(acc.id)}
                      style={[
                        styles.accChip,
                        selected ? styles.accChipSelected : styles.accChipUnselected,
                      ]}
                    >
                      <Ionicons name={(acc.icon || 'wallet-outline') as any} size={16} color={selected ? EthosColors.primary : EthosColors.outline} />
                      <Text style={[styles.accChipText, selected && styles.accChipTextSelected]}>
                        {acc.name}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>

            {/* Transfer Direction Indicator */}
            <View style={styles.directionWrap}>
              <Ionicons name="arrow-down-circle" size={28} color={EthosColors.outline} />
            </View>

            {/* To Account */}
            <View style={styles.accountPickGroup}>
              <Text style={styles.pickLabel}>TO ACCOUNT</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
                {accList.map((acc) => {
                  const selected = acc.id === toAccountId;
                  const isDisabled = acc.id === fromAccountId;
                  return (
                    <Pressable
                      key={acc.id}
                      onPress={() => !isDisabled && setToAccountId(acc.id)}
                      style={[
                        styles.accChip,
                        selected ? styles.accChipSelected : styles.accChipUnselected,
                        isDisabled && { opacity: 0.4 },
                      ]}
                    >
                      <Ionicons name={(acc.icon || 'wallet-outline') as any} size={16} color={selected ? EthosColors.primary : EthosColors.outline} />
                      <Text style={[styles.accChipText, selected && styles.accChipTextSelected]}>
                        {acc.name}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>
          </View>

          {/* Date & Note Inputs */}
          <View style={styles.section}>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Date & Time</Text>
              <View style={styles.underlinedRow}>
                <Ionicons name="calendar-outline" size={18} color={EthosColors.outline} />
                <TextInput
                  value={date}
                  onChangeText={setDate}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor={EthosColors.outline}
                  style={[styles.underlinedInput, { flex: 1, marginLeft: 8 }]}
                />
                <TextInput
                  value={time}
                  onChangeText={setTime}
                  placeholder="HH:MM"
                  placeholderTextColor={EthosColors.outline}
                  style={[styles.underlinedInput, { width: 60, textAlign: 'right' }]}
                />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Note (Optional)</Text>
              <TextInput
                value={note}
                onChangeText={setNote}
                placeholder="e.g. ATM cash withdrawal"
                placeholderTextColor={EthosColors.outline}
                style={styles.underlinedInput}
              />
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Footer Save Button */}
      <View style={styles.footer}>
        <Pressable
          id="complete-transfer-btn"
          onPress={handleCompleteTransfer}
          disabled={saving}
          style={({ pressed }) => [
            styles.saveBtn,
            pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] },
          ]}
        >
          <Text style={styles.saveBtnText}>
            {saving ? 'Processing...' : 'Complete Transfer'}
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
    color: EthosColors.outline,
    letterSpacing: EthosTypography.labelSm.letterSpacing,
  },
  amountWrap: {
    flexDirection: 'row',
    alignItems:    'center',
    justifyContent: 'center',
  },
  amountSymbol: {
    ...EthosTypography.displayMd,
    color: EthosColors.primary,
    marginRight: 6,
  },
  amountInput: {
    ...EthosTypography.displayMd,
    color: EthosColors.primary,
    fontVariant: ['tabular-nums'],
    minWidth: 120,
    textAlign: 'center',
  },
  transferFlowCard: {
    backgroundColor: EthosColors.surfaceContainerLowest,
    borderRadius:    EthosRadius.lg,
    borderWidth:     EthosBorder.width,
    borderColor:     EthosBorder.color,
    padding:         EthosSpacing.containerPadding,
    gap:             EthosSpacing.stackMd,
  },
  accountPickGroup: {
    gap: EthosSpacing.unit,
  },
  pickLabel: {
    ...EthosTypography.labelSm,
    color: EthosColors.outline,
    letterSpacing: EthosTypography.labelSm.letterSpacing,
  },
  chipRow: {
    gap: EthosSpacing.unit,
  },
  accChip: {
    flexDirection:   'row',
    alignItems:      'center',
    gap:             6,
    paddingHorizontal: EthosSpacing.stackMd,
    paddingVertical:   EthosSpacing.stackSm,
    borderRadius:    EthosRadius.full,
    backgroundColor: EthosColors.surfaceContainerLow,
  },
  accChipUnselected: {
    borderWidth: EthosBorder.width,
    borderColor: EthosBorder.color,
  },
  accChipSelected: {
    borderWidth: 1.5,
    borderColor: EthosColors.primary,
  },
  accChipText: {
    ...EthosTypography.labelSm,
    color: EthosColors.outline,
  },
  accChipTextSelected: {
    color:      EthosColors.primary,
    fontWeight: '600',
  },
  directionWrap: {
    alignItems:     'center',
    justifyContent: 'center',
    marginVertical: 4,
  },
  section: {
    gap: EthosSpacing.stackLg,
  },
  inputGroup: {
    gap: EthosSpacing.unit,
  },
  label: {
    ...EthosTypography.labelSm,
    color: EthosColors.outline,
  },
  underlinedRow: {
    flexDirection:     'row',
    alignItems:        'center',
    paddingVertical:   EthosSpacing.unit,
    borderBottomWidth: EthosBorder.width,
    borderBottomColor: EthosColors.outlineVariant,
  },
  underlinedInput: {
    ...EthosTypography.bodyMd,
    color:             EthosColors.onSurface,
    paddingVertical:   EthosSpacing.unit,
    borderBottomWidth: EthosBorder.width,
    borderBottomColor: EthosColors.outlineVariant,
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
