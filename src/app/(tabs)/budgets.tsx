/**
 * AetherExpense — Ethos Budgets Dashboard Screen
 *
 * Matches Stitch `budgets_dashboard` visual source of truth:
 *   - Monthly Budget Overview hero card (Total Allocated, Spent, Left, thin progress bar)
 *   - Category Budgets list with icon, category name, spent / limit ratio, percentage badge, and progress bar
 *   - Near Limit / Overspent warning indicators
 *   - 100% offline SQLite queries via Drizzle ORM
 *   - Strict calculation: ONLY counts expense transactions for that category and period (excludes income & transfers)
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
import { eq, gte, lte, and } from 'drizzle-orm';

import { createDrizzleDB } from '@/database/client';
import { budgets, categories, transactions } from '@/database/schema';
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
import { currentMonthRange } from '@/utils/dates';
import { EmptyState } from '@/components/ui/EmptyState';

interface CategoryBudgetItem {
  id:             string;
  name:           string;
  amount:         number;
  period:         string;
  category_id:    string | null;
  category_name:  string;
  category_icon:  string;
  category_color: string;
  warn_at:        number;
  spent:          number;
  left:           number;
  percentage:     number;
  isOverspent:    boolean;
  isNearLimit:    boolean;
}

function computeMonthlyAllocation(amount: number, period: string): number {
  if (period === 'weekly') return Math.round(amount * 4.3333);
  if (period === 'yearly') return Math.round(amount / 12);
  return amount;
}

export default function BudgetsTabScreen() {
  const sqliteDb = useSQLiteContext();
  const currencyCode = useSettingsStore((s) => s.currency);
  const dataVersion = useAppStore((s) => s.dataVersion);

  const [budgetList, setBudgetList] = useState<CategoryBudgetItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchBudgetData = useCallback(async () => {
    try {
      const db = createDrizzleDB(sqliteDb);
      const { from, to } = currentMonthRange();

      // Query active budgets with category details
      const budgetRows = await db
        .select({
          id:             budgets.id,
          name:           budgets.name,
          amount:         budgets.amount,
          period:         budgets.period,
          category_id:    budgets.category_id,
          warn_at:        budgets.warn_at,
          category_name:  categories.name,
          category_icon:  categories.icon,
          category_color: categories.color,
        })
        .from(budgets)
        .leftJoin(categories, eq(budgets.category_id, categories.id))
        .where(eq(budgets.is_active, 1));

      // Query all expense transactions for the current month
      // Filter STRICTLY by type = 'expense' (Excludes income & transfers!)
      const monthlyExpenses = await db
        .select({
          category_id: transactions.category_id,
          amount:      transactions.amount,
        })
        .from(transactions)
        .where(
          and(
            eq(transactions.type, 'expense'),
            gte(transactions.date, from),
            lte(transactions.date, to)
          )
        );

      // Compute spending per category
      const expenseMap = new Map<string, number>();
      for (const e of monthlyExpenses) {
        if (!e.category_id) continue;
        const currentSum = expenseMap.get(e.category_id) || 0;
        expenseMap.set(e.category_id, currentSum + e.amount);
      }

      // Map combined budget items
      const items: CategoryBudgetItem[] = budgetRows.map((b) => {
        const spent = b.category_id ? (expenseMap.get(b.category_id) || 0) : 0;
        const left = b.amount - spent;
        const percentage = b.amount > 0 ? Math.round((spent / b.amount) * 100) : 0;
        const isOverspent = spent > b.amount;
        const isNearLimit = !isOverspent && percentage >= b.warn_at;

        return {
          id:             b.id,
          name:           b.name,
          amount:         b.amount,
          period:         b.period,
          category_id:    b.category_id,
          category_name:  b.category_name || b.name,
          category_icon:  b.category_icon || 'wallet-outline',
          category_color: b.category_color || EthosColors.primary,
          warn_at:        b.warn_at,
          spent,
          left,
          percentage,
          isOverspent,
          isNearLimit,
        };
      });

      setBudgetList(items);
    } catch (err) {
      console.error('[BudgetsTabScreen] Error:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [sqliteDb]);

  useEffect(() => {
    setLoading(true);
    fetchBudgetData();
  }, [dataVersion, fetchBudgetData]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchBudgetData();
  };

  // Aggregated Monthly Budget Totals (normalized for weekly/yearly periods)
  const totalAllocated = useMemo(
    () => budgetList.reduce((sum, b) => sum + computeMonthlyAllocation(b.amount, b.period), 0),
    [budgetList]
  );
  const totalSpent = useMemo(
    () => budgetList.reduce((sum, b) => sum + b.spent, 0),
    [budgetList]
  );
  const totalLeft = totalAllocated - totalSpent;
  const overallFraction = totalAllocated > 0 ? Math.min(1, totalSpent / totalAllocated) : 0;
  const isOverallOverspent = totalSpent > totalAllocated && totalAllocated > 0;

  // Month Label Format: e.g. "August 2026"
  const currentMonthLabel = useMemo(() => {
    const d = new Date();
    return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  }, []);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* ─── Top Navigation Header ────────────────────────────────────────── */}
      <View style={styles.navbar}>
        <View style={styles.navLeft}>
          <View style={styles.avatarWrap}>
            <Ionicons name="person-outline" size={16} color={EthosColors.onSurface} />
          </View>
          <Text style={styles.navTitle}>Budgets</Text>
        </View>
        <Pressable
          id="add-budget-header-btn"
          onPress={() => router.push('/budgets/add' as any)}
          style={({ pressed }) => [styles.navBtn, pressed && { opacity: 0.7 }]}
          accessibilityLabel="Add Budget"
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
        {/* ─── Primary Hero Card: Monthly Budget Overview ────────────────────── */}
        <View style={styles.heroCard}>
          <View style={styles.heroTopRow}>
            <Text style={styles.heroSublabel}>MONTHLY BUDGET</Text>
            <View style={styles.monthChip}>
              <Text style={styles.monthChipText}>{currentMonthLabel}</Text>
            </View>
          </View>

          <View style={styles.heroAmountRow}>
            <Text style={styles.heroAmount}>
              {formatCurrency(totalAllocated, currencyCode)}
            </Text>
            <Text style={styles.heroAllocatedLabel}>Total Allocated</Text>
          </View>

          {/* Progress Bar & Subtotals */}
          <View style={styles.progressSection}>
            <View style={styles.progressLabelsRow}>
              <Text style={styles.progressSpentText}>
                Spent {formatCurrency(totalSpent, currencyCode)}
              </Text>
              <Text style={[styles.progressLeftText, isOverallOverspent && { color: EthosColors.error }]}>
                {isOverallOverspent
                  ? `Over ${formatCurrency(Math.abs(totalLeft), currencyCode)}`
                  : `Left ${formatCurrency(totalLeft, currencyCode)}`}
              </Text>
            </View>

            <View style={styles.progressBarTrack}>
              <View
                style={[
                  styles.progressBarFill,
                  { width: `${Math.min(100, Math.max(0, overallFraction * 100))}%` },
                  isOverallOverspent && { backgroundColor: EthosColors.error },
                ]}
              />
            </View>
          </View>
        </View>

        {/* ─── Category Breakdown List ────────────────────────────────────── */}
        <View style={styles.categorySection}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Categories</Text>
            <Pressable onPress={() => router.push('/budgets/add' as any)}>
              <Text style={styles.addTextBtn}>+ Add Budget</Text>
            </Pressable>
          </View>

          <View style={styles.bentoContainer}>
            {budgetList.length === 0 ? (
              <EmptyState
                icon="wallet-outline"
                title="No category budgets set"
                description="Set monthly spending limits for categories like Food, Transport, or Shopping."
                actionLabel="Create Budget"
                onAction={() => router.push('/budgets/add' as any)}
                style={{ paddingVertical: EthosSpacing.stackLg }}
              />
            ) : (
              budgetList.map((item, index) => {
                const isLast = index === budgetList.length - 1;
                const barWidth = Math.min(100, Math.max(0, item.percentage));

                return (
                  <Pressable
                    key={item.id}
                    id={`budget-card-${item.id}`}
                    onPress={() => router.push(`/budgets/edit/${item.id}` as any)}
                    style={({ pressed }) => [
                      styles.budgetItemRow,
                      item.isOverspent && styles.overspentRowBg,
                      !isLast && styles.rowBorderBottom,
                      pressed && { opacity: 0.9, backgroundColor: EthosColors.surfaceContainerLow },
                    ]}
                  >
                    {/* Top Row: Icon + Name | Badge */}
                    <View style={styles.itemTopRow}>
                      <View style={styles.itemTitleWrap}>
                        <Ionicons
                          name={(item.category_icon || 'restaurant') as any}
                          size={18}
                          color={item.isOverspent ? EthosColors.error : EthosColors.onSurface}
                        />
                        <Text style={styles.itemCategoryName} numberOfLines={1}>
                          {item.category_name}
                        </Text>
                      </View>

                      {/* Status Badge */}
                      {item.isOverspent ? (
                        <View style={[styles.badge, styles.overspentBadge]}>
                          <Text style={styles.overspentBadgeText}>Overspent</Text>
                        </View>
                      ) : item.isNearLimit ? (
                        <View style={[styles.badge, styles.nearLimitBadge]}>
                          <Text style={styles.nearLimitBadgeText}>Near Limit</Text>
                        </View>
                      ) : (
                        <Text style={styles.percentText}>{item.percentage}%</Text>
                      )}
                    </View>

                    {/* Middle Row: Spent / Limit */}
                    <View style={styles.itemRatioRow}>
                      <Text style={styles.spentAmountText}>
                        {formatCurrency(item.spent, currencyCode)}{' '}
                        <Text style={styles.limitAmountText}>
                          / {formatCurrency(item.amount, currencyCode)}
                        </Text>
                      </Text>
                    </View>

                    {/* Bottom Row: 2px Progress Bar Track */}
                    <View style={styles.itemBarTrack}>
                      <View
                        style={[
                          styles.itemBarFill,
                          {
                            width: `${barWidth}%`,
                            backgroundColor: item.isOverspent
                              ? EthosColors.error
                              : item.isNearLimit
                              ? '#D97706'
                              : EthosColors.primary,
                          },
                        ]}
                      />
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
    color: EthosColors.onSurface,
    fontWeight: '500',
  },
  navBtn: {
    padding: 4,
  },
  scrollContent: {
    paddingHorizontal: EthosSpacing.containerPadding,
    paddingTop:        EthosSpacing.stackLg,
    paddingBottom:     96,
    gap:               EthosSpacing.stackLg,
  },
  heroCard: {
    backgroundColor: EthosColors.surfaceContainerLowest,
    borderRadius:    EthosRadius.lg,
    borderWidth:     EthosBorder.width,
    borderColor:     EthosBorder.color,
    padding:         EthosSpacing.containerPadding,
    gap:             EthosSpacing.stackMd,
  },
  heroTopRow: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'space-between',
  },
  heroSublabel: {
    ...EthosTypography.labelSm,
    color:         EthosColors.outline,
    letterSpacing: 1.2,
  },
  monthChip: {
    backgroundColor:   EthosColors.surfaceContainerHigh,
    borderRadius:      EthosRadius.full,
    paddingHorizontal: EthosSpacing.stackSm + 2,
    paddingVertical:   4,
  },
  monthChipText: {
    ...EthosTypography.labelSm,
    color: EthosColors.onSurface,
  },
  heroAmountRow: {
    gap: 2,
  },
  heroAmount: {
    ...EthosTypography.displayLg,
    fontSize:    40,
    color:       EthosColors.primary,
    fontVariant: ['tabular-nums'],
  },
  heroAllocatedLabel: {
    ...EthosTypography.bodyMd,
    color: EthosColors.outline,
  },
  progressSection: {
    gap:        EthosSpacing.unit,
    marginTop:  EthosSpacing.unit,
  },
  progressLabelsRow: {
    flexDirection:  'row',
    justifyContent: 'space-between',
  },
  progressSpentText: {
    ...EthosTypography.labelMd,
    color: EthosColors.onSurface,
  },
  progressLeftText: {
    ...EthosTypography.labelMd,
    color: EthosColors.outline,
  },
  progressBarTrack: {
    height:          4,
    width:           '100%',
    backgroundColor: EthosColors.surfaceContainerHigh,
    borderRadius:    EthosRadius.full,
    overflow:        'hidden',
  },
  progressBarFill: {
    height:          '100%',
    backgroundColor: EthosColors.primary,
    borderRadius:    EthosRadius.full,
  },
  categorySection: {
    gap: EthosSpacing.stackMd,
  },
  sectionHeaderRow: {
    flexDirection:  'row',
    justifyContent: 'space-between',
    alignItems:     'center',
  },
  sectionTitle: {
    ...EthosTypography.headlineLg,
    fontSize:   22,
    color:      EthosColors.primary,
    fontWeight: '500',
  },
  addTextBtn: {
    ...EthosTypography.labelMd,
    color:      EthosColors.primary,
    fontWeight: '600',
  },
  bentoContainer: {
    backgroundColor: EthosColors.surfaceContainerLowest,
    borderRadius:    EthosRadius.lg,
    borderWidth:     EthosBorder.width,
    borderColor:     EthosBorder.color,
    overflow:        'hidden',
  },
  budgetItemRow: {
    padding: EthosSpacing.containerPadding,
    gap:     EthosSpacing.stackSm,
  },
  overspentRowBg: {
    backgroundColor: 'rgba(186, 26, 26, 0.04)',
  },
  rowBorderBottom: {
    borderBottomWidth: EthosBorder.width,
    borderBottomColor: EthosBorder.color,
  },
  itemTopRow: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'space-between',
  },
  itemTitleWrap: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           EthosSpacing.stackSm,
    flex:          1,
  },
  itemCategoryName: {
    ...EthosTypography.bodyLg,
    fontWeight: '500',
    color:      EthosColors.primary,
  },
  percentText: {
    ...EthosTypography.labelMd,
    color: EthosColors.outline,
  },
  badge: {
    paddingHorizontal: EthosSpacing.stackSm,
    paddingVertical:   2,
    borderRadius:      EthosRadius.full,
  },
  nearLimitBadge: {
    backgroundColor: 'rgba(217, 119, 6, 0.15)',
  },
  nearLimitBadgeText: {
    ...EthosTypography.labelSm,
    color:      '#D97706',
    fontWeight: '600',
  },
  overspentBadge: {
    backgroundColor: 'rgba(186, 26, 26, 0.15)',
  },
  overspentBadgeText: {
    ...EthosTypography.labelSm,
    color:      EthosColors.error,
    fontWeight: '600',
  },
  itemRatioRow: {
    paddingLeft: 26,
  },
  spentAmountText: {
    ...EthosTypography.labelMd,
    fontWeight: '600',
    color:      EthosColors.onSurface,
    fontVariant: ['tabular-nums'],
  },
  limitAmountText: {
    fontWeight: '400',
    color:      EthosColors.outline,
  },
  itemBarTrack: {
    height:          2,
    width:           '100%',
    backgroundColor: EthosColors.surfaceContainerHigh,
    borderRadius:    EthosRadius.full,
    overflow:        'hidden',
    marginTop:       4,
  },
  itemBarFill: {
    height:       '100%',
    borderRadius: EthosRadius.full,
  },
});
