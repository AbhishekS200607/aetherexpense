/**
 * AetherExpense — Ethos Recurring Transactions Screen
 *
 * Matches Stitch `recurring_transactions` visual source of truth:
 *   - Header with Avatar, Title "Recurring", Search, and Add button
 *   - Total Monthly Commits Hero Card (Total Outflows amount, Outflow count, Inflow count)
 *   - Active Subscriptions & Bills (Expense recurring rules) list card
 *   - Expected Income (Income recurring rules) list card
 *   - 100% offline SQLite data via Drizzle ORM
 */

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  RefreshControl,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSQLiteContext } from 'expo-sqlite';
import { eq } from 'drizzle-orm';

import { createDrizzleDB } from '@/database/client';
import { recurringTransactions, categories, accounts, transactions, bills } from '@/database/schema';
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
import { processRecurringTransactions } from '@/utils/recurring';
import { EmptyState } from '@/components/ui/EmptyState';

interface RecurringRuleItem {
  id:            string;
  type:          'income' | 'expense' | 'transfer';
  amount:        number;
  note:          string | null;
  merchant:      string | null;
  frequency:     string;
  next_run_date: string;
  is_active:     number;
  category_name: string;
  category_icon: string;
  category_color:string;
  account_name:  string;
}

export default function RecurringScreen() {
  const sqliteDb = useSQLiteContext();
  const currencyCode = useSettingsStore((s) => s.currency);
  const dataVersion = useAppStore((s) => s.dataVersion);

  const [rules, setRules] = useState<RecurringRuleItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchRecurringData = useCallback(async () => {
    if (!sqliteDb) {
      setLoading(false);
      setRefreshing(false);
      return;
    }
    try {
      const db = createDrizzleDB(sqliteDb);

      // Trigger due execution check first
      await processRecurringTransactions(db);

      const rows = await db
        .select({
          id:             recurringTransactions.id,
          type:           recurringTransactions.type,
          amount:         recurringTransactions.amount,
          note:           recurringTransactions.note,
          merchant:       recurringTransactions.merchant,
          frequency:      recurringTransactions.frequency,
          next_run_date:  recurringTransactions.next_run_date,
          is_active:      recurringTransactions.is_active,
          category_name:  categories.name,
          category_icon:  categories.icon,
          category_color: categories.color,
          account_name:   accounts.name,
        })
        .from(recurringTransactions)
        .leftJoin(categories, eq(recurringTransactions.category_id, categories.id))
        .leftJoin(accounts, eq(recurringTransactions.account_id, accounts.id));

      const items: RecurringRuleItem[] = rows.map((r) => ({
        id:             r.id,
        type:           r.type as any,
        amount:         r.amount,
        note:           r.note,
        merchant:       r.merchant,
        frequency:      r.frequency,
        next_run_date:  r.next_run_date,
        is_active:      r.is_active,
        category_name:  r.category_name || 'Uncategorized',
        category_icon:  r.category_icon || 'refresh-outline',
        category_color: r.category_color || EthosColors.primary,
        account_name:   r.account_name || 'Account',
      }));

      setRules(items);
    } catch (err) {
      console.error('[RecurringScreen] Error loading recurring rules:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [sqliteDb]);

  useEffect(() => {
    setLoading(true);
    fetchRecurringData();
  }, [dataVersion, fetchRecurringData]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchRecurringData();
  };

  const handleDeleteRule = (ruleId: string, ruleTitle: string) => {
    Alert.alert(
      'Delete Recurring Rule?',
      `Are you sure you want to delete "${ruleTitle}"? Past generated transactions will not be deleted.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            if (!sqliteDb) return;
            try {
              const db = createDrizzleDB(sqliteDb);
              await db
                .update(transactions)
                .set({ recurring_id: null })
                .where(eq(transactions.recurring_id, ruleId));

              await db
                .update(bills)
                .set({ recurring_id: null })
                .where(eq(bills.recurring_id, ruleId));

              await db.delete(recurringTransactions).where(eq(recurringTransactions.id, ruleId));

              fetchRecurringData();
              useAppStore.getState().invalidateData();
            } catch (err) {
              console.error('[RecurringScreen] Error deleting rule:', err);
              Alert.alert('Error', 'Could not delete recurring rule.');
            }
          },
        },
      ]
    );
  };

  // Group expense vs income rules
  const expenseRules = useMemo(
    () => rules.filter((r) => r.type === 'expense' && r.is_active === 1),
    [rules]
  );
  const incomeRules = useMemo(
    () => rules.filter((r) => r.type === 'income' && r.is_active === 1),
    [rules]
  );

  // Total monthly commit sum (normalizing weekly/yearly to monthly equivalent)
  const totalMonthlyOutflows = useMemo(() => {
    return expenseRules.reduce((sum, r) => {
      let monthlyAmt = r.amount;
      if (r.frequency === 'weekly') monthlyAmt = Math.round(r.amount * 4.3333);
      else if (r.frequency === 'yearly') monthlyAmt = Math.round(r.amount / 12);
      return sum + monthlyAmt;
    }, 0);
  }, [expenseRules]);

  // Format date helper: "YYYY-MM-DD" -> "Oct 15"
  const formatNextDate = (dateStr: string) => {
    if (!dateStr) return '';
    const parts = dateStr.split('-');
    if (parts.length < 3) return dateStr;
    const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* ─── Top Navbar Header ────────────────────────────────────────────── */}
      <View style={styles.navbar}>
        <View style={styles.navLeft}>
          <Pressable onPress={() => router.back()} style={styles.navBtn}>
            <Ionicons name="arrow-back" size={24} color={EthosColors.onSurface} />
          </Pressable>
          <Text style={styles.navTitle}>Recurring</Text>
        </View>

        <Pressable
          id="add-recurring-btn"
          onPress={() => router.push('/recurring/add' as any)}
          style={({ pressed }) => [styles.navBtn, pressed && { opacity: 0.7 }]}
          accessibilityLabel="Add Recurring Rule"
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
        {/* ─── Total Monthly Commits Hero Card ─────────────────────────────── */}
        <View style={styles.heroCard}>
          <Text style={styles.heroSubhead}>TOTAL MONTHLY COMMITS</Text>
          <Text style={styles.heroDisplayAmount}>
            {formatCurrency(totalMonthlyOutflows, currencyCode)}
          </Text>
          <View style={styles.badgeRow}>
            <View style={styles.outflowBadge}>
              <Text style={styles.outflowBadgeText}>
                {expenseRules.length} {expenseRules.length === 1 ? 'Outflow' : 'Outflows'}
              </Text>
            </View>
            <View style={styles.inflowBadge}>
              <Text style={styles.inflowBadgeText}>
                {incomeRules.length} {incomeRules.length === 1 ? 'Inflow' : 'Inflows'}
              </Text>
            </View>
          </View>
        </View>

        {/* ─── Active Subscriptions & Bills Section ────────────────────────── */}
        <View style={styles.sectionWrap}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Active Subscriptions & Bills</Text>
          </View>

          <View style={styles.bentoCardList}>
            {expenseRules.length === 0 ? (
              <EmptyState
                icon="refresh-outline"
                title="No active recurring bills"
                description="Set up recurring expenses like Netflix, Rent, or Utility bills."
                actionLabel="Add Recurring Bill"
                onAction={() => router.push('/recurring/add' as any)}
                style={{ paddingVertical: EthosSpacing.stackLg }}
              />
            ) : (
              expenseRules.map((item, index) => {
                const isLast = index === expenseRules.length - 1;
                const titleText = item.merchant || item.note || item.category_name;

                return (
                  <Pressable
                    key={item.id}
                    id={`recurring-item-${item.id}`}
                    onPress={() => router.push(`/recurring/edit/${item.id}` as any)}
                    style={({ pressed }) => [
                      styles.ruleRow,
                      !isLast && styles.rowBorderBottom,
                      pressed && { backgroundColor: EthosColors.surfaceContainerLow },
                    ]}
                  >
                    <View style={styles.ruleLeft}>
                      <View style={styles.iconChip}>
                        <Ionicons
                          name={(item.category_icon || 'receipt-outline') as any}
                          size={22}
                          color={EthosColors.primary}
                        />
                      </View>
                      <View style={{ gap: 2 }}>
                        <Text style={styles.ruleTitle}>{titleText}</Text>
                        <Text style={styles.ruleFrequency}>
                          {item.frequency.toUpperCase()}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.ruleRight}>
                      <View style={{ alignItems: 'flex-end' }}>
                        <Text style={styles.ruleAmount}>
                          {formatCurrency(item.amount, currencyCode)}
                        </Text>
                        <Text style={styles.ruleNextDate}>
                          Next: {formatNextDate(item.next_run_date)}
                        </Text>
                      </View>
                      <Pressable
                        onPress={() => handleDeleteRule(item.id, titleText)}
                        style={({ pressed }) => [{ padding: 6, marginLeft: 4 }, pressed && { opacity: 0.6 }]}
                        hitSlop={8}
                      >
                        <Ionicons name="trash-outline" size={18} color={EthosColors.outline} />
                      </Pressable>
                    </View>
                  </Pressable>
                );
              })
            )}
          </View>
        </View>

        {/* ─── Expected Income Section ────────────────────────────────────── */}
        <View style={styles.sectionWrap}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Expected Income</Text>
          </View>

          <View style={styles.bentoCardList}>
            {incomeRules.length === 0 ? (
              <EmptyState
                icon="cash-outline"
                title="No recurring income set"
                description="Set up recurring income like Monthly Salary or Freelance payments."
                actionLabel="Add Recurring Income"
                onAction={() => router.push('/recurring/add' as any)}
                style={{ paddingVertical: EthosSpacing.stackLg }}
              />
            ) : (
              incomeRules.map((item, index) => {
                const isLast = index === incomeRules.length - 1;
                const titleText = item.merchant || item.note || item.category_name;

                return (
                  <Pressable
                    key={item.id}
                    id={`recurring-item-${item.id}`}
                    onPress={() => router.push(`/recurring/edit/${item.id}` as any)}
                    style={({ pressed }) => [
                      styles.ruleRow,
                      !isLast && styles.rowBorderBottom,
                      pressed && { backgroundColor: EthosColors.surfaceContainerLow },
                    ]}
                  >
                    <View style={styles.ruleLeft}>
                      <View style={[styles.iconChip, { backgroundColor: '#E8F5E9' }]}>
                        <Ionicons
                          name={(item.category_icon || 'briefcase-outline') as any}
                          size={22}
                          color="#2E7D32"
                        />
                      </View>
                      <View style={{ gap: 2 }}>
                        <Text style={styles.ruleTitle}>{titleText}</Text>
                        <Text style={styles.ruleFrequency}>
                          {item.frequency.toUpperCase()}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.ruleRight}>
                      <View style={{ alignItems: 'flex-end' }}>
                        <Text style={[styles.ruleAmount, { color: '#2E7D32' }]}>
                          +{formatCurrency(item.amount, currencyCode)}
                        </Text>
                        <Text style={styles.ruleNextDate}>
                          Next: {formatNextDate(item.next_run_date)}
                        </Text>
                      </View>
                      <Pressable
                        onPress={() => handleDeleteRule(item.id, titleText)}
                        style={({ pressed }) => [{ padding: 6, marginLeft: 4 }, pressed && { opacity: 0.6 }]}
                        hitSlop={8}
                      >
                        <Ionicons name="trash-outline" size={18} color={EthosColors.outline} />
                      </Pressable>
                    </View>
                  </Pressable>
                );
              })
            )}
          </View>
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
  navLeft: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           EthosSpacing.stackSm,
  },
  navBtn: {
    padding: 4,
  },
  navTitle: {
    ...EthosTypography.headlineLg,
    color:      EthosColors.onSurface,
    fontWeight: '500',
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
  heroSubhead: {
    ...EthosTypography.labelSm,
    color:         EthosColors.outline,
    letterSpacing: 1.2,
  },
  heroDisplayAmount: {
    ...EthosTypography.displayLg,
    fontSize:    40,
    color:       EthosColors.primary,
    fontWeight:  '300',
    fontVariant: ['tabular-nums'],
  },
  badgeRow: {
    flexDirection: 'row',
    gap:           EthosSpacing.stackSm,
    marginTop:     4,
  },
  outflowBadge: {
    backgroundColor:   EthosColors.surfaceContainer,
    borderRadius:      EthosRadius.full,
    paddingHorizontal: EthosSpacing.stackSm + 2,
    paddingVertical:   3,
  },
  outflowBadgeText: {
    ...EthosTypography.labelSm,
    color: EthosColors.onSurface,
  },
  inflowBadge: {
    backgroundColor:   '#E8F5E9',
    borderRadius:      EthosRadius.full,
    paddingHorizontal: EthosSpacing.stackSm + 2,
    paddingVertical:   3,
  },
  inflowBadgeText: {
    ...EthosTypography.labelSm,
    color:      '#2E7D32',
    fontWeight: '600',
  },
  sectionWrap: {
    gap: EthosSpacing.stackMd,
  },
  sectionHeaderRow: {
    borderBottomWidth: EthosBorder.width,
    borderBottomColor: EthosBorder.color,
    paddingBottom:     EthosSpacing.unit,
  },
  sectionTitle: {
    ...EthosTypography.labelMd,
    color:         EthosColors.outline,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  bentoCardList: {
    backgroundColor: EthosColors.surfaceContainerLowest,
    borderRadius:    EthosRadius.lg,
    borderWidth:     EthosBorder.width,
    borderColor:     EthosBorder.color,
    overflow:        'hidden',
  },
  ruleRow: {
    flexDirection:     'row',
    alignItems:        'center',
    justifyContent:    'space-between',
    paddingHorizontal: EthosSpacing.containerPadding,
    paddingVertical:   EthosSpacing.stackMd,
  },
  rowBorderBottom: {
    borderBottomWidth: EthosBorder.width,
    borderBottomColor: EthosBorder.color,
  },
  ruleLeft: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           EthosSpacing.stackMd,
    flex:          1,
  },
  iconChip: {
    width:           48,
    height:          48,
    borderRadius:    EthosRadius.md,
    backgroundColor: EthosColors.surfaceContainer,
    alignItems:      'center',
    justifyContent:  'center',
  },
  ruleTitle: {
    ...EthosTypography.bodyMd,
    fontWeight: '500',
    color:      EthosColors.primary,
  },
  ruleFrequency: {
    ...EthosTypography.labelSm,
    color:         EthosColors.outline,
    letterSpacing: 1,
  },
  ruleRight: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           4,
  },
  ruleAmount: {
    ...EthosTypography.bodyMd,
    fontWeight:  '500',
    color:       EthosColors.primary,
    fontVariant: ['tabular-nums'],
  },
  ruleNextDate: {
    ...EthosTypography.labelSm,
    color: EthosColors.outline,
  },
});
