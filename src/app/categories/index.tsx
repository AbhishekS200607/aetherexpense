/**
 * AetherExpense — Ethos Categories List Screen
 *
 * Implements Stitch `categories` visual source of truth:
 *   - Header with Back button & Search
 *   - EXPENSE / INCOME segmented tabs
 *   - Dynamic transaction count & total spent/received per category
 *   - Category row cards with circular icon chips & hairline dividers
 *   - Search input for filtering categories by name
 *   - Add Category pill CTA button
 *   - 100% local SQLite queries via Drizzle ORM
 */

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  TextInput,
  StyleSheet,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSQLiteContext } from 'expo-sqlite';
import { eq, desc } from 'drizzle-orm';

import { createDrizzleDB } from '@/database/client';
import { categories, transactions } from '@/database/schema';
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
import type { CategoryRow } from '@/database/schema';
import { EmptyState } from '@/components/ui/EmptyState';

interface CategoryStats {
  id:          string;
  name:        string;
  type:        'income' | 'expense';
  icon:        string;
  color:       string;
  is_default:  number;
  is_active:   number;
  sort_order:  number;
  txnCount:    number;
  totalAmount: number;
}

export default function CategoriesScreen() {
  const sqliteDb = useSQLiteContext();
  const currencyCode = useSettingsStore((s) => s.currency);
  const dataVersion = useAppStore((s) => s.dataVersion);

  const [allCats, setAllCats] = useState<CategoryRow[]>([]);
  const [txnList, setTxnList] = useState<Array<{ category_id: string; amount: number; type: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Filters & Tabs
  const [activeType, setActiveType] = useState<'expense' | 'income'>('expense');
  const [search, setSearch] = useState('');
  const [showSearch, setShowSearch] = useState(false);

  const fetchCategories = useCallback(async () => {
    try {
      const db = createDrizzleDB(sqliteDb);

      // Query active categories
      const catRows = await db
        .select()
        .from(categories)
        .where(eq(categories.is_active, 1))
        .orderBy(categories.sort_order, categories.name);

      setAllCats(catRows);

      // Query transactions for counts and sums
      const txns = await db
        .select({
          category_id: transactions.category_id,
          amount:      transactions.amount,
          type:        transactions.type,
        })
        .from(transactions);

      setTxnList(txns);
    } catch (err) {
      console.error('[CategoriesScreen] Error:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [sqliteDb]);

  useEffect(() => {
    setLoading(true);
    fetchCategories();
  }, [dataVersion, fetchCategories]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchCategories();
  };

  // Map category stats (count & total amount)
  const categoryStatsList = useMemo<CategoryStats[]>(() => {
    const map = new Map<string, { count: number; total: number }>();

    for (const t of txnList) {
      if (!map.has(t.category_id)) {
        map.set(t.category_id, { count: 0, total: 0 });
      }
      const entry = map.get(t.category_id)!;
      entry.count += 1;
      entry.total += t.amount;
    }

    return allCats.map((c) => {
      const stats = map.get(c.id) || { count: 0, total: 0 };
      return {
        ...c,
        txnCount: stats.count,
        totalAmount: stats.total,
      };
    });
  }, [allCats, txnList]);

  // Filter by Expense vs Income and Search text
  const filteredCategories = useMemo(() => {
    return categoryStatsList.filter((c) => {
      if (c.type !== activeType) return false;
      if (search.trim()) {
        return c.name.toLowerCase().includes(search.toLowerCase().trim());
      }
      return true;
    });
  }, [categoryStatsList, activeType, search]);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* ─── Top Navigation Header ────────────────────────────────────────── */}
      <View style={styles.navbar}>
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [styles.navBtn, pressed && { opacity: 0.7 }]}
          accessibilityLabel="Back"
        >
          <Ionicons name="arrow-back" size={24} color={EthosColors.onSurface} />
        </Pressable>
        <Text style={styles.navTitle}>Categories</Text>
        <Pressable
          onPress={() => setShowSearch((prev) => !prev)}
          style={({ pressed }) => [styles.navBtn, pressed && { opacity: 0.7 }]}
          accessibilityLabel="Search categories"
        >
          <Ionicons
            name={showSearch ? 'close' : 'search-outline'}
            size={22}
            color={EthosColors.onSurface}
          />
        </Pressable>
      </View>

      {/* Search Input Bar */}
      {showSearch && (
        <View style={styles.searchBarWrap}>
          <Ionicons name="search" size={18} color={EthosColors.outline} />
          <TextInput
            autoFocus
            value={search}
            onChangeText={setSearch}
            placeholder="Search categories..."
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
        {/* ─── Segmented Tabs (EXPENSE / INCOME) ────────────────────────── */}
        <View style={styles.segmentedContainer}>
          <Pressable
            id="tab-expense-categories"
            onPress={() => setActiveType('expense')}
            style={[
              styles.segmentBtn,
              activeType === 'expense' && styles.segmentBtnActive,
            ]}
          >
            <Text
              style={[
                styles.segmentText,
                activeType === 'expense' && styles.segmentTextActive,
              ]}
            >
              EXPENSE
            </Text>
          </Pressable>

          <Pressable
            id="tab-income-categories"
            onPress={() => setActiveType('income')}
            style={[
              styles.segmentBtn,
              activeType === 'income' && styles.segmentBtnActive,
            ]}
          >
            <Text
              style={[
                styles.segmentText,
                activeType === 'income' && styles.segmentTextActive,
              ]}
            >
              INCOME
            </Text>
          </Pressable>
        </View>

        {/* ─── Categories Bento Card Container ────────────────────────────── */}
        <View style={styles.categoriesCardContainer}>
          {filteredCategories.length === 0 ? (
            <EmptyState
              icon="pricetag-outline"
              title={search ? 'No matching categories' : 'No categories found'}
              description={
                search
                  ? `No category matching "${search}".`
                  : `Tap Add Category below to create your first ${activeType} category.`
              }
              style={{ paddingVertical: EthosSpacing.stackLg }}
            />
          ) : (
            filteredCategories.map((cat, index) => {
              const isLast = index === filteredCategories.length - 1;
              return (
                <Pressable
                  key={cat.id}
                  id={`category-item-${cat.id}`}
                  onPress={() => router.push(`/categories/edit/${cat.id}` as any)}
                  style={({ pressed }) => [
                    styles.catRow,
                    !isLast && styles.catRowBorder,
                    pressed && styles.catRowPressed,
                  ]}
                >
                  {/* Left Icon Wrap */}
                  <View style={[styles.iconWrap, { backgroundColor: `${cat.color}15` }]}>
                    <Ionicons
                      name={(cat.icon || 'restaurant') as any}
                      size={22}
                      color={cat.color}
                    />
                  </View>

                  {/* Body Title & Txn Count */}
                  <View style={styles.catBody}>
                    <Text style={styles.catName} numberOfLines={1}>
                      {cat.name}
                    </Text>
                    <Text style={styles.catSubtext}>
                      {cat.txnCount === 1 ? '1 transaction' : `${cat.txnCount} transactions`}
                    </Text>
                  </View>

                  {/* Right Amount */}
                  <View style={styles.catRight}>
                    <Text style={styles.catAmountText}>
                      {formatCurrency(cat.totalAmount, currencyCode)}
                    </Text>
                    <Ionicons name="chevron-forward" size={16} color={EthosColors.outline} />
                  </View>
                </Pressable>
              );
            })
          )}
        </View>

        {/* ─── Centered Add Category CTA Button ──────────────────────────── */}
        <View style={styles.ctaWrap}>
          <Pressable
            id="add-category-btn"
            onPress={() => router.push({ pathname: '/categories/add' as any, params: { type: activeType } })}
            style={({ pressed }) => [
              styles.addBtn,
              pressed && { opacity: 0.9, transform: [{ scale: 0.97 }] },
            ]}
          >
            <Ionicons name="add" size={18} color={EthosColors.onPrimary} />
            <Text style={styles.addBtnText}>Add Category</Text>
          </Pressable>
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
  searchBarWrap: {
    flexDirection:     'row',
    alignItems:        'center',
    backgroundColor:   EthosColors.surfaceContainerLow,
    marginHorizontal:  EthosSpacing.containerPadding,
    marginBottom:      EthosSpacing.stackSm,
    borderRadius:      EthosRadius.full,
    paddingHorizontal: EthosSpacing.stackMd,
    height:            40,
    borderWidth:       EthosBorder.width,
    borderColor:       EthosBorder.color,
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    ...EthosTypography.bodyMd,
    color: EthosColors.onSurface,
  },
  scrollContent: {
    paddingHorizontal: EthosSpacing.containerPadding,
    paddingTop:        EthosSpacing.stackLg,
    paddingBottom:     96,
    gap:               EthosSpacing.stackLg,
  },
  segmentedContainer: {
    flexDirection:   'row',
    backgroundColor: EthosColors.surfaceContainerHigh,
    borderRadius:    EthosRadius.full,
    padding:         4,
  },
  segmentBtn: {
    flex:            1,
    paddingVertical: EthosSpacing.unit,
    borderRadius:    EthosRadius.full,
    alignItems:      'center',
    justifyContent:  'center',
  },
  segmentBtnActive: {
    backgroundColor: EthosColors.surfaceContainerLowest,
    shadowColor:     '#000',
    shadowOffset:    { width: 0, height: 1 },
    shadowOpacity:   0.1,
    shadowRadius:    2,
    elevation:       2,
  },
  segmentText: {
    ...EthosTypography.labelMd,
    color: EthosColors.outline,
  },
  segmentTextActive: {
    color:      EthosColors.primary,
    fontWeight: '600',
  },
  categoriesCardContainer: {
    backgroundColor: EthosColors.surfaceContainerLowest,
    borderRadius:    EthosRadius.lg,
    borderWidth:     EthosBorder.width,
    borderColor:     EthosBorder.color,
    overflow:        'hidden',
  },
  catRow: {
    flexDirection:     'row',
    alignItems:        'center',
    paddingVertical:   EthosSpacing.stackMd,
    paddingHorizontal: EthosSpacing.containerPadding,
    backgroundColor:   EthosColors.surfaceContainerLowest,
  },
  catRowBorder: {
    borderBottomWidth: EthosBorder.width,
    borderBottomColor: EthosColors.secondaryContainer,
  },
  catRowPressed: {
    backgroundColor: EthosColors.surfaceContainerLow,
  },
  iconWrap: {
    width:           44,
    height:          44,
    borderRadius:    EthosRadius.full,
    alignItems:      'center',
    justifyContent:  'center',
    marginRight:     EthosSpacing.gutter,
  },
  catBody: {
    flex: 1,
    gap:  2,
  },
  catName: {
    ...EthosTypography.bodyMd,
    fontWeight: '500',
    color:      EthosColors.onSurface,
  },
  catSubtext: {
    ...EthosTypography.labelSm,
    color: EthosColors.outline,
  },
  catRight: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           6,
  },
  catAmountText: {
    ...EthosTypography.bodyMd,
    fontWeight: '500',
    color:      EthosColors.onSurface,
    fontVariant: ['tabular-nums'],
  },
  ctaWrap: {
    alignItems:     'center',
    justifyContent: 'center',
    marginTop:      EthosSpacing.stackSm,
  },
  addBtn: {
    flexDirection:   'row',
    alignItems:      'center',
    gap:             6,
    backgroundColor: EthosColors.primary,
    paddingHorizontal: EthosSpacing.containerPadding,
    paddingVertical:   EthosSpacing.stackMd,
    borderRadius:    EthosRadius.full,
  },
  addBtnText: {
    ...EthosTypography.labelMd,
    color:      EthosColors.onPrimary,
    fontWeight: '600',
  },
});
