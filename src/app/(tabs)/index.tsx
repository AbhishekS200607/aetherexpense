/**
 * AetherExpense — Ethos Home / Dashboard Screen
 *
 * Implements the Stitch `home_dashboard` visual source of truth.
 * Swiss-inspired minimalism with off-white background, near-black hero
 * balance numbers, Inter typography scale, and 8px vertical rhythm.
 *
 * Powered by Drizzle ORM + Expo SQLite architecture.
 */

import React, { useEffect, useState } from 'react';
import {
  ScrollView,
  View,
  Text,
  StyleSheet,
  RefreshControl,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSQLiteContext } from 'expo-sqlite';

import { createDrizzleDB } from '@/database/client';
import { transactions, categories, budgets } from '@/database/schema';
import { useSettingsStore } from '@/store/settingsStore';
import { useAppStore } from '@/store/appStore';
import {
  EthosColors,
  EthosTypography,
  EthosSpacing,
  EthosRadius,
  EthosBorder,
  EthosShadow,
} from '@/theme/ethos';
import { formatCurrency } from '@/utils/currency';
import { currentMonthRange } from '@/utils/dates';
import { computeBalance } from '@/utils/calculations';
import { MetricCard } from '@/components/ethos/MetricCard';
import { SpendingProgress } from '@/components/ethos/SpendingProgress';
import { TransactionRow } from '@/components/ethos/TransactionRow';
import { Skeleton, TransactionItemSkeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { eq, desc, gte, lte, and, sql } from 'drizzle-orm';

interface DashboardData {
  totalIncome:        number;
  totalExpense:       number;
  balance:            number;
  savings:            number;
  monthlyBudgetLimit: number;
  recentTxns: Array<{
    id:             string;
    type:           'income' | 'expense' | 'transfer';
    amount:         number;
    date:           string;
    note:           string | null;
    merchant:       string | null;
    category_name:  string;
    category_icon:  string;
    category_color: string;
  }>;
  topCategories: Array<{
    category_name:  string;
    category_icon:  string;
    category_color: string;
    total:          number;
  }>;
}

export default function DashboardScreen() {
  const sqliteDb = useSQLiteContext();
  const currencyCode = useSettingsStore((s) => s.currency);
  const dataVersion = useAppStore((s) => s.dataVersion);

  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const dbReady = useAppStore((s) => s.dbReady);

  const fetchData = async () => {
    if (!useAppStore.getState().dbReady) return;
    try {
      const db = createDrizzleDB(sqliteDb);
      const { from, to } = currentMonthRange();

      // Monthly income total (in minor units)
      const incomeResult = await db
        .select({ total: sql<number>`SUM(amount)` })
        .from(transactions)
        .where(
          and(
            eq(transactions.type, 'income'),
            gte(transactions.date, from),
            lte(transactions.date, to)
          )
        );
      const totalIncome = Number(incomeResult[0]?.total ?? 0);

      // Monthly expense total (in minor units)
      const expenseResult = await db
        .select({ total: sql<number>`SUM(amount)` })
        .from(transactions)
        .where(
          and(
            eq(transactions.type, 'expense'),
            gte(transactions.date, from),
            lte(transactions.date, to)
          )
        );
      const totalExpense = Number(expenseResult[0]?.total ?? 0);

      // Active monthly budget limit (sum of active budgets or fallback)
      const budgetRows = await db
        .select({ amount: budgets.amount })
        .from(budgets)
        .where(eq(budgets.is_active, 1));

      const monthlyBudgetLimit = budgetRows.length > 0
        ? budgetRows.reduce((acc, b) => acc + Number(b.amount), 0)
        : 1500000; // Default ₹15,000 fallback if no budget defined

      // Recent transactions
      const recentRaw = await db
        .select({
          id:             transactions.id,
          type:           transactions.type,
          amount:         transactions.amount,
          date:           transactions.date,
          note:           transactions.note,
          merchant:       transactions.merchant,
          category_name:  categories.name,
          category_icon:  categories.icon,
          category_color: categories.color,
        })
        .from(transactions)
        .innerJoin(categories, eq(transactions.category_id, categories.id))
        .orderBy(desc(transactions.date), desc(transactions.created_at))
        .limit(6);

      // Category spending breakdown for current month
      const topCatsRaw = await db
        .select({
          category_name:  categories.name,
          category_icon:  categories.icon,
          category_color: categories.color,
          total:          sql<number>`SUM(${transactions.amount})`,
        })
        .from(transactions)
        .innerJoin(categories, eq(transactions.category_id, categories.id))
        .where(
          and(
            eq(transactions.type, 'expense'),
            gte(transactions.date, from),
            lte(transactions.date, to)
          )
        )
        .groupBy(categories.id)
        .orderBy(desc(sql`SUM(${transactions.amount})`))
        .limit(4);

      const netBalance = computeBalance(totalIncome, totalExpense);

      setData({
        totalIncome,
        totalExpense,
        balance: netBalance,
        savings: Math.max(0, netBalance),
        monthlyBudgetLimit,
        recentTxns: recentRaw as any,
        topCategories: topCatsRaw.map((c) => ({
          category_name:  c.category_name,
          category_icon:  c.category_icon,
          category_color: c.category_color,
          total:          Number(c.total ?? 0),
        })),
      });
    } catch (err) {
      console.error('[Dashboard] Error fetching data:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (!dbReady) return;
    setLoading(true);
    fetchData();
  }, [dataVersion, dbReady]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  // Helper to split amount string into integer part and decimal part
  // e.g. "₹24,850.00" -> { integerPart: "₹24,850", decimalPart: ".00" }
  const getFormattedBalanceParts = (amount: number) => {
    const formatted = formatCurrency(amount, currencyCode);
    const lastDotOrComma = formatted.lastIndexOf('.');
    if (lastDotOrComma !== -1) {
      return {
        integerPart: formatted.substring(0, lastDotOrComma),
        decimalPart: formatted.substring(lastDotOrComma),
      };
    }
    return { integerPart: formatted, decimalPart: '' };
  };

  const balanceParts = getFormattedBalanceParts(data?.balance ?? 0);
  const spendingFraction = data?.monthlyBudgetLimit
    ? (data.totalExpense / data.monthlyBudgetLimit)
    : 0;

  // Format greeting header date string
  const today = new Date();
  const dateString = today.toLocaleDateString('en-GB', { day: 'numeric', month: 'long' });
  const hour = today.getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* ─── Top Navigation Header ────────────────────────────────────────── */}
      <View style={styles.navbar}>
        <View style={styles.navLeft}>
          <View style={styles.avatarWrap}>
            <Ionicons name="person-outline" size={16} color={EthosColors.onSurface} />
          </View>
          <Text style={styles.navTitle}>Overview</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Pressable
            onPress={() => router.push('/scan' as any)}
            style={({ pressed }) => [styles.navIconButton, pressed && { opacity: 0.7 }]}
            accessibilityLabel="Smart Scan Receipt or UPI"
          >
            <Ionicons name="camera-outline" size={22} color={EthosColors.primary} />
          </Pressable>
          <Pressable
            onPress={() => router.push('/transactions')}
            style={({ pressed }) => [styles.navIconButton, pressed && { opacity: 0.7 }]}
            accessibilityLabel="Search transactions"
          >
            <Ionicons name="search-outline" size={22} color={EthosColors.onSurface} />
          </Pressable>
        </View>
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
        {/* ─── Balance Hero Section ────────────────────────────────────── */}
        <View style={styles.heroSection}>
          <Text style={styles.greetingText}>
            {greeting} • {dateString}
          </Text>

          <View style={styles.balanceWrap}>
            {loading ? (
              <Skeleton width={220} height={56} style={{ marginVertical: EthosSpacing.unit }} />
            ) : (
              <Text style={styles.balanceText}>
                {balanceParts.integerPart}
                <Text style={styles.balanceDecimalText}>{balanceParts.decimalPart}</Text>
              </Text>
            )}
            <Text style={styles.balanceLabel}>AVAILABLE BALANCE</Text>
          </View>
        </View>

        {/* ─── Metrics Grid (Income / Expenses / Savings) ──────────────── */}
        <View style={styles.metricsSection}>
          <View style={styles.metricsRow}>
            <MetricCard
              label="INCOME"
              value={loading ? '...' : formatCurrency(data?.totalIncome ?? 0, currencyCode)}
              icon="arrow-down"
            />
            <MetricCard
              label="EXPENSES"
              value={loading ? '...' : formatCurrency(data?.totalExpense ?? 0, currencyCode)}
              icon="arrow-up"
            />
          </View>
          <View style={styles.metricsRow}>
            <MetricCard
              label="SAVINGS"
              value={loading ? '...' : formatCurrency(data?.savings ?? 0, currencyCode)}
              icon="wallet-outline"
              style={{ flex: 1 }}
            />
          </View>
        </View>

        {/* ─── Spending Progress ───────────────────────────────────────── */}
        <SpendingProgress
          spent={loading ? '...' : formatCurrency(data?.totalExpense ?? 0, currencyCode)}
          budget={loading ? '...' : formatCurrency(data?.monthlyBudgetLimit ?? 0, currencyCode)}
          fraction={spendingFraction}
          isOverBudget={spendingFraction > 1}
        />

        {/* ─── Compact AI Financial Insight Card ─────────────────────── */}
        <Pressable
          onPress={() => router.push('/assistant')}
          style={({ pressed }) => [styles.insightBanner, pressed && { opacity: 0.9 }]}
        >
          <View style={styles.insightIconChip}>
            <Ionicons name="sparkles" size={18} color={EthosColors.primary} />
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={styles.insightBannerTitle}>FINANCIAL INSIGHT</Text>
            <Text style={styles.insightBannerText}>
              {spendingFraction > 0.8
                ? `You've spent ${(spendingFraction * 100).toFixed(0)}% of your monthly budget limit. Tap for recommendations.`
                : `You are on track to save ${formatCurrency(data?.savings ?? 0, currencyCode)} this month. Tap for AI Assistant.`}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={EthosColors.outline} />
        </Pressable>

        {/* ─── Category Overview ────────────────────────────────────────── */}
        {data && data.topCategories.length > 0 && (
          <View style={styles.recentSection}>
            <View style={styles.recentHeader}>
              <Text style={styles.recentTitle}>CATEGORY OVERVIEW</Text>
              <Pressable
                onPress={() => router.push('/categories')}
                accessibilityLabel="Manage categories"
              >
                <Text style={styles.seeAllText}>Manage</Text>
              </Pressable>
            </View>

            <View style={styles.transactionsCard}>
              {data.topCategories.map((cat, idx) => {
                const isLast = idx === data.topCategories.length - 1;
                return (
                  <View
                    key={cat.category_name}
                    style={[
                      styles.dashCatRow,
                      !isLast && styles.dashCatRowBorder,
                    ]}
                  >
                    <View style={[styles.dashIconWrap, { backgroundColor: `${cat.category_color}15` }]}>
                      <Ionicons
                        name={(cat.category_icon || 'restaurant') as any}
                        size={18}
                        color={cat.category_color}
                      />
                    </View>
                    <Text style={styles.dashCatName}>{cat.category_name}</Text>
                    <Text style={styles.dashCatAmount}>
                      {formatCurrency(cat.total, currencyCode)}
                    </Text>
                  </View>
                );
              })}
            </View>
          </View>
        )}

        {/* ─── Recent Transactions ─────────────────────────────────────── */}
        <View style={styles.recentSection}>
          <View style={styles.recentHeader}>
            <Text style={styles.recentTitle}>RECENT TRANSACTIONS</Text>
            <Pressable
              onPress={() => router.push('/transactions')}
              accessibilityLabel="See all transactions"
            >
              <Text style={styles.seeAllText}>See all</Text>
            </Pressable>
          </View>

          <View style={styles.transactionsCard}>
            {loading ? (
              <>
                <TransactionItemSkeleton />
                <TransactionItemSkeleton />
                <TransactionItemSkeleton />
              </>
            ) : !data || data.recentTxns.length === 0 ? (
              <EmptyState
                icon="receipt-outline"
                title="No transactions yet"
                description="Tap the + button to add your first transaction."
                style={{ paddingVertical: EthosSpacing.stackLg }}
              />
            ) : (
              data.recentTxns.map((txn, index) => {
                const isIncome = txn.type === 'income';
                const formattedAmount = `${isIncome ? '+' : '-'}${formatCurrency(
                  txn.amount,
                  currencyCode
                )}`;
                const isLast = index === data.recentTxns.length - 1;

                return (
                  <TransactionRow
                    key={txn.id}
                    id={txn.id}
                    label={txn.merchant || txn.note || txn.category_name}
                    subLabel={txn.category_name}
                    amount={formattedAmount}
                    isIncome={isIncome}
                    icon={txn.category_icon || (isIncome ? 'arrow-down' : 'restaurant')}
                    iconColor={txn.category_color}
                    isLast={isLast}
                    onPress={() => router.push(`/transaction/${txn.id}`)}
                  />
                );
              })
            )}
          </View>
        </View>
      </ScrollView>

      {/* ─── Floating Action Button (+) ──────────────────────────────────── */}
      <Pressable
        id="fab-add-transaction"
        onPress={() => router.push({ pathname: '/transaction/add', params: { type: 'expense' } })}
        style={({ pressed }) => [
          styles.fab,
          pressed && { transform: [{ scale: 0.95 }], opacity: 0.9 },
        ]}
        accessibilityLabel="Add transaction"
      >
        <Ionicons name="add" size={28} color={EthosColors.fabForeground} />
      </Pressable>
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
    gap:           EthosSpacing.unit,
  },
  avatarWrap: {
    width:           32,
    height:          32,
    borderRadius:    EthosRadius.full,
    backgroundColor: EthosColors.secondaryContainer,
    borderWidth:     EthosBorder.width,
    borderColor:     EthosBorder.color,
    alignItems:      'center',
    justifyContent:  'center',
  },
  navTitle: {
    ...EthosTypography.headlineLg,
    color: EthosColors.onSurface,
  },
  navIconButton: {
    padding: 4,
  },
  scrollContent: {
    paddingHorizontal: EthosSpacing.containerPadding,
    paddingTop:        EthosSpacing.stackLg,
    paddingBottom:     96, // extra space for tab bar & FAB
    gap:               EthosSpacing.stackLg,
  },
  heroSection: {
    gap: EthosSpacing.unit,
  },
  greetingText: {
    ...EthosTypography.labelMd,
    color: EthosColors.outline,
  },
  balanceWrap: {
    gap: 4,
    marginTop: 4,
  },
  balanceText: {
    ...EthosTypography.displayLg,
    color:       EthosColors.onSurface,
    fontVariant: ['tabular-nums'],
  },
  balanceDecimalText: {
    color: EthosColors.outline,
  },
  balanceLabel: {
    ...EthosTypography.labelSm,
    color:         EthosColors.outline,
    textTransform: 'uppercase',
    letterSpacing: EthosTypography.labelSm.letterSpacing,
  },
  metricsSection: {
    gap: EthosSpacing.gutter,
  },
  metricsRow: {
    flexDirection: 'row',
    gap:           EthosSpacing.gutter,
  },
  recentSection: {
    gap: EthosSpacing.stackMd,
  },
  recentHeader: {
    flexDirection:  'row',
    justifyContent: 'space-between',
    alignItems:     'center',
  },
  recentTitle: {
    ...EthosTypography.labelSm,
    color:         EthosColors.outline,
    textTransform: 'uppercase',
    letterSpacing: EthosTypography.labelSm.letterSpacing,
  },
  seeAllText: {
    ...EthosTypography.labelMd,
    color: EthosColors.onSurface,
  },
  transactionsCard: {
    backgroundColor: EthosColors.surfaceContainerLowest,
    borderRadius:    EthosRadius.lg,
    borderWidth:     EthosBorder.width,
    borderColor:     EthosBorder.color,
    overflow:        'hidden',
  },
  dashCatRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: EthosSpacing.stackSm + 4,
    paddingHorizontal: EthosSpacing.containerPadding,
  },
  dashCatRowBorder: {
    borderBottomWidth: EthosBorder.width,
    borderBottomColor: EthosColors.secondaryContainer,
  },
  dashIconWrap: {
    width: 36,
    height: 36,
    borderRadius: EthosRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: EthosSpacing.gutter,
  },
  dashCatName: {
    flex: 1,
    ...EthosTypography.bodyMd,
    fontWeight: '500',
    color: EthosColors.onSurface,
  },
  dashCatAmount: {
    ...EthosTypography.bodyMd,
    fontWeight: '500',
    color: EthosColors.onSurface,
    fontVariant: ['tabular-nums'],
  },
  insightBanner: {
    flexDirection:     'row',
    alignItems:        'center',
    backgroundColor:   EthosColors.surfaceContainerLowest,
    borderRadius:      EthosRadius.lg,
    borderWidth:       EthosBorder.width,
    borderColor:       EthosBorder.color,
    padding:           EthosSpacing.containerPadding,
    gap:               EthosSpacing.stackMd,
  },
  insightIconChip: {
    width:           36,
    height:          36,
    borderRadius:    EthosRadius.full,
    backgroundColor: EthosColors.surfaceContainerLow,
    alignItems:      'center',
    justifyContent:  'center',
  },
  insightBannerTitle: {
    ...EthosTypography.labelSm,
    color:         EthosColors.outline,
    letterSpacing: 1,
  },
  insightBannerText: {
    ...EthosTypography.bodyMd,
    color:      EthosColors.onSurface,
    fontWeight: '500',
  },
  fab: {
    position:        'absolute',
    bottom:          84, // positioned nicely above bottom navigation bar
    right:           EthosSpacing.containerPadding,
    width:           56,
    height:          56,
    borderRadius:    EthosRadius.full,
    backgroundColor: EthosColors.fabBackground,
    alignItems:      'center',
    justifyContent:  'center',
    ...EthosShadow.fab,
    zIndex:          40,
  },
});
