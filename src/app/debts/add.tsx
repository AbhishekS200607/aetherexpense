/**
 * AetherExpense — Add Debt / Loan Screen Modal
 *
 * Dedicated creation form for pending cash flow IOUs (Lent vs Borrowed).
 * Includes account balance synchronization options and due date selection.
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  Pressable,
  Switch,
  StyleSheet,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSQLiteContext } from 'expo-sqlite';

import {
  EthosColors,
  EthosTypography,
  EthosSpacing,
  EthosRadius,
  EthosBorder,
} from '@/theme/ethos';
import { useSettingsStore } from '@/store/settingsStore';
import { useAppStore } from '@/store/appStore';
import { createDrizzleDB } from '@/database/client';
import { toPaise } from '@/utils/currency';
import { todayISO } from '@/utils/dates';
import { createDebt } from '@/utils/debts';
import { getAccounts, type Account } from '@/utils/accounts';
import type { DebtType } from '@/types/debts';

export default function AddDebtScreen() {
  const sqliteDb = useSQLiteContext();
  const currencyCode = useSettingsStore((s) => s.currency);
  const invalidateData = useAppStore((s) => s.invalidateData);

  const [debtType, setDebtType] = useState<DebtType>('LENT');
  const [title, setTitle] = useState('');
  const [personName, setPersonName] = useState('');
  const [amountStr, setAmountStr] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [note, setNote] = useState('');

  const [accountsList, setAccountsList] = useState<Account[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [adjustAccount, setAdjustAccount] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    async function loadAccounts() {
      if (!sqliteDb) return;
      try {
        const db = createDrizzleDB(sqliteDb);
        const accs = await getAccounts(db);
        setAccountsList(accs);
        if (accs.length > 0) {
          setSelectedAccountId(accs[0].id);
        }
      } catch (err) {
        console.error('[Debts] Error loading accounts:', err);
      }
    }
    loadAccounts();
  }, [sqliteDb]);

  const handleSubmit = async () => {
    if (!title.trim()) {
      Alert.alert('Missing Title', 'Please enter a title or description for this record.');
      return;
    }
    if (!personName.trim()) {
      Alert.alert('Missing Name', 'Please enter the name of the person or entity.');
      return;
    }
    const numAmount = parseFloat(amountStr);
    if (isNaN(numAmount) || numAmount <= 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid positive amount.');
      return;
    }
    if (!sqliteDb) return;

    setSubmitting(true);

    try {
      const db = createDrizzleDB(sqliteDb);
      const amountPaise = toPaise(numAmount);

      await createDebt(db, {
        title,
        personName,
        type:                 debtType,
        totalAmountPaise:     amountPaise,
        dueDate:              dueDate.trim() || null,
        note:                 note.trim() || null,
        accountId:            selectedAccountId,
        adjustAccountBalance: adjustAccount,
      });

      invalidateData();
      router.back();
    } catch (err) {
      console.error('[Debts] Error creating debt record:', err);
      Alert.alert('Error', 'Failed to create record. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.navBtn} hitSlop={8}>
          <Ionicons name="close" size={24} color={EthosColors.onSurface} />
        </Pressable>
        <Text style={styles.headerTitle}>Add Debt / Loan Record</Text>
        <Pressable
          onPress={handleSubmit}
          disabled={submitting}
          style={styles.saveHeaderBtn}
        >
          <Text style={styles.saveHeaderText}>Save</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* ─── Type Selector Switcher ────────────────────────────────────── */}
        <View style={styles.sectionWrap}>
          <Text style={styles.sectionTitle}>RECORD TYPE</Text>
          <View style={styles.typeSelectorBar}>
            <Pressable
              onPress={() => setDebtType('LENT')}
              style={[styles.typeOption, debtType === 'LENT' && styles.typeOptionLentActive]}
            >
              <Ionicons
                name="arrow-down"
                size={18}
                color={debtType === 'LENT' ? '#059669' : EthosColors.outline}
              />
              <View style={{ gap: 2 }}>
                <Text style={[styles.typeOptionTitle, debtType === 'LENT' && { color: '#059669' }]}>
                  I Lent / Owed to Me
                </Text>
                <Text style={styles.typeOptionSub}>Receivable (Client Invoice, Loan out)</Text>
              </View>
            </Pressable>

            <Pressable
              onPress={() => setDebtType('BORROWED')}
              style={[styles.typeOption, debtType === 'BORROWED' && styles.typeOptionBorrowActive]}
            >
              <Ionicons
                name="arrow-up"
                size={18}
                color={debtType === 'BORROWED' ? EthosColors.error : EthosColors.outline}
              />
              <View style={{ gap: 2 }}>
                <Text style={[styles.typeOptionTitle, debtType === 'BORROWED' && { color: EthosColors.error }]}>
                  I Borrowed / I Owe
                </Text>
                <Text style={styles.typeOptionSub}>Liability (Borrowed Cash, Loan in)</Text>
              </View>
            </Pressable>
          </View>
        </View>

        {/* ─── Main Details Bento Form ──────────────────────────────────── */}
        <View style={styles.bentoCard}>
          {/* Title */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>RECORD TITLE</Text>
            <TextInput
              value={title}
              onChangeText={setTitle}
              placeholder={debtType === 'LENT' ? 'e.g. Client Project Invoice' : 'e.g. Laptop Upgrade Loan'}
              placeholderTextColor={EthosColors.outline}
              style={styles.textInput}
            />
          </View>

          {/* Counterparty Person Name */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>
              {debtType === 'LENT' ? 'BORROWER / CLIENT NAME' : 'LENDER / BANK NAME'}
            </Text>
            <TextInput
              value={personName}
              onChangeText={setPersonName}
              placeholder="e.g. John Doe / Client X"
              placeholderTextColor={EthosColors.outline}
              style={styles.textInput}
            />
          </View>

          {/* Amount Input */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>TOTAL AMOUNT ({currencyCode})</Text>
            <TextInput
              value={amountStr}
              onChangeText={setAmountStr}
              keyboardType="decimal-pad"
              placeholder="0.00"
              placeholderTextColor={EthosColors.outline}
              style={[styles.textInput, styles.amountInput]}
            />
          </View>

          {/* Due Date (Optional) */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>DUE DATE (OPTIONAL, YYYY-MM-DD)</Text>
            <TextInput
              value={dueDate}
              onChangeText={setDueDate}
              placeholder="e.g. 2026-09-30"
              placeholderTextColor={EthosColors.outline}
              style={styles.textInput}
            />
          </View>
        </View>

        {/* ─── Account Synchronization Options ───────────────────────────── */}
        <View style={styles.sectionWrap}>
          <Text style={styles.sectionTitle}>ACCOUNT BALANCE SYNC</Text>
          <View style={styles.bentoCard}>
            <View style={styles.switchRow}>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={styles.switchTitle}>Adjust Account Balance Now?</Text>
                <Text style={styles.switchSubtext}>
                  {debtType === 'LENT'
                    ? 'Deduct this amount from your wallet/bank balance immediately'
                    : 'Add this borrowed cash into your wallet/bank balance immediately'}
                </Text>
              </View>
              <Switch
                value={adjustAccount}
                onValueChange={setAdjustAccount}
                trackColor={{ false: EthosColors.outlineVariant, true: EthosColors.primary }}
              />
            </View>

            {adjustAccount && accountsList.length > 0 && (
              <View style={styles.accountSelectorWrap}>
                <Text style={styles.label}>SELECT LINKED ACCOUNT</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                  {accountsList.map((acc) => {
                    const selected = selectedAccountId === acc.id;
                    return (
                      <Pressable
                        key={acc.id}
                        onPress={() => setSelectedAccountId(acc.id)}
                        style={[styles.accChip, selected && styles.accChipSelected]}
                      >
                        <Ionicons name={acc.icon as any} size={16} color={selected ? '#FFFFFF' : EthosColors.primary} />
                        <Text style={[styles.accChipText, selected && { color: '#FFFFFF' }]}>
                          {acc.name}
                        </Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              </View>
            )}
          </View>
        </View>

        {/* ─── Notes Section ────────────────────────────────────────────── */}
        <View style={styles.sectionWrap}>
          <Text style={styles.sectionTitle}>NOTES & REMINDERS</Text>
          <View style={styles.bentoCard}>
            <TextInput
              value={note}
              onChangeText={setNote}
              multiline
              numberOfLines={3}
              placeholder="Add optional notes, terms, or contact info..."
              placeholderTextColor={EthosColors.outline}
              style={[styles.textInput, { height: 80, textAlignVertical: 'top' }]}
            />
          </View>
        </View>

        {/* Action Button */}
        <Pressable
          onPress={handleSubmit}
          disabled={submitting}
          style={({ pressed }) => [
            styles.submitBtn,
            pressed && { opacity: 0.9 },
            submitting && { opacity: 0.5 },
          ]}
        >
          <Text style={styles.submitBtnText}>
            {submitting ? 'Saving Record...' : 'Save Debt / Loan Record'}
          </Text>
        </Pressable>
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
    flexDirection:     'row',
    alignItems:        'center',
    justifyContent:    'space-between',
    paddingHorizontal: EthosSpacing.containerPadding,
    paddingVertical:   EthosSpacing.stackMd,
    backgroundColor:   EthosColors.surface,
    borderBottomWidth: EthosBorder.width,
    borderBottomColor: EthosBorder.color,
  },
  navBtn: {
    padding: 4,
  },
  headerTitle: {
    ...EthosTypography.headlineLg,
    fontSize:   18,
    color:      EthosColors.onSurface,
    fontWeight: '600',
  },
  saveHeaderBtn: {
    paddingHorizontal: 12,
    paddingVertical:   6,
    backgroundColor:   EthosColors.primary,
    borderRadius:      EthosRadius.sm,
  },
  saveHeaderText: {
    ...EthosTypography.labelMd,
    color:      '#FFFFFF',
    fontWeight: '600',
  },
  scrollContent: {
    paddingHorizontal: EthosSpacing.containerPadding,
    paddingTop:        EthosSpacing.stackMd,
    paddingBottom:     96,
    gap:               EthosSpacing.stackLg,
  },
  sectionWrap: {
    gap: EthosSpacing.stackSm,
  },
  sectionTitle: {
    ...EthosTypography.labelSm,
    color:         EthosColors.outline,
    letterSpacing: 1.2,
    fontSize:      11,
  },
  typeSelectorBar: {
    gap: EthosSpacing.stackSm,
  },
  typeOption: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               EthosSpacing.stackMd,
    backgroundColor:   EthosColors.surfaceContainerLowest,
    borderRadius:      EthosRadius.lg,
    borderWidth:       EthosBorder.width,
    borderColor:       EthosBorder.color,
    padding:           EthosSpacing.containerPadding,
  },
  typeOptionLentActive: {
    borderColor:     '#10B981',
    backgroundColor: '#10B9810A',
  },
  typeOptionBorrowActive: {
    borderColor:     EthosColors.error,
    backgroundColor: 'rgba(239, 68, 68, 0.05)',
  },
  typeOptionTitle: {
    ...EthosTypography.bodyLg,
    fontWeight: '600',
    color:      EthosColors.primary,
    fontSize:   14,
  },
  typeOptionSub: {
    ...EthosTypography.labelSm,
    color:    EthosColors.outline,
    fontSize: 11,
  },
  bentoCard: {
    backgroundColor: EthosColors.surfaceContainerLowest,
    borderRadius:    EthosRadius.lg,
    borderWidth:     EthosBorder.width,
    borderColor:     EthosBorder.color,
    padding:         EthosSpacing.containerPadding,
    gap:             EthosSpacing.stackMd,
  },
  inputGroup: {
    gap: 4,
  },
  label: {
    ...EthosTypography.labelSm,
    fontSize: 10,
    color:    EthosColors.outline,
  },
  textInput: {
    backgroundColor:   EthosColors.surfaceContainerLow,
    borderRadius:      EthosRadius.md,
    borderWidth:       EthosBorder.width,
    borderColor:       EthosBorder.color,
    paddingHorizontal: EthosSpacing.containerPadding,
    paddingVertical:   10,
    ...EthosTypography.bodyMd,
    color:             EthosColors.onSurface,
  },
  amountInput: {
    ...EthosTypography.headlineLg,
    fontSize:   20,
    fontWeight: '700',
    color:      EthosColors.primary,
  },
  switchRow: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'space-between',
    gap:            EthosSpacing.stackMd,
  },
  switchTitle: {
    ...EthosTypography.bodyLg,
    fontWeight: '600',
    fontSize:   14,
    color:      EthosColors.primary,
  },
  switchSubtext: {
    ...EthosTypography.labelSm,
    fontSize: 11,
    color:    EthosColors.outline,
  },
  accountSelectorWrap: {
    gap:            6,
    paddingTop:     EthosSpacing.stackSm,
    borderTopWidth: EthosBorder.width,
    borderTopColor: EthosBorder.color,
  },
  accChip: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               6,
    backgroundColor:   EthosColors.surfaceContainerLow,
    borderRadius:      EthosRadius.full,
    borderWidth:       EthosBorder.width,
    borderColor:       EthosBorder.color,
    paddingHorizontal: 12,
    paddingVertical:   8,
  },
  accChipSelected: {
    backgroundColor: EthosColors.primary,
    borderColor:     EthosColors.primary,
  },
  accChipText: {
    ...EthosTypography.labelMd,
    fontSize: 12,
    color:    EthosColors.primary,
  },
  submitBtn: {
    backgroundColor: EthosColors.primary,
    borderRadius:    EthosRadius.md,
    paddingVertical: 14,
    alignItems:      'center',
    justifyContent:  'center',
    marginTop:       EthosSpacing.stackSm,
  },
  submitBtnText: {
    ...EthosTypography.labelMd,
    color:      '#FFFFFF',
    fontWeight: '600',
    fontSize:   15,
  },
});
