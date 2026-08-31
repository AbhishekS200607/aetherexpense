/**
 * AetherExpense — Debt Detail & Repayment Log Screen
 *
 * Detailed view of a single Debt/Loan record, repayment history timeline,
 * and repayment logging modal with account balance synchronization.
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  TextInput,
  Modal,
  Alert,
  Switch,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router, Stack } from 'expo-router';
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
import { formatCurrency, toPaise } from '@/utils/currency';
import { todayISO } from '@/utils/dates';
import { getDebtDetails, addDebtRepayment, deleteDebt } from '@/utils/debts';
import { getAccounts, type Account } from '@/utils/accounts';
import type { Debt, DebtRepayment } from '@/types/debts';

export default function DebtDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const sqliteDb = useSQLiteContext();
  const currencyCode = useSettingsStore((s) => s.currency);
  const invalidateData = useAppStore((s) => s.invalidateData);
  const dataVersion = useAppStore((s) => s.dataVersion);

  const [loading, setLoading] = useState(true);
  const [debtData, setDebtData] = useState<Debt | null>(null);
  const [repayments, setRepayments] = useState<DebtRepayment[]>([]);
  const [accountsList, setAccountsList] = useState<Account[]>([]);

  // Repayment Modal State
  const [showModal, setShowModal] = useState(false);
  const [repayAmountStr, setRepayAmountStr] = useState('');
  const [repayDate, setRepayDate] = useState(todayISO());
  const [repayNote, setRepayNote] = useState('');
  const [repayAccountId, setRepayAccountId] = useState<string | null>(null);
  const [adjustAccount, setAdjustAccount] = useState(true);
  const [submittingRepay, setSubmittingRepay] = useState(false);

  useEffect(() => {
    async function loadData() {
      if (!sqliteDb || !id) return;
      try {
        const db = createDrizzleDB(sqliteDb);
        const [details, accs] = await Promise.all([
          getDebtDetails(db, id),
          getAccounts(db),
        ]);

        if (details) {
          setDebtData(details.debt);
          setRepayments(details.repayments);
          setRepayAmountStr(
            (details.debt.remainingAmount / 100).toFixed(2).replace(/\.00$/, '')
          );
        }
        setAccountsList(accs);
        if (accs.length > 0) {
          setRepayAccountId(accs[0].id);
        }
      } catch (err) {
        console.error('[Debts] Error loading debt details:', err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [sqliteDb, id, dataVersion]);

  const handleDelete = () => {
    Alert.alert(
      'Delete Record',
      'Are you sure you want to delete this debt/loan record and all its repayment logs?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            if (!sqliteDb || !id) return;
            try {
              const db = createDrizzleDB(sqliteDb);
              await deleteDebt(db, id);
              invalidateData();
              router.back();
            } catch (err) {
              console.error('[Debts] Error deleting record:', err);
            }
          },
        },
      ]
    );
  };

  const handleRecordRepayment = async () => {
    const numAmount = parseFloat(repayAmountStr);
    if (isNaN(numAmount) || numAmount <= 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid repayment amount.');
      return;
    }
    if (!sqliteDb || !id || !debtData) return;

    setSubmittingRepay(true);

    try {
      const db = createDrizzleDB(sqliteDb);
      const amountPaise = toPaise(numAmount);

      await addDebtRepayment(db, {
        debtId:                id,
        amountPaise:           amountPaise,
        paymentDate:           repayDate.trim() || todayISO(),
        accountId:             repayAccountId,
        note:                  repayNote.trim() || null,
        adjustAccountBalance:  adjustAccount,
      });

      invalidateData();
      setShowModal(false);
      Alert.alert('Repayment Logged', 'The repayment has been successfully recorded.');
    } catch (err) {
      console.error('[Debts] Error recording repayment:', err);
      Alert.alert('Error', 'Failed to log repayment.');
    } finally {
      setSubmittingRepay(false);
    }
  };

  if (loading || !debtData) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.navBtn} hitSlop={8}>
            <Ionicons name="arrow-back" size={22} color={EthosColors.onSurface} />
          </Pressable>
          <Text style={styles.headerTitle}>Debt Details</Text>
          <View style={{ width: 32 }} />
        </View>
        <ActivityIndicator size="large" color={EthosColors.primary} style={{ marginTop: 40 }} />
      </SafeAreaView>
    );
  }

  const isLent = debtData.type === 'LENT';
  const isSettled = debtData.status === 'SETTLED';
  const paidAmount = debtData.totalAmount - debtData.remainingAmount;
  const progressPct = debtData.totalAmount > 0
    ? Math.min(100, Math.round((paidAmount / debtData.totalAmount) * 100))
    : 0;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Header Bar */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.navBtn} hitSlop={8}>
          <Ionicons name="arrow-back" size={22} color={EthosColors.onSurface} />
        </Pressable>
        <Text style={styles.headerTitle}>Debt Details</Text>
        <Pressable onPress={handleDelete} style={styles.navBtn} hitSlop={8}>
          <Ionicons name="trash-outline" size={20} color={EthosColors.error} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* ─── Hero Overview Bento Card ─────────────────────────────────── */}
        <View style={styles.heroCard}>
          <View style={styles.heroHeader}>
            <View style={[
              styles.typeBadge,
              isLent ? { backgroundColor: '#10B98115' } : { backgroundColor: 'rgba(239, 68, 68, 0.12)' }
            ]}>
              <Text style={[
                styles.typeBadgeText,
                isLent ? { color: '#059669' } : { color: EthosColors.error }
              ]}>
                {isLent ? 'OWED TO YOU' : 'YOU OWE'}
              </Text>
            </View>

            <View style={[
              styles.statusChip,
              isSettled ? { backgroundColor: '#10B98115' } : { backgroundColor: EthosColors.surfaceContainerLow }
            ]}>
              <Text style={[
                styles.statusChipText,
                isSettled ? { color: '#059669' } : { color: EthosColors.primary }
              ]}>
                {debtData.status}
              </Text>
            </View>
          </View>

          <Text style={styles.heroTitle}>{debtData.title}</Text>
          <Text style={styles.heroPerson}>Counterparty: {debtData.personName}</Text>

          <View style={styles.heroDivider} />

          {/* Amount Breakdown Grid */}
          <View style={styles.amountGrid}>
            <View style={{ flex: 1 }}>
              <Text style={styles.amountLabel}>REMAINING BALANCE</Text>
              <Text style={styles.heroRemainingVal}>
                {formatCurrency(debtData.remainingAmount, currencyCode)}
              </Text>
            </View>

            <View style={{ alignItems: 'flex-end' }}>
              <Text style={styles.amountLabel}>TOTAL AMOUNT</Text>
              <Text style={styles.heroTotalVal}>
                {formatCurrency(debtData.totalAmount, currencyCode)}
              </Text>
            </View>
          </View>

          {/* Progress Bar */}
          <View style={styles.progressWrap}>
            <View style={styles.progressTrack}>
              <View style={[
                styles.progressFill,
                { width: `${progressPct}%` },
                isSettled ? { backgroundColor: '#10B981' } : { backgroundColor: EthosColors.primary }
              ]} />
            </View>
            <View style={styles.progressTextRow}>
              <Text style={styles.progressSub}>Repaid: {formatCurrency(paidAmount, currencyCode)}</Text>
              <Text style={styles.progressSub}>{progressPct}% Settled</Text>
            </View>
          </View>

          {debtData.dueDate && (
            <View style={styles.dueDateRow}>
              <Ionicons name="calendar-outline" size={14} color={EthosColors.outline} />
              <Text style={styles.dueDateText}>Due Date: {debtData.dueDate}</Text>
            </View>
          )}

          {debtData.note && (
            <Text style={styles.noteText}>"{debtData.note}"</Text>
          )}

          {/* Action Button: Record Repayment */}
          {!isSettled && (
            <Pressable
              onPress={() => setShowModal(true)}
              style={({ pressed }) => [
                styles.repayActionBtn,
                pressed && { opacity: 0.9 },
              ]}
            >
              <Ionicons name="cash-outline" size={18} color="#FFFFFF" />
              <Text style={styles.repayActionText}>Record Repayment / Payment</Text>
            </Pressable>
          )}
        </View>

        {/* ─── Repayment History Timeline ──────────────────────────────── */}
        <View style={styles.sectionWrap}>
          <Text style={styles.sectionTitle}>REPAYMENT LOG TIMELINE</Text>
          {repayments.length === 0 ? (
            <View style={styles.emptyRepayWrap}>
              <Ionicons name="receipt-outline" size={28} color={EthosColors.outline} />
              <Text style={styles.emptyRepayText}>No repayments recorded yet.</Text>
            </View>
          ) : (
            <View style={styles.timelineWrap}>
              {repayments.map((rep, idx) => (
                <View key={rep.id} style={styles.timelineRow}>
                  <View style={styles.timelineDotBox}>
                    <View style={styles.timelineDot} />
                    {idx < repayments.length - 1 && <View style={styles.timelineLine} />}
                  </View>

                  <View style={styles.timelineCard}>
                    <View style={styles.repayHeader}>
                      <Text style={styles.repayAmountVal}>
                        +{formatCurrency(rep.amount, currencyCode)}
                      </Text>
                      <Text style={styles.repayDateText}>{rep.paymentDate}</Text>
                    </View>
                    {rep.note && (
                      <Text style={styles.repayNoteText}>{rep.note}</Text>
                    )}
                  </View>
                </View>
              ))}
            </View>
          )}
        </View>
      </ScrollView>

      {/* ─── Record Repayment Modal ────────────────────────────────────── */}
      <Modal visible={showModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Record Repayment</Text>
              <Pressable onPress={() => setShowModal(false)} hitSlop={8}>
                <Ionicons name="close" size={20} color={EthosColors.outline} />
              </Pressable>
            </View>

            {/* Repayment Amount */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>REPAYMENT AMOUNT ({currencyCode})</Text>
              <TextInput
                value={repayAmountStr}
                onChangeText={setRepayAmountStr}
                keyboardType="decimal-pad"
                placeholder="0.00"
                placeholderTextColor={EthosColors.outline}
                style={[styles.textInput, styles.amountInput]}
              />
            </View>

            {/* Payment Date */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>PAYMENT DATE (YYYY-MM-DD)</Text>
              <TextInput
                value={repayDate}
                onChangeText={setRepayDate}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={EthosColors.outline}
                style={styles.textInput}
              />
            </View>

            {/* Account Balance Sync Toggle */}
            <View style={styles.switchRow}>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={styles.switchTitle}>Adjust Account Balance?</Text>
                <Text style={styles.switchSubtext}>
                  {isLent ? 'Deposit repayment into account balance' : 'Deduct repayment from account balance'}
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
                <Text style={styles.label}>SELECT ACCOUNT</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                  {accountsList.map((acc) => {
                    const selected = repayAccountId === acc.id;
                    return (
                      <Pressable
                        key={acc.id}
                        onPress={() => setRepayAccountId(acc.id)}
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

            {/* Repayment Note */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>NOTE (OPTIONAL)</Text>
              <TextInput
                value={repayNote}
                onChangeText={setRepayNote}
                placeholder="e.g. Partial cash payment received"
                placeholderTextColor={EthosColors.outline}
                style={styles.textInput}
              />
            </View>

            {/* Modal Buttons */}
            <View style={styles.modalActions}>
              <Pressable
                onPress={() => setShowModal(false)}
                style={styles.modalCancelBtn}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </Pressable>

              <Pressable
                onPress={handleRecordRepayment}
                disabled={submittingRepay}
                style={styles.modalSubmitBtn}
              >
                <Text style={styles.modalSubmitText}>
                  {submittingRepay ? 'Saving...' : 'Save Repayment'}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
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
  scrollContent: {
    paddingHorizontal: EthosSpacing.containerPadding,
    paddingTop:        EthosSpacing.stackMd,
    paddingBottom:     96,
    gap:               EthosSpacing.stackLg,
  },
  heroCard: {
    backgroundColor: EthosColors.surfaceContainerLowest,
    borderRadius:    EthosRadius.lg,
    borderWidth:     EthosBorder.width,
    borderColor:     EthosBorder.color,
    padding:         EthosSpacing.containerPadding,
    gap:             EthosSpacing.stackSm,
  },
  heroHeader: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'space-between',
  },
  typeBadge: {
    paddingHorizontal: 8,
    paddingVertical:   3,
    borderRadius:      EthosRadius.sm,
  },
  typeBadgeText: {
    ...EthosTypography.labelSm,
    fontSize:   10,
    fontWeight: '700',
  },
  statusChip: {
    paddingHorizontal: 10,
    paddingVertical:   3,
    borderRadius:      EthosRadius.full,
    borderWidth:       EthosBorder.width,
    borderColor:       EthosBorder.color,
  },
  statusChipText: {
    ...EthosTypography.labelSm,
    fontSize:   10,
    fontWeight: '700',
  },
  heroTitle: {
    ...EthosTypography.headlineLg,
    fontSize:   20,
    fontWeight: '700',
    color:      EthosColors.primary,
    marginTop:  4,
  },
  heroPerson: {
    ...EthosTypography.bodyMd,
    color: EthosColors.outline,
  },
  heroDivider: {
    height:          1,
    backgroundColor: EthosBorder.color,
    marginVertical:  4,
  },
  amountGrid: {
    flexDirection:  'row',
    justifyContent: 'space-between',
    alignItems:     'baseline',
  },
  amountLabel: {
    ...EthosTypography.labelSm,
    fontSize: 10,
    color:    EthosColors.outline,
  },
  heroRemainingVal: {
    ...EthosTypography.headlineLg,
    fontSize:   22,
    fontWeight: '700',
    color:      EthosColors.primary,
  },
  heroTotalVal: {
    ...EthosTypography.bodyLg,
    fontSize:   16,
    fontWeight: '600',
    color:      EthosColors.outline,
  },
  progressWrap: {
    gap:       4,
    marginTop: 4,
  },
  progressTrack: {
    height:          8,
    borderRadius:    4,
    backgroundColor: EthosColors.surfaceContainerHigh,
    overflow:        'hidden',
  },
  progressFill: {
    height:       '100%',
    borderRadius: 4,
  },
  progressTextRow: {
    flexDirection:  'row',
    justifyContent: 'space-between',
  },
  progressSub: {
    ...EthosTypography.labelSm,
    fontSize: 11,
    color:    EthosColors.outline,
  },
  dueDateRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           6,
    marginTop:     4,
  },
  dueDateText: {
    ...EthosTypography.labelSm,
    color: EthosColors.outline,
  },
  noteText: {
    ...EthosTypography.bodyMd,
    fontStyle: 'italic',
    color:     EthosColors.onSurfaceVariant,
    marginTop: 4,
  },
  repayActionBtn: {
    flexDirection:     'row',
    alignItems:        'center',
    justifyContent:    'center',
    gap:               8,
    backgroundColor:   EthosColors.primary,
    borderRadius:      EthosRadius.md,
    paddingVertical:   12,
    marginTop:         8,
  },
  repayActionText: {
    ...EthosTypography.labelMd,
    color:      '#FFFFFF',
    fontWeight: '600',
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
  emptyRepayWrap: {
    backgroundColor: EthosColors.surfaceContainerLowest,
    borderRadius:    EthosRadius.lg,
    borderWidth:     EthosBorder.width,
    borderColor:     EthosBorder.color,
    padding:         EthosSpacing.containerPadding,
    alignItems:      'center',
    justifyContent:  'center',
    gap:             6,
  },
  emptyRepayText: {
    ...EthosTypography.bodyMd,
    fontSize: 13,
    color:    EthosColors.outline,
  },
  timelineWrap: {
    gap: EthosSpacing.stackSm,
  },
  timelineRow: {
    flexDirection: 'row',
    gap:           EthosSpacing.stackMd,
  },
  timelineDotBox: {
    alignItems: 'center',
    width:      16,
  },
  timelineDot: {
    width:           10,
    height:          10,
    borderRadius:    5,
    backgroundColor: EthosColors.primary,
    marginTop:       4,
  },
  timelineLine: {
    width:           2,
    flex:            1,
    backgroundColor: EthosBorder.color,
    marginTop:       2,
  },
  timelineCard: {
    flex:            1,
    backgroundColor: EthosColors.surfaceContainerLowest,
    borderRadius:    EthosRadius.md,
    borderWidth:     EthosBorder.width,
    borderColor:     EthosBorder.color,
    padding:         EthosSpacing.containerPadding,
    gap:             4,
  },
  repayHeader: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'space-between',
  },
  repayAmountVal: {
    ...EthosTypography.bodyLg,
    fontWeight: '700',
    color:      '#059669',
  },
  repayDateText: {
    ...EthosTypography.labelSm,
    fontSize: 11,
    color:    EthosColors.outline,
  },
  repayNoteText: {
    ...EthosTypography.bodyMd,
    fontSize: 12,
    color:    EthosColors.onSurfaceVariant,
  },
  modalOverlay: {
    flex:            1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems:      'center',
    justifyContent:  'center',
    padding:         EthosSpacing.containerPadding,
  },
  modalCard: {
    width:           '100%',
    backgroundColor: EthosColors.surfaceContainerLowest,
    borderRadius:    EthosRadius.lg,
    padding:         EthosSpacing.containerPadding,
    gap:             EthosSpacing.stackMd,
  },
  modalHeader: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'space-between',
  },
  modalTitle: {
    ...EthosTypography.headlineLg,
    fontSize:   18,
    fontWeight: '600',
    color:      EthosColors.primary,
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
    fontSize:   13,
    color:      EthosColors.primary,
  },
  switchSubtext: {
    ...EthosTypography.labelSm,
    fontSize: 11,
    color:    EthosColors.outline,
  },
  accountSelectorWrap: {
    gap: 6,
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
  modalActions: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'flex-end',
    gap:            EthosSpacing.stackMd,
    marginTop:      EthosSpacing.stackSm,
  },
  modalCancelBtn: {
    paddingHorizontal: EthosSpacing.stackMd,
    paddingVertical:   EthosSpacing.stackSm,
  },
  modalCancelText: {
    ...EthosTypography.labelMd,
    color: EthosColors.outline,
  },
  modalSubmitBtn: {
    backgroundColor:   EthosColors.primary,
    borderRadius:      EthosRadius.md,
    paddingHorizontal: EthosSpacing.containerPadding,
    paddingVertical:   EthosSpacing.stackSm + 2,
  },
  modalSubmitText: {
    ...EthosTypography.labelMd,
    fontWeight: '600',
    color:      '#FFFFFF',
  },
});
