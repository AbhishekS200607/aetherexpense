/**
 * AetherExpense — Ethos Transaction Details Screen
 *
 * Implements Stitch `transaction_details` visual source of truth:
 *   - Back button header
 *   - Amount hero bento-card with category pill badge
 *   - Metadata list rows with hairline dividers (Merchant, Date, Time, Payment Method, Note)
 *   - Edit & Delete actions
 *   - Delete confirmation modal
 */

import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSQLiteContext } from 'expo-sqlite';
import { eq } from 'drizzle-orm';

import { createDrizzleDB } from '@/database/client';
import { transactions, categories } from '@/database/schema';
import { useSettingsStore } from '@/store/settingsStore';
import { useAppStore } from '@/store/appStore';
import {
  EthosColors,
  EthosTypography,
  EthosSpacing,
  EthosRadius,
  EthosBorder,
} from '@/theme/ethos';
import { formatCurrency } from '@/utils/currency';
import { formatDate } from '@/utils/dates';
import { PAYMENT_METHOD_MAP } from '@/constants/paymentMethods';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';

interface TxnDetailData {
  id:             string;
  type:           'income' | 'expense' | 'transfer';
  amount:         number;
  date:           string;
  time:           string;
  note:           string | null;
  merchant:       string | null;
  payment_method: string;
  receipt_path:   string | null;
  category_name:  string;
  category_icon:  string;
  category_color: string;
  created_at:     string;
}

export default function TransactionDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const sqliteDb = useSQLiteContext();
  const currencyCode = useSettingsStore((s) => s.currency);
  const dateFormat = useSettingsStore((s) => s.date_format);
  const dataVersion = useAppStore((s) => s.dataVersion);
  const invalidateData = useAppStore((s) => s.invalidateData);

  const [txn, setTxn] = useState<TxnDetailData | null>(null);
  const [showDelete, setShowDelete] = useState(false);

  const fetchDetails = async () => {
    if (!id) return;
    try {
      const db = createDrizzleDB(sqliteDb);
      const result = await db
        .select({
          id:             transactions.id,
          type:           transactions.type,
          amount:         transactions.amount,
          date:           transactions.date,
          time:           transactions.time,
          note:           transactions.note,
          merchant:       transactions.merchant,
          payment_method: transactions.payment_method,
          receipt_path:   transactions.receipt_path,
          category_name:  categories.name,
          category_icon:  categories.icon,
          category_color: categories.color,
          created_at:     transactions.created_at,
        })
        .from(transactions)
        .innerJoin(categories, eq(transactions.category_id, categories.id))
        .where(eq(transactions.id, id))
        .limit(1);

      if (result[0]) {
        setTxn(result[0] as TxnDetailData);
      }
    } catch (err) {
      console.error('[TransactionDetailScreen] Error:', err);
    }
  };

  useEffect(() => {
    fetchDetails();
  }, [id, dataVersion, sqliteDb]);

  const handleDelete = async () => {
    if (!id) return;
    try {
      const db = createDrizzleDB(sqliteDb);
      await db.delete(transactions).where(eq(transactions.id, id));
      invalidateData();
      router.back();
    } catch (err) {
      console.error('[TransactionDetailScreen] Delete error:', err);
      Alert.alert('Error', 'Could not delete transaction.');
    }
  };

  if (!txn) return null;

  const isIncome = txn.type === 'income';
  const pm = PAYMENT_METHOD_MAP[txn.payment_method as keyof typeof PAYMENT_METHOD_MAP];

  // Format date display: e.g. "29 August 2026"
  const formattedDate = () => {
    const [y, m, d] = txn.date.split('-');
    const dateObj = new Date(Number(y), Number(m) - 1, Number(d));
    return dateObj.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  };

  // Format time display: e.g. "8:42 PM"
  const formattedTime = () => {
    const [h, m] = txn.time.split(':');
    const hourNum = Number(h);
    const ampm = hourNum >= 12 ? 'PM' : 'AM';
    const hour12 = hourNum % 12 || 12;
    return `${hour12}:${m} ${ampm}`;
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      {/* ─── Top Navigation Bar ────────────────────────────────────────── */}
      <View style={styles.navbar}>
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [styles.navBtn, pressed && { opacity: 0.7 }]}
          accessibilityLabel="Go back"
        >
          <Ionicons name="arrow-back" size={24} color={EthosColors.onSurface} />
          <Text style={styles.navTitle}>Details</Text>
        </Pressable>

        <Pressable
          onPress={() => router.push(`/transaction/edit/${id}`)}
          style={({ pressed }) => [styles.navIconBtn, pressed && { opacity: 0.7 }]}
          accessibilityLabel="More options"
        >
          <Ionicons name="ellipsis-vertical" size={20} color={EthosColors.outline} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* ─── Amount Hero Bento Card ────────────────────────────────────── */}
        <View style={styles.heroCard}>
          <Text style={styles.heroSublabel}>
            {isIncome ? 'AMOUNT RECEIVED' : 'AMOUNT SPENT'}
          </Text>

          <Text
            style={[
              styles.heroAmount,
              { color: isIncome ? EthosColors.income : EthosColors.onSurface },
            ]}
          >
            {isIncome ? '+' : '-'}{formatCurrency(txn.amount, currencyCode)}
          </Text>

          {/* Category Chip */}
          <View style={styles.categoryChip}>
            <Ionicons
              name={(txn.category_icon || 'restaurant') as any}
              size={14}
              color={txn.category_color || EthosColors.outline}
            />
            <Text style={styles.categoryChipText}>{txn.category_name}</Text>
          </View>
        </View>

        {/* ─── Metadata Details Card ──────────────────────────────────────── */}
        <View style={styles.metadataCard}>
          {/* Merchant */}
          <View style={styles.listRow}>
            <Text style={styles.rowLabel}>Merchant</Text>
            <Text style={[styles.rowValue, { fontWeight: '500' }]}>
              {txn.merchant || '—'}
            </Text>
          </View>

          {/* Date */}
          <View style={styles.listRow}>
            <Text style={styles.rowLabel}>Date</Text>
            <Text style={styles.rowValue}>{formattedDate()}</Text>
          </View>

          {/* Time */}
          <View style={styles.listRow}>
            <Text style={styles.rowLabel}>Time</Text>
            <Text style={styles.rowValue}>{formattedTime()}</Text>
          </View>

          {/* Payment Method */}
          <View style={styles.listRow}>
            <Text style={styles.rowLabel}>Payment Method</Text>
            <View style={styles.pmValueWrap}>
              <Ionicons name="card-outline" size={16} color={EthosColors.outline} />
              <Text style={styles.rowValue}>{pm?.label || txn.payment_method.toUpperCase()}</Text>
            </View>
          </View>

          {/* Note */}
          <View style={[styles.listRow, { borderBottomWidth: 0 }]}>
            <Text style={styles.rowLabel}>Note</Text>
            <Text style={[styles.rowValue, { fontStyle: 'italic' }]}>
              {txn.note || '—'}
            </Text>
          </View>
        </View>

        {/* ─── Action Buttons (Edit / Delete) ──────────────────────────────── */}
        <View style={styles.actionsRow}>
          <Pressable
            id="edit-transaction-btn"
            onPress={() => router.push(`/transaction/edit/${id}`)}
            style={({ pressed }) => [styles.actionBtn, pressed && { opacity: 0.7 }]}
          >
            <Ionicons name="pencil-outline" size={18} color={EthosColors.onSurface} />
            <Text style={styles.actionBtnText}>Edit</Text>
          </Pressable>

          <Pressable
            id="delete-transaction-btn"
            onPress={() => setShowDelete(true)}
            style={({ pressed }) => [styles.actionBtn, pressed && { opacity: 0.7 }]}
          >
            <Ionicons name="trash-outline" size={18} color={EthosColors.error} />
            <Text style={[styles.actionBtnText, { color: EthosColors.error }]}>Delete</Text>
          </Pressable>
        </View>
      </ScrollView>

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        visible={showDelete}
        title="Delete Transaction?"
        message="This action cannot be undone."
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
    backgroundColor: EthosColors.background,
  },
  navbar: {
    flexDirection:     'row',
    alignItems:        'center',
    justifyContent:    'space-between',
    paddingHorizontal: EthosSpacing.containerPadding,
    paddingVertical:   EthosSpacing.stackMd,
    backgroundColor:   EthosColors.surface,
  },
  navBtn: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           EthosSpacing.stackSm,
  },
  navTitle: {
    ...EthosTypography.headlineLg,
    color: EthosColors.onSurface,
  },
  navIconBtn: {
    padding: 4,
  },
  scrollContent: {
    paddingHorizontal: EthosSpacing.containerPadding,
    paddingTop:        EthosSpacing.stackLg,
    paddingBottom:     EthosSpacing.stackLg,
    gap:               EthosSpacing.stackLg,
  },
  heroCard: {
    backgroundColor: EthosColors.surfaceContainerLowest,
    borderRadius:    EthosRadius.lg,
    borderWidth:     EthosBorder.width,
    borderColor:     EthosBorder.color,
    paddingVertical: 36,
    paddingHorizontal: EthosSpacing.containerPadding,
    alignItems:      'center',
    justifyContent:  'center',
    gap:             EthosSpacing.unit,
  },
  heroSublabel: {
    ...EthosTypography.labelSm,
    color:         EthosColors.outline,
    letterSpacing: EthosTypography.labelSm.letterSpacing,
  },
  heroAmount: {
    ...EthosTypography.displayMd,
    fontVariant: ['tabular-nums'],
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           6,
    backgroundColor: EthosColors.surfaceContainerLow,
    borderRadius:  EthosRadius.full,
    borderWidth:   EthosBorder.width,
    borderColor:   EthosBorder.color,
    paddingHorizontal: EthosSpacing.stackMd,
    paddingVertical:   4,
    marginTop:        EthosSpacing.unit,
  },
  categoryChipText: {
    ...EthosTypography.labelSm,
    color: EthosColors.onSurfaceVariant,
  },
  metadataCard: {
    backgroundColor: EthosColors.surfaceContainerLowest,
    borderRadius:    EthosRadius.lg,
    borderWidth:     EthosBorder.width,
    borderColor:     EthosBorder.color,
    paddingHorizontal: EthosSpacing.containerPadding,
  },
  listRow: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'space-between',
    paddingVertical: EthosSpacing.stackMd,
    borderBottomWidth: EthosBorder.width,
    borderBottomColor: EthosColors.secondaryContainer,
  },
  rowLabel: {
    ...EthosTypography.bodyMd,
    color: EthosColors.outline,
  },
  rowValue: {
    ...EthosTypography.bodyMd,
    color: EthosColors.onSurface,
  },
  pmValueWrap: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           6,
  },
  actionsRow: {
    flexDirection:  'row',
    justifyContent: 'center',
    alignItems:     'center',
    gap:            EthosSpacing.stackLg,
    marginTop:      EthosSpacing.unit,
  },
  actionBtn: {
    flexDirection:  'row',
    alignItems:     'center',
    gap:            EthosSpacing.unit,
    paddingVertical: EthosSpacing.stackSm,
    paddingHorizontal: EthosSpacing.stackMd,
  },
  actionBtnText: {
    ...EthosTypography.labelMd,
    color: EthosColors.onSurface,
  },
});
