/**
 * AetherExpense — Ethos Accounts & Wallets Screen
 *
 * Lists all active & archived accounts with real-time current balance computation.
 * Features:
 *   - Net worth / Total balance hero card across accounts
 *   - Accounts grouped by type (Cash, Bank, UPI, Credit Card, etc.)
 *   - Current balance = opening_balance + income - expense + transfer_in - transfer_out
 *   - Active / Archived filter tabs
 *   - Add Account & Transfer Money quick actions
 *   - 100% local SQLite queries via Drizzle ORM
 */

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSQLiteContext } from 'expo-sqlite';
import { eq, desc } from 'drizzle-orm';

import { createDrizzleDB } from '@/database/client';
import { accounts, transactions } from '@/database/schema';
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
import type { AccountRow } from '@/database/schema';
import { EmptyState } from '@/components/ui/EmptyState';

export default function AccountsScreen() {
  const sqliteDb = useSQLiteContext();
  const currencyCode = useSettingsStore((s) => s.currency);
  const dataVersion = useAppStore((s) => s.dataVersion);

  const [accountRows, setAccountRows] = useState<AccountRow[]>([]);
  const [txnList, setTxnList] = useState<TxnSummaryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'active' | 'archived'>('active');

  const fetchAccountData = useCallback(async () => {
    try {
      const db = createDrizzleDB(sqliteDb);

      // Query all accounts
      const accs = await db
        .select()
        .from(accounts)
        .orderBy(accounts.sort_order, desc(accounts.created_at));

      setAccountRows(accs);

      // Query all transactions for balance calculation
      const txs = await db
        .select({
          id:                     transactions.id,
          type:                   transactions.type,
          amount:                 transactions.amount,
          account_id:             transactions.account_id,
          transfer_to_account_id: transactions.transfer_to_account_id,
        })
        .from(transactions);

      setTxnList(txs as TxnSummaryItem[]);
    } catch (err) {
      console.error('[AccountsScreen] Error fetching accounts:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [sqliteDb]);

  useEffect(() => {
    setLoading(true);
    fetchAccountData();
  }, [dataVersion, fetchAccountData]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchAccountData();
  };

  // Compute balance for each account
  const computedAccounts = useMemo(() => {
    return accountRows.map((acc) => {
      const currentBalance = calculateAccountBalance(
        acc.opening_balance,
        acc.id,
        txnList
      );
      return {
        ...acc,
        currentBalance,
      };
    });
  }, [accountRows, txnList]);

  // Filter active vs archived
  const filteredAccounts = useMemo(() => {
    const isActiveVal = activeTab === 'active' ? 1 : 0;
    return computedAccounts.filter((a) => a.is_active === isActiveVal);
  }, [computedAccounts, activeTab]);

  // Net worth total across active accounts
  const totalNetWorth = useMemo(() => {
    return computedAccounts
      .filter((a) => a.is_active === 1)
      .reduce((sum, a) => sum + a.currentBalance, 0);
  }, [computedAccounts]);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* ─── Top Header ─────────────────────────────────────────────────── */}
      <View style={styles.navbar}>
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [styles.navBtn, pressed && { opacity: 0.7 }]}
          accessibilityLabel="Back"
        >
          <Ionicons name="arrow-back" size={24} color={EthosColors.onSurface} />
        </Pressable>
        <Text style={styles.navTitle}>Accounts & Wallets</Text>
        <Pressable
          onPress={() => router.push('/accounts/add')}
          style={({ pressed }) => [styles.navBtn, pressed && { opacity: 0.7 }]}
          accessibilityLabel="Add Account"
        >
          <Ionicons name="add" size={26} color={EthosColors.onSurface} />
        </Pressable>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={EthosColors.primary}
            colors={[EthosColors.primary]}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* ─── Net Worth Hero Card ────────────────────────────────────────── */}
        <View style={styles.heroCard}>
          <Text style={styles.heroSublabel}>TOTAL ACCOUNTS BALANCE</Text>
          <Text style={styles.heroAmount}>
            {formatCurrency(totalNetWorth, currencyCode)}
          </Text>

          {/* Quick Actions Row */}
          <View style={styles.heroActionsRow}>
            <Pressable
              id="quick-add-account-btn"
              onPress={() => router.push('/accounts/add')}
              style={({ pressed }) => [styles.heroActionBtn, pressed && { opacity: 0.8 }]}
            >
              <Ionicons name="add-circle-outline" size={18} color={EthosColors.onPrimary} />
              <Text style={styles.heroActionBtnText}>Add Account</Text>
            </Pressable>

            <Pressable
              id="quick-transfer-btn"
              onPress={() => router.push('/transaction/transfer')}
              style={({ pressed }) => [styles.heroActionBtn, pressed && { opacity: 0.8 }]}
            >
              <Ionicons name="swap-horizontal-outline" size={18} color={EthosColors.onPrimary} />
              <Text style={styles.heroActionBtnText}>Transfer</Text>
            </Pressable>
          </View>
        </View>

        {/* ─── Segmented Tabs (Active / Archived) ────────────────────────── */}
        <View style={styles.tabBarContainer}>
          <Pressable
            onPress={() => setActiveTab('active')}
            style={[styles.tabBtn, activeTab === 'active' && styles.tabBtnActive]}
          >
            <Text style={[styles.tabText, activeTab === 'active' && styles.tabTextActive]}>
              Active ({computedAccounts.filter((a) => a.is_active === 1).length})
            </Text>
          </Pressable>

          <Pressable
            onPress={() => setActiveTab('archived')}
            style={[styles.tabBtn, activeTab === 'archived' && styles.tabBtnActive]}
          >
            <Text style={[styles.tabText, activeTab === 'archived' && styles.tabTextActive]}>
              Archived ({computedAccounts.filter((a) => a.is_active === 0).length})
            </Text>
          </Pressable>
        </View>

        {/* ─── Account Bento Cards List ────────────────────────────────────── */}
        <View style={styles.accountsList}>
          {filteredAccounts.length === 0 ? (
            <EmptyState
              icon="wallet-outline"
              title={activeTab === 'active' ? 'No active accounts' : 'No archived accounts'}
              description={
                activeTab === 'active'
                  ? 'Create your first cash wallet, bank account, or UPI account to start tracking.'
                  : 'Archived accounts will appear here.'
              }
              actionLabel={activeTab === 'active' ? 'Add Account / Wallet' : undefined}
              onAction={activeTab === 'active' ? () => router.push('/accounts/add') : undefined}
            />
          ) : (
            filteredAccounts.map((acc) => {
              const cfg = ACCOUNT_TYPE_CONFIG[acc.type] || ACCOUNT_TYPE_CONFIG.cash;

              return (
                <Pressable
                  key={acc.id}
                  id={`account-card-${acc.id}`}
                  onPress={() => router.push(`/accounts/${acc.id}` as any)}
                  style={({ pressed }) => [
                    styles.accountCard,
                    pressed && { opacity: 0.9, backgroundColor: EthosColors.surfaceContainerLow },
                  ]}
                >
                  {/* Left Icon Wrap */}
                  <View style={[styles.iconWrap, { backgroundColor: `${acc.color}15` }]}>
                    <Ionicons name={(acc.icon || cfg.defaultIcon) as any} size={22} color={acc.color} />
                  </View>

                  {/* Body Text */}
                  <View style={styles.cardBody}>
                    <Text style={styles.accountName} numberOfLines={1}>
                      {acc.name}
                    </Text>
                    <Text style={styles.accountTypeLabel}>
                      {cfg.label}
                      {acc.opening_balance !== 0 && (
                        ` · Open: ${formatCurrency(acc.opening_balance, currencyCode)}`
                      )}
                    </Text>
                  </View>

                  {/* Right Balance */}
                  <View style={styles.cardRight}>
                    <Text style={styles.accountBalanceText}>
                      {formatCurrency(acc.currentBalance, currencyCode)}
                    </Text>
                    <Ionicons name="chevron-forward" size={16} color={EthosColors.outline} />
                  </View>
                </Pressable>
              );
            })
          )}
        </View>
      </ScrollView>
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
  },
  scrollContent: {
    paddingHorizontal: EthosSpacing.containerPadding,
    paddingTop:        EthosSpacing.stackLg,
    paddingBottom:     96,
    gap:               EthosSpacing.stackLg,
  },
  heroCard: {
    backgroundColor: EthosColors.primary,
    borderRadius:    EthosRadius.lg,
    padding:         EthosSpacing.containerPadding,
    gap:             EthosSpacing.unit,
  },
  heroSublabel: {
    ...EthosTypography.labelSm,
    color:         'rgba(255,255,255,0.7)',
    letterSpacing: EthosTypography.labelSm.letterSpacing,
  },
  heroAmount: {
    ...EthosTypography.displayLg,
    fontSize: 44,
    color:    '#ffffff',
    fontVariant: ['tabular-nums'],
  },
  heroActionsRow: {
    flexDirection: 'row',
    gap:           EthosSpacing.gutter,
    marginTop:     EthosSpacing.unit,
  },
  heroActionBtn: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           6,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius:    EthosRadius.full,
    paddingHorizontal: EthosSpacing.stackMd,
    paddingVertical:   8,
  },
  heroActionBtnText: {
    ...EthosTypography.labelMd,
    color: '#ffffff',
  },
  tabBarContainer: {
    flexDirection:   'row',
    backgroundColor: EthosColors.surfaceContainerHigh,
    borderRadius:    EthosRadius.full,
    padding:         4,
  },
  tabBtn: {
    flex:            1,
    paddingVertical: EthosSpacing.unit,
    borderRadius:    EthosRadius.full,
    alignItems:      'center',
    justifyContent:  'center',
  },
  tabBtnActive: {
    backgroundColor: EthosColors.surfaceContainerLowest,
    shadowColor:     '#000',
    shadowOffset:    { width: 0, height: 1 },
    shadowOpacity:   0.1,
    shadowRadius:    2,
    elevation:       2,
  },
  tabText: {
    ...EthosTypography.labelMd,
    color: EthosColors.outline,
  },
  tabTextActive: {
    color: EthosColors.primary,
    fontWeight: '600',
  },
  accountsList: {
    gap: EthosSpacing.stackMd,
  },
  accountCard: {
    flexDirection:     'row',
    alignItems:        'center',
    backgroundColor:   EthosColors.surfaceContainerLowest,
    borderRadius:      EthosRadius.lg,
    borderWidth:       EthosBorder.width,
    borderColor:       EthosBorder.color,
    padding:           EthosSpacing.containerPadding,
    gap:               EthosSpacing.gutter,
  },
  iconWrap: {
    width:           44,
    height:          44,
    borderRadius:    EthosRadius.full,
    alignItems:      'center',
    justifyContent:  'center',
  },
  cardBody: {
    flex: 1,
    gap:  2,
  },
  accountName: {
    ...EthosTypography.bodyMd,
    fontWeight: '500',
    color:      EthosColors.onSurface,
  },
  accountTypeLabel: {
    ...EthosTypography.labelSm,
    color: EthosColors.outline,
  },
  cardRight: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           6,
  },
  accountBalanceText: {
    ...EthosTypography.bodyMd,
    fontWeight: '600',
    color:      EthosColors.onSurface,
    fontVariant: ['tabular-nums'],
  },
});
