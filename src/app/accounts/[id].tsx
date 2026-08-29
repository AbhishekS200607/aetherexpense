/**
 * AetherExpense — Ethos Account Details & History Screen
 *
 * Displays:
 *   - Account current balance hero card
 *   - Opening balance & details
 *   - Full transaction history filtered for this specific account
 *   - Edit & Transfer action buttons
 */

import React, { useEffect, useState, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  Pressable,
  StyleSheet,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSQLiteContext } from 'expo-sqlite';
import { eq, or, desc } from 'drizzle-orm';

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
import { formatCurrency } from '@/utils/currency';
import {
  calculateAccountBalance,
  ACCOUNT_TYPE_CONFIG,
  type TxnSummaryItem,
} from '@/utils/accounts';
import { TransactionRow } from '@/components/ethos/TransactionRow';
import { EmptyState } from '@/components/ui/EmptyState';
import type { AccountRow } from '@/database/schema';

interface AccTxnItem {
  id:                     string;
  type:                   'income' | 'expense' | 'transfer';
  amount:                 number;
  date:                   string;
  time:                   string;
  note:                   string | null;
  merchant:               string | null;
  account_id:             string | null;
  transfer_to_account_id: string | null;
  category_name:          string;
  category_icon:          string;
  category_color:         string;
}

export default function AccountDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const sqliteDb = useSQLiteContext();
  const currencyCode = useSettingsStore((s) => s.currency);
  const dataVersion = useAppStore((s) => s.dataVersion);

  const [account, setAccount] = useState<AccountRow | null>(null);
  const [allTxns, setAllTxns] = useState<TxnSummaryItem[]>([]);
  const [accountTxns, setAccountTxns] = useState<AccTxnItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchAccount = async () => {
    if (!id) return;
    try {
      const db = createDrizzleDB(sqliteDb);

      // Query account details
      const [acc] = await db
        .select()
        .from(accounts)
        .where(eq(accounts.id, id))
        .limit(1);

      if (acc) setAccount(acc);

      // Query all transactions for accurate total current balance calculation
      const txs = await db
        .select({
          id:                     transactions.id,
          type:                   transactions.type,
          amount:                 transactions.amount,
          account_id:             transactions.account_id,
          transfer_to_account_id: transactions.transfer_to_account_id,
        })
        .from(transactions);

      setAllTxns(txs as TxnSummaryItem[]);

      // Query transactions specific to this account
      const specificTxns = await db
        .select({
          id:                     transactions.id,
          type:                   transactions.type,
          amount:                 transactions.amount,
          date:                   transactions.date,
          time:                   transactions.time,
          note:                   transactions.note,
          merchant:               transactions.merchant,
          account_id:             transactions.account_id,
          transfer_to_account_id: transactions.transfer_to_account_id,
          category_name:          categories.name,
          category_icon:          categories.icon,
          category_color:         categories.color,
        })
        .from(transactions)
        .innerJoin(categories, eq(transactions.category_id, categories.id))
        .where(
          or(
            eq(transactions.account_id, id),
            eq(transactions.transfer_to_account_id, id)
          )
        )
        .orderBy(desc(transactions.date), desc(transactions.created_at));

      setAccountTxns(specificTxns as AccTxnItem[]);
    } catch (err) {
      console.error('[AccountDetailScreen] Error:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchAccount();
  }, [id, dataVersion, sqliteDb]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchAccount();
  };

  const currentBalance = useMemo(() => {
    if (!account || !id) return 0;
    return calculateAccountBalance(account.opening_balance, id, allTxns);
  }, [account, id, allTxns]);

  if (!account) return null;

  const cfg = ACCOUNT_TYPE_CONFIG[account.type] || ACCOUNT_TYPE_CONFIG.cash;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Navbar */}
      <View style={styles.navbar}>
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [styles.navBtn, pressed && { opacity: 0.7 }]}
          accessibilityLabel="Back"
        >
          <Ionicons name="arrow-back" size={24} color={EthosColors.onSurface} />
        </Pressable>
        <Text style={styles.navTitle} numberOfLines={1}>
          {account.name}
        </Text>
        <Pressable
          onPress={() => router.push(`/accounts/edit/${id}` as any)}
          style={({ pressed }) => [styles.navBtn, pressed && { opacity: 0.7 }]}
          accessibilityLabel="Edit Account"
        >
          <Ionicons name="create-outline" size={22} color={EthosColors.onSurface} />
        </Pressable>
      </View>

      <FlatList
        data={accountTxns}
        keyExtractor={(item) => item.id}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={EthosColors.primary}
            colors={[EthosColors.primary]}
          />
        }
        ListHeaderComponent={
          <View style={styles.headerComponent}>
            {/* Account Hero Card */}
            <View style={[styles.heroCard, { backgroundColor: account.color }]}>
              <View style={styles.heroTopRow}>
                <Ionicons
                  name={(account.icon || cfg.defaultIcon) as any}
                  size={28}
                  color="#ffffff"
                />
                <Text style={styles.typeBadgeText}>{cfg.label}</Text>
              </View>

              <Text style={styles.heroSublabel}>CURRENT BALANCE</Text>
              <Text style={styles.heroAmount}>
                {formatCurrency(currentBalance, currencyCode)}
              </Text>

              <Text style={styles.openingText}>
                Opening Balance: {formatCurrency(account.opening_balance, currencyCode)}
              </Text>

              {/* Action Buttons */}
              <View style={styles.actionsRow}>
                <Pressable
                  onPress={() => router.push(`/accounts/edit/${id}` as any)}
                  style={styles.actionBtn}
                >
                  <Ionicons name="pencil" size={16} color="#ffffff" />
                  <Text style={styles.actionBtnText}>Edit Account</Text>
                </Pressable>

                <Pressable
                  onPress={() => router.push('/transaction/transfer')}
                  style={styles.actionBtn}
                >
                  <Ionicons name="swap-horizontal" size={16} color="#ffffff" />
                  <Text style={styles.actionBtnText}>Transfer</Text>
                </Pressable>
              </View>
            </View>

            <Text style={styles.sectionHeaderTitle}>ACCOUNT HISTORY</Text>
          </View>
        }
        renderItem={({ item, index }) => {
          // Determine if amount is positive (income or transfer into this account)
          const isTransferIn = item.type === 'transfer' && item.transfer_to_account_id === id;
          const isIncome = item.type === 'income' || isTransferIn;
          const isTransferOut = item.type === 'transfer' && item.account_id === id;

          let formattedAmount = `${isIncome ? '+' : '-'}${formatCurrency(
            item.amount,
            currencyCode
          )}`;

          let displayLabel = item.merchant || item.note || item.category_name;
          if (item.type === 'transfer') {
            displayLabel = isTransferIn ? 'Transfer In' : 'Transfer Out';
          }

          const isLast = index === accountTxns.length - 1;

          return (
            <TransactionRow
              id={item.id}
              label={displayLabel}
              subLabel={`${item.category_name} · ${item.date}`}
              amount={formattedAmount}
              isIncome={isIncome}
              icon={item.category_icon || (isIncome ? 'arrow-down' : 'restaurant')}
              iconColor={item.category_color}
              isLast={isLast}
              onPress={() => router.push(`/transaction/${item.id}`)}
            />
          );
        }}
        ListEmptyComponent={
          loading ? null : (
            <EmptyState
              icon="receipt-outline"
              title="No transactions for this account"
              description="Transactions linked to this account will appear here."
              style={{ paddingVertical: EthosSpacing.stackLg }}
            />
          )
        }
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
    padding: 4,
  },
  navTitle: {
    ...EthosTypography.headlineLg,
    color: EthosColors.onSurface,
    fontWeight: '500',
    maxWidth: '70%',
  },
  listContent: {
    paddingBottom: 96,
  },
  headerComponent: {
    paddingHorizontal: EthosSpacing.containerPadding,
    paddingTop: EthosSpacing.stackLg,
    paddingBottom: EthosSpacing.stackMd,
    gap: EthosSpacing.stackLg,
  },
  heroCard: {
    borderRadius: EthosRadius.lg,
    padding: EthosSpacing.containerPadding,
    gap: EthosSpacing.unit,
  },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  typeBadgeText: {
    ...EthosTypography.labelSm,
    color: 'rgba(255,255,255,0.85)',
    backgroundColor: 'rgba(0,0,0,0.2)',
    paddingHorizontal: EthosSpacing.stackMd,
    paddingVertical: 4,
    borderRadius: EthosRadius.full,
  },
  heroSublabel: {
    ...EthosTypography.labelSm,
    color: 'rgba(255,255,255,0.75)',
    letterSpacing: EthosTypography.labelSm.letterSpacing,
  },
  heroAmount: {
    ...EthosTypography.displayLg,
    fontSize: 40,
    color: '#ffffff',
    fontVariant: ['tabular-nums'],
  },
  openingText: {
    ...EthosTypography.labelSm,
    color: 'rgba(255,255,255,0.8)',
  },
  actionsRow: {
    flexDirection: 'row',
    gap: EthosSpacing.gutter,
    marginTop: EthosSpacing.unit,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: EthosRadius.full,
    paddingHorizontal: EthosSpacing.stackMd,
    paddingVertical: 8,
  },
  actionBtnText: {
    ...EthosTypography.labelMd,
    color: '#ffffff',
  },
  sectionHeaderTitle: {
    ...EthosTypography.labelSm,
    color: EthosColors.outline,
    letterSpacing: EthosTypography.labelSm.letterSpacing,
  },
});
