/**
 * AetherExpense — Ethos Transactions List Screen
 *
 * Implements Stitch `transactions_list` visual source of truth.
 * Includes:
 *   - Header & Month context
 *   - Total spent card
 *   - Functional local search & filter (by merchant, note, category, type, amount, sort)
 *   - Date section grouping (TODAY, YESTERDAY, specific date headers)
 *   - Hairstyled transaction rows
 *   - Pure offline SQLite execution
 */

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  SectionList,
  Pressable,
  TextInput,
  StyleSheet,
  RefreshControl,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSQLiteContext } from 'expo-sqlite';
import { eq, desc, asc, and, sql } from 'drizzle-orm';

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
import { formatRelativeDate, todayISO, daysAgo } from '@/utils/dates';
import { TransactionRow } from '@/components/ethos/TransactionRow';
import {
  TransactionFilterModal,
  FilterOptions,
} from '@/components/ethos/TransactionFilterModal';
import { TransactionItemSkeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';

interface TxnRawItem {
  id:             string;
  type:           'income' | 'expense' | 'transfer';
  amount:         number;
  date:           string;
  time:           string;
  note:           string | null;
  merchant:       string | null;
  category_id:    string;
  category_name:  string;
  category_icon:  string;
  category_color: string;
}

interface DateGroup {
  title: string;
  data: TxnRawItem[];
}

const DEFAULT_FILTERS: FilterOptions = {
  type:       'all',
  categoryId: null,
  sort:       'newest',
  minAmount:  '',
  maxAmount:  '',
};

export default function TransactionsScreen() {
  const sqliteDb = useSQLiteContext();
  const currencyCode = useSettingsStore((s) => s.currency);
  const dataVersion = useAppStore((s) => s.dataVersion);

  const [rawTxns, setRawTxns] = useState<TxnRawItem[]>([]);
  const [catList, setCatList] = useState<Array<{ id: string; name: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Search & Filter state
  const [search, setSearch] = useState('');
  const [showSearchInput, setShowSearchInput] = useState(false);
  const [filters, setFilters] = useState<FilterOptions>(DEFAULT_FILTERS);
  const [showFilterModal, setShowFilterModal] = useState(false);

  // Fetch all transactions and categories from SQLite
  const fetchData = useCallback(async () => {
    try {
      const db = createDrizzleDB(sqliteDb);

      // Load active categories for filter modal
      const catResult = await db
        .select({ id: categories.id, name: categories.name })
        .from(categories)
        .where(eq(categories.is_active, 1))
        .orderBy(categories.sort_order);

      setCatList(catResult);

      // Query transactions with category details
      const result = await db
        .select({
          id:             transactions.id,
          type:           transactions.type,
          amount:         transactions.amount,
          date:           transactions.date,
          time:           transactions.time,
          note:           transactions.note,
          merchant:       transactions.merchant,
          category_id:    transactions.category_id,
          category_name:  categories.name,
          category_icon:  categories.icon,
          category_color: categories.color,
        })
        .from(transactions)
        .innerJoin(categories, eq(transactions.category_id, categories.id))
        .orderBy(desc(transactions.date), desc(transactions.created_at));

      setRawTxns(result as TxnRawItem[]);
    } catch (err) {
      console.error('[TransactionsScreen] Error fetching data:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [sqliteDb]);

  useEffect(() => {
    setLoading(true);
    fetchData();
  }, [dataVersion, fetchData]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  // Local filtering & sorting logic
  const filteredAndSortedTxns = useMemo(() => {
    let result = [...rawTxns];

    // 1. Search text filter (merchant, note, category name)
    if (search.trim()) {
      const q = search.toLowerCase().trim();
      result = result.filter(
        (t) =>
          (t.merchant && t.merchant.toLowerCase().includes(q)) ||
          (t.note && t.note.toLowerCase().includes(q)) ||
          t.category_name.toLowerCase().includes(q)
      );
    }

    // 2. Type filter
    if (filters.type !== 'all') {
      result = result.filter((t) => t.type === filters.type);
    }

    // 3. Category filter
    if (filters.categoryId) {
      result = result.filter((t) => t.category_id === filters.categoryId);
    }

    // 4. Amount Range filter
    if (filters.minAmount) {
      const minVal = parseFloat(filters.minAmount) * 100; // in minor units
      if (!isNaN(minVal)) {
        result = result.filter((t) => t.amount >= minVal);
      }
    }
    if (filters.maxAmount) {
      const maxVal = parseFloat(filters.maxAmount) * 100; // in minor units
      if (!isNaN(maxVal)) {
        result = result.filter((t) => t.amount <= maxVal);
      }
    }

    // 5. Sorting
    result.sort((a, b) => {
      switch (filters.sort) {
        case 'oldest':
          return a.date.localeCompare(b.date);
        case 'highest':
          return b.amount - a.amount;
        case 'lowest':
          return a.amount - b.amount;
        case 'newest':
        default:
          return b.date.localeCompare(a.date);
      }
    });

    return result;
  }, [rawTxns, search, filters]);

  // Compute total spent in filtered list (sum of expense transactions)
  const totalSpent = useMemo(() => {
    return filteredAndSortedTxns
      .filter((t) => t.type === 'expense')
      .reduce((sum, t) => sum + t.amount, 0);
  }, [filteredAndSortedTxns]);

  // Group transactions by Date into SectionList format
  const sectionedData = useMemo(() => {
    const map = new Map<string, TxnRawItem[]>();

    for (const item of filteredAndSortedTxns) {
      const groupKey = item.date;
      if (!map.has(groupKey)) {
        map.set(groupKey, []);
      }
      map.get(groupKey)!.push(item);
    }

    const todayStr = todayISO();
    const yesterdayStr = daysAgo(1);

    const sections: DateGroup[] = [];
    map.forEach((items, dateKey) => {
      let displayTitle = dateKey;
      if (dateKey === todayStr) {
        displayTitle = 'TODAY';
      } else if (dateKey === yesterdayStr) {
        displayTitle = 'YESTERDAY';
      } else {
        // Format ISO date string into e.g. "29 AUGUST 2026"
        const [y, m, d] = dateKey.split('-');
        const dateObj = new Date(Number(y), Number(m) - 1, Number(d));
        displayTitle = dateObj
          .toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
          .toUpperCase();
      }
      sections.push({ title: displayTitle, data: items });
    });

    return sections;
  }, [filteredAndSortedTxns]);

  // Month label header text
  const currentMonthLabel = useMemo(() => {
    const d = new Date();
    return d.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' }).toUpperCase();
  }, []);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filters.type !== 'all') count++;
    if (filters.categoryId !== null) count++;
    if (filters.sort !== 'newest') count++;
    if (filters.minAmount || filters.maxAmount) count++;
    return count;
  }, [filters]);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* ─── Top Header ─────────────────────────────────────────────────── */}
      <View style={styles.header}>
        <View style={styles.avatarWrap}>
          <Ionicons name="person-outline" size={16} color={EthosColors.onSurface} />
        </View>
        <Text style={styles.headerTitle}>Transactions</Text>
        <Pressable
          onPress={() => setShowSearchInput((prev) => !prev)}
          style={({ pressed }) => [styles.headerIconBtn, pressed && { opacity: 0.7 }]}
          accessibilityLabel="Search transactions"
        >
          <Ionicons
            name={showSearchInput ? 'close' : 'search-outline'}
            size={22}
            color={EthosColors.onSurface}
          />
        </Pressable>
      </View>

      {/* Optional Search Bar Input */}
      {showSearchInput && (
        <View style={styles.searchBarWrap}>
          <Ionicons name="search" size={18} color={EthosColors.outline} />
          <TextInput
            autoFocus
            value={search}
            onChangeText={setSearch}
            placeholder="Search merchant, notes, category..."
            placeholderTextColor={EthosColors.outline}
            style={styles.searchInput}
            returnKeyType="search"
          />
          {search.length > 0 && (
            <Pressable onPress={() => setSearch('')}>
              <Ionicons name="close-circle" size={18} color={EthosColors.outline} />
            </Pressable>
          )}
        </View>
      )}

      <SectionList
        sections={sectionedData}
        keyExtractor={(item) => item.id}
        initialNumToRender={15}
        maxToRenderPerBatch={10}
        windowSize={5}
        removeClippedSubviews={Platform.OS === 'android'}
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
          <View style={styles.summaryContainer}>
            {/* Month Header */}
            <Text style={styles.monthHeader}>{currentMonthLabel}</Text>

            {/* Total Spent Hero Card */}
            <View style={styles.summaryCard}>
              <Text style={styles.summaryLabel}>Total spent</Text>
              <Text style={styles.summaryAmount}>
                {formatCurrency(totalSpent, currencyCode)}
              </Text>
            </View>

            {/* Controls Bar (Search Pill & Filter Button) */}
            <View style={styles.controlsRow}>
              <Pressable
                onPress={() => setShowSearchInput(true)}
                style={({ pressed }) => [
                  styles.searchPill,
                  pressed && { opacity: 0.8 },
                ]}
              >
                <Ionicons name="search" size={14} color={EthosColors.onSurface} />
                <Text style={styles.searchPillText}>
                  {search ? search : 'Search'}
                </Text>
              </Pressable>

              <Pressable
                onPress={() => setShowFilterModal(true)}
                style={({ pressed }) => [
                  styles.filterBtn,
                  activeFilterCount > 0 && styles.activeFilterBtn,
                  pressed && { opacity: 0.8 },
                ]}
                accessibilityLabel="Filter transactions"
              >
                <Ionicons
                  name="options-outline"
                  size={20}
                  color={activeFilterCount > 0 ? EthosColors.onPrimary : EthosColors.onSurface}
                />
                {activeFilterCount > 0 && (
                  <View style={styles.filterBadge}>
                    <Text style={styles.filterBadgeText}>{activeFilterCount}</Text>
                  </View>
                )}
              </Pressable>
            </View>
          </View>
        }
        renderSectionHeader={({ section: { title } }) => (
          <View style={styles.sectionHeaderWrap}>
            <Text style={styles.sectionHeaderTitle}>{title}</Text>
          </View>
        )}
        renderItem={({ item, index, section }) => {
          const isIncome = item.type === 'income';
          const formattedAmount = `${isIncome ? '+' : '-'}${formatCurrency(
            item.amount,
            currencyCode
          )}`;
          const isLast = index === section.data.length - 1;

          return (
            <TransactionRow
              id={item.id}
              label={item.merchant || item.note || item.category_name}
              subLabel={item.category_name}
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
          loading ? (
            <View style={styles.emptyContainer}>
              <TransactionItemSkeleton />
              <TransactionItemSkeleton />
              <TransactionItemSkeleton />
            </View>
          ) : (
            <EmptyState
              icon="receipt-outline"
              title={search || activeFilterCount > 0 ? 'No matching transactions' : 'No transactions yet'}
              description={
                search || activeFilterCount > 0
                  ? 'Try clearing filters or changing your search criteria.'
                  : 'Tap the + button to add your first transaction.'
              }
              style={{ paddingVertical: EthosSpacing.stackLg }}
            />
          )
        }
      />

      {/* Filter Modal */}
      <TransactionFilterModal
        visible={showFilterModal}
        onClose={() => setShowFilterModal(false)}
        filters={filters}
        categories={catList}
        onApply={(newFilters) => setFilters(newFilters)}
        onReset={() => setFilters(DEFAULT_FILTERS)}
      />
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
  headerTitle: {
    ...EthosTypography.displayMd,
    fontSize: 24,
    fontWeight: '400',
    color: EthosColors.onSurface,
  },
  headerIconBtn: {
    padding: 4,
  },
  searchBarWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: EthosColors.surfaceContainerLow,
    marginHorizontal: EthosSpacing.containerPadding,
    marginBottom: EthosSpacing.stackSm,
    borderRadius: EthosRadius.full,
    paddingHorizontal: EthosSpacing.stackMd,
    height: 40,
    borderWidth: EthosBorder.width,
    borderColor: EthosBorder.color,
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    ...EthosTypography.bodyMd,
    color: EthosColors.onSurface,
  },
  listContent: {
    paddingBottom: 96,
  },
  summaryContainer: {
    paddingHorizontal: EthosSpacing.containerPadding,
    paddingTop: EthosSpacing.stackMd,
    paddingBottom: EthosSpacing.stackMd,
    gap: EthosSpacing.stackMd,
  },
  monthHeader: {
    ...EthosTypography.labelSm,
    color: EthosColors.outline,
    letterSpacing: EthosTypography.labelSm.letterSpacing,
  },
  summaryCard: {
    backgroundColor: EthosColors.surfaceContainerLowest,
    borderRadius: EthosRadius.lg,
    borderWidth: EthosBorder.width,
    borderColor: EthosBorder.color,
    padding: EthosSpacing.containerPadding,
    gap: EthosSpacing.unit,
  },
  summaryLabel: {
    ...EthosTypography.labelMd,
    color: EthosColors.outline,
  },
  summaryAmount: {
    ...EthosTypography.displayMd,
    color: EthosColors.onSurface,
    fontVariant: ['tabular-nums'],
  },
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  searchPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: EthosSpacing.unit,
    backgroundColor: EthosColors.surfaceContainerLowest,
    borderWidth: EthosBorder.width,
    borderColor: EthosBorder.color,
    borderRadius: EthosRadius.full,
    paddingHorizontal: EthosSpacing.containerPadding,
    paddingVertical: EthosSpacing.stackSm,
  },
  searchPillText: {
    ...EthosTypography.labelMd,
    color: EthosColors.onSurface,
  },
  filterBtn: {
    width: 40,
    height: 40,
    borderRadius: EthosRadius.full,
    backgroundColor: EthosColors.surfaceContainerLowest,
    borderWidth: EthosBorder.width,
    borderColor: EthosBorder.color,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeFilterBtn: {
    backgroundColor: EthosColors.primary,
    borderColor: EthosColors.primary,
  },
  filterBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: EthosColors.onTertiaryContainer,
    borderRadius: EthosRadius.full,
    width: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterBadgeText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  sectionHeaderWrap: {
    backgroundColor: EthosColors.surfaceContainerLow,
    paddingHorizontal: EthosSpacing.containerPadding,
    paddingVertical: 6,
    borderTopWidth: EthosBorder.width,
    borderBottomWidth: EthosBorder.width,
    borderColor: EthosBorder.color,
  },
  sectionHeaderTitle: {
    ...EthosTypography.labelSm,
    color: EthosColors.outline,
    letterSpacing: EthosTypography.labelSm.letterSpacing,
  },
  emptyContainer: {
    backgroundColor: EthosColors.surfaceContainerLowest,
    borderRadius: EthosRadius.lg,
    borderWidth: EthosBorder.width,
    borderColor: EthosBorder.color,
    marginHorizontal: EthosSpacing.containerPadding,
    overflow: 'hidden',
  },
});
