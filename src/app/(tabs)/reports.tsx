/**
 * AetherExpense — Ethos Analytics & Reports Screen
 *
 * Matches Stitch `analytics_reports` visual source of truth:
 *   - Overview header with total spending display & date range subtitle
 *   - Date range selector tabs (This Month, Last Month, This Year, Last 30 Days)
 *   - Core Financial Summary Metrics Cards (Income, Expenses, Net Savings, Savings Rate)
 *   - Custom SVG Spending Trend Chart (react-native-svg) with dynamic X-axis labels
 *   - Expense Category Breakdown list with icons, amounts, and % of total
 *   - Income Category Breakdown list
 *   - Budget vs Actual Spending progress section
 *   - Account Net Movement breakdown (demonstrates transfer neutrality)
 *   - 100% offline local SQLite calculation via Drizzle ORM
 *   - Strict Transfer Exclusion: Transfers (type = 'transfer') are EXCLUDED from income/expense metrics
 */

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  RefreshControl,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useSQLiteContext } from 'expo-sqlite';
import { eq, gte, lte, and, desc } from 'drizzle-orm';
import Svg, { Path, Line, Text as SvgText, Rect } from 'react-native-svg';

import { createDrizzleDB } from '@/database/client';
import { transactions, categories, budgets, accounts } from '@/database/schema';
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
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorBoundary } from '@/components/ui/ErrorBoundary';

const SCREEN_WIDTH = Dimensions.get('window').width;
const CHART_WIDTH = SCREEN_WIDTH - EthosSpacing.containerPadding * 2 - 32;
const CHART_HEIGHT = 160;

type DateRangeFilter = 'this_month' | 'last_month' | 'this_year' | 'last_30_days';

interface CategoryBreakdownItem {
  id:         string;
  name:       string;
  icon:       string;
  color:      string;
  amount:     number;
  percentage: number;
}

interface BudgetVsActualItem {
  id:           string;
  name:         string;
  categoryName: string;
  categoryIcon: string;
  budgetAmount: number;
  spentAmount:  number;
  remaining:    number;
  percentage:   number;
}

interface AccountMovementItem {
  id:      string;
  name:    string;
  icon:    string;
  income:  number;
  expense: number;
  net:     number;
}

interface TrendPoint {
  label:  string;
  amount: number;
}

export default function ReportsScreen() {
  const sqliteDb = useSQLiteContext();
  const currencyCode = useSettingsStore((s) => s.currency);
  const dataVersion = useAppStore((s) => s.dataVersion);

  const [dateFilter, setDateFilter] = useState<DateRangeFilter>('this_month');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Financial Metrics State
  const [totalIncome, setTotalIncome] = useState(0);
  const [totalExpenses, setTotalExpenses] = useState(0);
  const [expenseCatBreakdown, setExpenseCatBreakdown] = useState<CategoryBreakdownItem[]>([]);
  const [incomeCatBreakdown, setIncomeCatBreakdown] = useState<CategoryBreakdownItem[]>([]);
  const [budgetVsActualList, setBudgetVsActualList] = useState<BudgetVsActualItem[]>([]);
  const [accountMovementList, setAccountMovementList] = useState<AccountMovementItem[]>([]);
  const [trendData, setTrendData] = useState<TrendPoint[]>([]);
  const [dateRangeLabel, setDateRangeLabel] = useState('');

  // Compute start/end dates based on selected filter
  const dateBounds = useMemo(() => {
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth();

    let start: Date;
    let end: Date;
    let label = '';

    if (dateFilter === 'this_month') {
      start = new Date(y, m, 1);
      end = new Date(y, m + 1, 0, 23, 59, 59);
      label = now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    } else if (dateFilter === 'last_month') {
      start = new Date(y, m - 1, 1);
      end = new Date(y, m, 0, 23, 59, 59);
      label = start.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    } else if (dateFilter === 'this_year') {
      start = new Date(y, 0, 1);
      end = new Date(y, 11, 31, 23, 59, 59);
      label = `Year ${y}`;
    } else {
      // last_30_days
      end = now;
      start = new Date();
      start.setDate(now.getDate() - 30);
      label = 'Last 30 Days';
    }

    const fromISO = start.toISOString().split('T')[0];
    const toISO = end.toISOString().split('T')[0];

    return { fromISO, toISO, label };
  }, [dateFilter]);

  const loadAnalyticsData = useCallback(async () => {
    try {
      const db = createDrizzleDB(sqliteDb);
      const { fromISO, toISO, label } = dateBounds;
      setDateRangeLabel(label);

      // ─── 1. Query Income & Expense Totals ─────────────────────────────────
      // STRICT TRANSFER EXCLUSION: type = 'income' or 'expense' only!
      const rawTxns = await db
        .select({
          id:                     transactions.id,
          type:                   transactions.type,
          amount:                 transactions.amount,
          date:                   transactions.date,
          category_id:            transactions.category_id,
          account_id:             transactions.account_id,
          transfer_to_account_id: transactions.transfer_to_account_id,
          category_name:          categories.name,
          category_icon:          categories.icon,
          category_color:         categories.color,
        })
        .from(transactions)
        .leftJoin(categories, eq(transactions.category_id, categories.id))
        .where(
          and(
            gte(transactions.date, fromISO),
            lte(transactions.date, toISO)
          )
        );

      let incomeSum = 0;
      let expenseSum = 0;
      const expCatMap = new Map<string, { name: string; icon: string; color: string; amount: number }>();
      const incCatMap = new Map<string, { name: string; icon: string; color: string; amount: number }>();
      const dailyExpenseMap = new Map<string, number>();

      for (const t of rawTxns) {
        if (t.type === 'income') {
          incomeSum += t.amount;
          if (t.category_id && t.category_name) {
            const cur = incCatMap.get(t.category_id) || {
              name:   t.category_name,
              icon:   t.category_icon || 'cash-outline',
              color:  t.category_color || EthosColors.primary,
              amount: 0,
            };
            cur.amount += t.amount;
            incCatMap.set(t.category_id, cur);
          }
        } else if (t.type === 'expense') {
          expenseSum += t.amount;
          if (t.category_id && t.category_name) {
            const cur = expCatMap.get(t.category_id) || {
              name:   t.category_name,
              icon:   t.category_icon || 'restaurant',
              color:  t.category_color || EthosColors.primary,
              amount: 0,
            };
            cur.amount += t.amount;
            expCatMap.set(t.category_id, cur);
          }
          // Aggregate daily expense for trend chart
          const curDaySum = dailyExpenseMap.get(t.date) || 0;
          dailyExpenseMap.set(t.date, curDaySum + t.amount);
        }
        // Transfers (type === 'transfer') are EXCLUDED from incomeSum and expenseSum!
      }

      setTotalIncome(incomeSum);
      setTotalExpenses(expenseSum);

      // ─── 2. Expense Category Breakdown List ─────────────────────────────
      const expItems: CategoryBreakdownItem[] = Array.from(expCatMap.entries()).map(([id, c]) => ({
        id,
        name:       c.name,
        icon:       c.icon,
        color:      c.color,
        amount:     c.amount,
        percentage: expenseSum > 0 ? Math.round((c.amount / expenseSum) * 100) : 0,
      })).sort((a, b) => b.amount - a.amount);
      setExpenseCatBreakdown(expItems);

      // ─── 3. Income Category Breakdown List ──────────────────────────────
      const incItems: CategoryBreakdownItem[] = Array.from(incCatMap.entries()).map(([id, c]) => ({
        id,
        name:       c.name,
        icon:       c.icon,
        color:      c.color,
        amount:     c.amount,
        percentage: incomeSum > 0 ? Math.round((c.amount / incomeSum) * 100) : 0,
      })).sort((a, b) => b.amount - a.amount);
      setIncomeCatBreakdown(incItems);

      // ─── 4. Trend Chart Points ──────────────────────────────────────────
      // Group daily expense points across date range
      const days = Array.from(dailyExpenseMap.keys()).sort();
      const points: TrendPoint[] = days.map((day) => ({
        label:  day.split('-').slice(1).join('/'), // MM/DD
        amount: dailyExpenseMap.get(day) || 0,
      }));
      setTrendData(points);

      // ─── 5. Budget vs Actual Integration ────────────────────────────────
      const activeBudgets = await db
        .select({
          id:           budgets.id,
          name:         budgets.name,
          amount:       budgets.amount,
          category_id:  budgets.category_id,
          categoryName: categories.name,
          categoryIcon: categories.icon,
        })
        .from(budgets)
        .leftJoin(categories, eq(budgets.category_id, categories.id))
        .where(eq(budgets.is_active, 1));

      const bvaList: BudgetVsActualItem[] = activeBudgets.map((b) => {
        const catSpent = b.category_id ? (expCatMap.get(b.category_id)?.amount || 0) : 0;
        const remaining = b.amount - catSpent;
        const pct = b.amount > 0 ? Math.round((catSpent / b.amount) * 100) : 0;
        return {
          id:           b.id,
          name:         b.name,
          categoryName: b.categoryName || b.name,
          categoryIcon: b.categoryIcon || 'wallet-outline',
          budgetAmount: b.amount,
          spentAmount:  catSpent,
          remaining,
          percentage:   pct,
        };
      });
      setBudgetVsActualList(bvaList);

      // ─── 6. Account Net Movement Breakdown ──────────────────────────────
      const allAccounts = await db.select().from(accounts).where(eq(accounts.is_active, 1));
      const accMovements: AccountMovementItem[] = allAccounts.map((acc) => {
        let inc = 0;
        let exp = 0;
        for (const t of rawTxns) {
          if (t.type === 'income' && t.account_id === acc.id) {
            inc += t.amount;
          } else if (t.type === 'expense' && t.account_id === acc.id) {
            exp += t.amount;
          } else if (t.type === 'transfer') {
            if (t.account_id === acc.id) exp += t.amount; // Outgoing transfer
            if (t.transfer_to_account_id === acc.id) inc += t.amount; // Incoming transfer
          }
        }
        return {
          id:      acc.id,
          name:    acc.name,
          icon:    acc.icon || 'card-outline',
          income:  inc,
          expense: exp,
          net:     inc - exp,
        };
      });
      setAccountMovementList(accMovements);

    } catch (err) {
      console.error('[ReportsScreen] Analytics load error:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [dateBounds, sqliteDb]);

  useEffect(() => {
    setLoading(true);
    loadAnalyticsData();
  }, [dataVersion, loadAnalyticsData]);

  const onRefresh = () => {
    setRefreshing(true);
    loadAnalyticsData();
  };

  // Safe Financial Computations
  const netSavings = totalIncome - totalExpenses;
  const savingsRate = totalIncome > 0
    ? Math.round(((totalIncome - totalExpenses) / totalIncome) * 100)
    : 0;

  // SVG Trend Chart Path Calculation
  const svgPathData = useMemo(() => {
    if (trendData.length === 0) return '';
    const maxVal = Math.max(...trendData.map((p) => p.amount), 1);
    const stepX = trendData.length > 1 ? CHART_WIDTH / (trendData.length - 1) : CHART_WIDTH;

    const coords = trendData.map((p, i) => {
      const x = i * stepX;
      const y = CHART_HEIGHT - (p.amount / maxVal) * (CHART_HEIGHT - 30) - 15;
      return { x, y };
    });

    return coords.reduce((acc, curr, idx) => {
      if (idx === 0) return `M ${curr.x} ${curr.y}`;
      return `${acc} L ${curr.x} ${curr.y}`;
    }, '');
  }, [trendData]);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* ─── Top Navbar ──────────────────────────────────────────────────── */}
      <View style={styles.navbar}>
        <View style={styles.navLeft}>
          <View style={styles.avatarWrap}>
            <Ionicons name="analytics" size={16} color={EthosColors.onSurface} />
          </View>
          <Text style={styles.navTitle}>Overview</Text>
        </View>
        <Ionicons name="search" size={20} color={EthosColors.outline} />
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
        {/* ─── Hero Overview Header ────────────────────────────────────────── */}
        <View style={styles.heroSection}>
          <Text style={styles.heroSubhead}>Your spending</Text>
          <Text style={styles.heroDisplayAmount}>
            {formatCurrency(totalExpenses, currencyCode)}
          </Text>
          <Text style={styles.heroDateLabel}>{dateRangeLabel}</Text>
        </View>

        {/* ─── Date Range Selector Tabs ───────────────────────────────────── */}
        <View style={styles.filterTabsRow}>
          {[
            { id: 'this_month',   label: 'This Month' },
            { id: 'last_month',   label: 'Last Month' },
            { id: 'this_year',    label: 'This Year' },
            { id: 'last_30_days', label: '30 Days' },
          ].map((tab) => {
            const active = dateFilter === tab.id;
            return (
              <Pressable
                key={tab.id}
                id={`filter-tab-${tab.id}`}
                onPress={() => setDateFilter(tab.id as DateRangeFilter)}
                style={[
                  styles.filterTabBtn,
                  active && styles.filterTabBtnActive,
                ]}
              >
                <Text style={[styles.filterTabText, active && styles.filterTabTextActive]}>
                  {tab.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* ─── Core Financial Metrics Grid ─────────────────────────────────── */}
        <View style={styles.metricsGrid}>
          {/* Income Card */}
          <View style={styles.metricCard}>
            <Text style={styles.metricLabel}>Total Income</Text>
            <Text style={[styles.metricValue, { color: '#059669' }]}>
              {formatCurrency(totalIncome, currencyCode)}
            </Text>
          </View>

          {/* Expense Card */}
          <View style={styles.metricCard}>
            <Text style={styles.metricLabel}>Total Expenses</Text>
            <Text style={[styles.metricValue, { color: EthosColors.primary }]}>
              {formatCurrency(totalExpenses, currencyCode)}
            </Text>
          </View>

          {/* Net Savings Card */}
          <View style={styles.metricCard}>
            <Text style={styles.metricLabel}>Net Savings</Text>
            <Text style={[styles.metricValue, { color: EthosColors.primary }]}>
              {formatCurrency(netSavings, currencyCode)}
            </Text>
          </View>

          {/* Savings Rate Card */}
          <View style={styles.metricCard}>
            <Text style={styles.metricLabel}>Savings Rate</Text>
            <Text style={[styles.metricValue, { color: EthosColors.primary }]}>
              {savingsRate}%
            </Text>
          </View>
        </View>

        {/* ─── Spending Trend SVG Chart ────────────────────────────────────── */}
        <ErrorBoundary fallbackTitle="Chart Error" fallbackMessage="Could not render spending trend graph due to a data rendering mismatch.">
          <View style={styles.bentoCard}>
            <View style={styles.cardHeaderRow}>
              <Text style={styles.cardTitle}>Spending Trend</Text>
              <View style={styles.rangeChip}>
                <Text style={styles.rangeChipText}>{dateRangeLabel}</Text>
              </View>
            </View>

            {trendData.length === 0 ? (
              <EmptyState
                icon="stats-chart-outline"
                title="No spending data"
                description="No expense transactions found for the selected date range."
                style={{ paddingVertical: EthosSpacing.stackLg }}
              />
            ) : (
              <View style={styles.chartWrap}>
                <Svg width={CHART_WIDTH} height={CHART_HEIGHT}>
                  {/* Horizontal Dotted Grid Lines */}
                  <Line x1="0" y1="30" x2={CHART_WIDTH} y2="30" stroke="#E5E5E5" strokeDasharray="4 4" strokeWidth="1" />
                  <Line x1="0" y1="70" x2={CHART_WIDTH} y2="70" stroke="#E5E5E5" strokeDasharray="4 4" strokeWidth="1" />
                  <Line x1="0" y1="110" x2={CHART_WIDTH} y2="110" stroke="#E5E5E5" strokeDasharray="4 4" strokeWidth="1" />

                  {/* Smooth Spending Trend Line */}
                  <Path d={svgPathData} stroke={EthosColors.primary} strokeWidth="2.5" fill="none" />
                </Svg>
                <View style={styles.chartLabelsRow}>
                  <Text style={styles.chartLabelText}>
                    {trendData[0]?.label || ''}
                  </Text>
                  <Text style={styles.chartLabelText}>
                    {trendData[Math.floor(trendData.length / 2)]?.label || ''}
                  </Text>
                  <Text style={styles.chartLabelText}>
                    {trendData[trendData.length - 1]?.label || ''}
                  </Text>
                </View>
              </View>
            )}
          </View>
        </ErrorBoundary>

        {/* ─── Expense Category Breakdown ──────────────────────────────────── */}
        <View style={styles.sectionWrap}>
          <Text style={styles.sectionHeaderTitle}>Category Breakdown</Text>
          <View style={styles.bentoCardList}>
            {expenseCatBreakdown.length === 0 ? (
              <EmptyState
                icon="pie-chart-outline"
                title="No category breakdown"
                description="Categorized expenses will appear here."
                style={{ paddingVertical: EthosSpacing.stackLg }}
              />
            ) : (
              expenseCatBreakdown.map((item, index) => {
                const isLast = index === expenseCatBreakdown.length - 1;
                return (
                  <View
                    key={item.id}
                    style={[styles.catRow, !isLast && styles.rowBorderBottom]}
                  >
                    <View style={styles.catLeft}>
                      <View style={styles.iconChip}>
                        <Ionicons
                          name={(item.icon || 'restaurant') as any}
                          size={18}
                          color={EthosColors.onSurface}
                        />
                      </View>
                      <View style={{ gap: 2 }}>
                        <Text style={styles.catName}>{item.name}</Text>
                        <Text style={styles.catSubtext}>
                          {item.percentage}% of total
                        </Text>
                      </View>
                    </View>

                    <View style={styles.catRight}>
                      <Text style={styles.catAmount}>
                        {formatCurrency(item.amount, currencyCode)}
                      </Text>
                      {/* Inline Fill Bar */}
                      <View style={styles.inlineBarTrack}>
                        <View
                          style={[
                            styles.inlineBarFill,
                            { width: `${Math.min(100, Math.max(0, item.percentage))}%` },
                          ]}
                        />
                      </View>
                    </View>
                  </View>
                );
              })
            )}
          </View>
        </View>

        {/* ─── Income Category Breakdown ──────────────────────────────────── */}
        {incomeCatBreakdown.length > 0 && (
          <View style={styles.sectionWrap}>
            <Text style={styles.sectionHeaderTitle}>Income Breakdown</Text>
            <View style={styles.bentoCardList}>
              {incomeCatBreakdown.map((item, index) => {
                const isLast = index === incomeCatBreakdown.length - 1;
                return (
                  <View
                    key={item.id}
                    style={[styles.catRow, !isLast && styles.rowBorderBottom]}
                  >
                    <View style={styles.catLeft}>
                      <View style={[styles.iconChip, { backgroundColor: 'rgba(5, 150, 105, 0.1)' }]}>
                        <Ionicons
                          name={(item.icon || 'cash-outline') as any}
                          size={18}
                          color="#059669"
                        />
                      </View>
                      <View style={{ gap: 2 }}>
                        <Text style={styles.catName}>{item.name}</Text>
                        <Text style={styles.catSubtext}>
                          {item.percentage}% of income
                        </Text>
                      </View>
                    </View>

                    <Text style={[styles.catAmount, { color: '#059669' }]}>
                      +{formatCurrency(item.amount, currencyCode)}
                    </Text>
                  </View>
                );
              })}
            </View>
          </View>
        )}

        {/* ─── Budget vs Actual Spending Comparison ───────────────────────── */}
        {budgetVsActualList.length > 0 && (
          <View style={styles.sectionWrap}>
            <Text style={styles.sectionHeaderTitle}>Budget vs Actual</Text>
            <View style={styles.bentoCardList}>
              {budgetVsActualList.map((item, index) => {
                const isLast = index === budgetVsActualList.length - 1;
                const isOver = item.spentAmount > item.budgetAmount;
                return (
                  <View
                    key={item.id}
                    style={[styles.catRow, !isLast && styles.rowBorderBottom]}
                  >
                    <View style={styles.catLeft}>
                      <View style={styles.iconChip}>
                        <Ionicons
                          name={(item.categoryIcon || 'wallet-outline') as any}
                          size={18}
                          color={EthosColors.onSurface}
                        />
                      </View>
                      <View style={{ gap: 2 }}>
                        <Text style={styles.catName}>{item.categoryName}</Text>
                        <Text style={styles.catSubtext}>
                          {item.percentage}% used
                        </Text>
                      </View>
                    </View>

                    <View style={styles.catRight}>
                      <Text style={[styles.catAmount, isOver && { color: EthosColors.error }]}>
                        {formatCurrency(item.spentAmount, currencyCode)}{' '}
                        <Text style={{ fontWeight: '400', color: EthosColors.outline }}>
                          / {formatCurrency(item.budgetAmount, currencyCode)}
                        </Text>
                      </Text>
                    </View>
                  </View>
                );
              })}
            </View>
          </View>
        )}

        {/* ─── Account Net Movement Breakdown ──────────────────────────────── */}
        {accountMovementList.length > 0 && (
          <View style={styles.sectionWrap}>
            <Text style={styles.sectionHeaderTitle}>Account Activity</Text>
            <View style={styles.bentoCardList}>
              {accountMovementList.map((acc, index) => {
                const isLast = index === accountMovementList.length - 1;
                return (
                  <View
                    key={acc.id}
                    style={[styles.catRow, !isLast && styles.rowBorderBottom]}
                  >
                    <View style={styles.catLeft}>
                      <View style={styles.iconChip}>
                        <Ionicons
                          name={(acc.icon || 'card-outline') as any}
                          size={18}
                          color={EthosColors.onSurface}
                        />
                      </View>
                      <Text style={styles.catName}>{acc.name}</Text>
                    </View>

                    <View style={{ alignItems: 'flex-end', gap: 2 }}>
                      <Text
                        style={[
                          styles.catAmount,
                          acc.net >= 0 ? { color: '#059669' } : { color: EthosColors.error },
                        ]}
                      >
                        {acc.net >= 0 ? '+' : ''}
                        {formatCurrency(acc.net, currencyCode)}
                      </Text>
                      <Text style={styles.catSubtext}>
                        In: {formatCurrency(acc.income, currencyCode)} | Out: {formatCurrency(acc.expense, currencyCode)}
                      </Text>
                    </View>
                  </View>
                );
              })}
            </View>
          </View>
        )}
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
  avatarWrap: {
    width:           32,
    height:          32,
    borderRadius:    EthosRadius.full,
    backgroundColor: EthosColors.surfaceContainerHigh,
    alignItems:      'center',
    justifyContent:  'center',
    borderWidth:     EthosBorder.width,
    borderColor:     EthosBorder.color,
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
  heroSection: {
    gap: 4,
  },
  heroSubhead: {
    ...EthosTypography.headlineLg,
    fontSize:   24,
    color:      EthosColors.onSurface,
    fontWeight: '300',
  },
  heroDisplayAmount: {
    ...EthosTypography.displayLg,
    fontSize:    42,
    color:       EthosColors.primary,
    fontWeight:  '300',
    fontVariant: ['tabular-nums'],
  },
  heroDateLabel: {
    ...EthosTypography.bodyMd,
    color: EthosColors.outline,
  },
  filterTabsRow: {
    flexDirection:  'row',
    backgroundColor: EthosColors.surfaceContainerHigh,
    borderRadius:    EthosRadius.full,
    padding:         4,
  },
  filterTabBtn: {
    flex:            1,
    paddingVertical: EthosSpacing.unit,
    borderRadius:    EthosRadius.full,
    alignItems:      'center',
    justifyContent:  'center',
  },
  filterTabBtnActive: {
    backgroundColor: EthosColors.surfaceContainerLowest,
    shadowColor:     '#000',
    shadowOffset:    { width: 0, height: 1 },
    shadowOpacity:   0.1,
    shadowRadius:    2,
    elevation:       2,
  },
  filterTabText: {
    ...EthosTypography.labelSm,
    color: EthosColors.outline,
  },
  filterTabTextActive: {
    color:      EthosColors.primary,
    fontWeight: '600',
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap:      'wrap',
    gap:           EthosSpacing.stackSm,
  },
  metricCard: {
    width:           (SCREEN_WIDTH - EthosSpacing.containerPadding * 2 - EthosSpacing.stackSm) / 2,
    backgroundColor: EthosColors.surfaceContainerLowest,
    borderRadius:    EthosRadius.lg,
    borderWidth:     EthosBorder.width,
    borderColor:     EthosBorder.color,
    padding:         EthosSpacing.stackMd,
    gap:             4,
  },
  metricLabel: {
    ...EthosTypography.labelSm,
    color: EthosColors.outline,
  },
  metricValue: {
    ...EthosTypography.headlineLg,
    fontSize:    20,
    fontWeight:  '600',
    fontVariant: ['tabular-nums'],
  },
  bentoCard: {
    backgroundColor: EthosColors.surfaceContainerLowest,
    borderRadius:    EthosRadius.lg,
    borderWidth:     EthosBorder.width,
    borderColor:     EthosBorder.color,
    padding:         EthosSpacing.containerPadding,
    gap:             EthosSpacing.stackMd,
  },
  cardHeaderRow: {
    flexDirection:  'row',
    justifyContent: 'space-between',
    alignItems:     'center',
  },
  cardTitle: {
    ...EthosTypography.labelMd,
    fontWeight: '600',
    color:      EthosColors.onSurface,
  },
  rangeChip: {
    backgroundColor:   EthosColors.surfaceContainerHigh,
    paddingHorizontal: EthosSpacing.stackSm + 2,
    paddingVertical:   4,
    borderRadius:      EthosRadius.full,
  },
  rangeChipText: {
    ...EthosTypography.labelSm,
    color: EthosColors.outline,
  },
  chartWrap: {
    alignItems:     'center',
    justifyContent: 'center',
  },
  chartLabelsRow: {
    flexDirection:     'row',
    justifyContent:    'space-between',
    width:             '100%',
    paddingHorizontal: 4,
    marginTop:         EthosSpacing.unit,
  },
  chartLabelText: {
    ...EthosTypography.labelSm,
    color: EthosColors.outline,
  },
  sectionWrap: {
    gap: EthosSpacing.stackMd,
  },
  sectionHeaderTitle: {
    ...EthosTypography.headlineLg,
    fontSize:   20,
    color:      EthosColors.primary,
    fontWeight: '500',
  },
  bentoCardList: {
    backgroundColor: EthosColors.surfaceContainerLowest,
    borderRadius:    EthosRadius.lg,
    borderWidth:     EthosBorder.width,
    borderColor:     EthosBorder.color,
    overflow:        'hidden',
  },
  catRow: {
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
  catLeft: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           EthosSpacing.stackMd,
    flex:          1,
  },
  iconChip: {
    width:           40,
    height:          40,
    borderRadius:    EthosRadius.full,
    backgroundColor: EthosColors.surfaceContainer,
    alignItems:      'center',
    justifyContent:  'center',
  },
  catName: {
    ...EthosTypography.labelMd,
    fontWeight: '500',
    color:      EthosColors.onSurface,
  },
  catSubtext: {
    ...EthosTypography.labelSm,
    color: EthosColors.outline,
  },
  catRight: {
    alignItems: 'flex-end',
    gap:        4,
  },
  catAmount: {
    ...EthosTypography.bodyMd,
    fontWeight:  '500',
    color:       EthosColors.onSurface,
    fontVariant: ['tabular-nums'],
  },
  inlineBarTrack: {
    height:          2,
    width:           80,
    backgroundColor: EthosColors.surfaceContainerHigh,
    borderRadius:    EthosRadius.full,
    overflow:        'hidden',
  },
  inlineBarFill: {
    height:          '100%',
    backgroundColor: EthosColors.primary,
    borderRadius:    EthosRadius.full,
  },
});
