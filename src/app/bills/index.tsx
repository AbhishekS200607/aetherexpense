/**
 * AetherExpense — Ethos Bills & Reminders Screen
 *
 * Tracks upcoming bill obligations (Rent, Electricity, Subscriptions, EMIs).
 * Features Dashboard Summary metrics (TOTAL DUE, OVERDUE, DUE THIS WEEK, PAID THIS MONTH).
 * Supports filter tabs (All, Overdue, Due Soon, Upcoming, Paid).
 * Supports Mark Paid action:
 *   - Updates bill status (is_paid = 1, paid_date = todayISO())
 *   - Auto-generates expense transaction in SQLite transactions table (linked via bill_id & account_id)
 *   - Idempotent duplicate payment protection (prevents double payments)
 *   - Automatically computes next due occurrence for recurring bills
 * 100% offline local SQLite execution.
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
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSQLiteContext } from 'expo-sqlite';
import { eq, and } from 'drizzle-orm';

import { createDrizzleDB } from '@/database/client';
import { bills, categories, accounts, transactions } from '@/database/schema';
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
import { todayISO, nowISO, currentMonthRange } from '@/utils/dates';
import { generateUUID } from '@/utils/uuid';
import { calculateNextOccurrence } from '@/utils/recurring';
import { scheduleBillNotification, cancelBillNotification } from '@/utils/notifications';
import { EmptyState } from '@/components/ui/EmptyState';

type BillFilter = 'all' | 'overdue' | 'due_soon' | 'upcoming' | 'paid';

interface BillItem {
  id:                      string;
  name:                    string;
  amount:                  number;
  due_date:                string;
  frequency:               string;
  note:                    string | null;
  is_paid:                 number;
  paid_date:               string | null;
  auto_create_transaction: number;
  transaction_id:          string | null;
  notification_id:         string | null;
  category_id:             string | null;
  category_name:           string;
  category_icon:           string;
  account_id:              string | null;
  account_name:            string;
  statusTag:               'overdue' | 'due_soon' | 'upcoming' | 'paid';
  daysDiff:                number;
}

export default function BillsScreen() {
  const sqliteDb = useSQLiteContext();
  const currencyCode = useSettingsStore((s) => s.currency);
  const dataVersion = useAppStore((s) => s.dataVersion);
  const invalidateData = useAppStore((s) => s.invalidateData);

  const [billList, setBillList] = useState<BillItem[]>([]);
  const [filter, setFilter] = useState<BillFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadBillsData = useCallback(async () => {
    if (!sqliteDb) {
      setLoading(false);
      setRefreshing(false);
      return;
    }
    try {
      const db = createDrizzleDB(sqliteDb);
      const today = todayISO();
      const todayObj = new Date(today);

      const rows = await db
        .select({
          id:                      bills.id,
          name:                    bills.name,
          amount:                  bills.amount,
          due_date:                bills.due_date,
          frequency:               bills.frequency,
          note:                    bills.note,
          is_paid:                 bills.is_paid,
          paid_date:               bills.paid_date,
          auto_create_transaction: bills.auto_create_transaction,
          transaction_id:          bills.transaction_id,
          notification_id:         bills.notification_id,
          category_id:             bills.category_id,
          account_id:              bills.account_id,
          category_name:           categories.name,
          category_icon:           categories.icon,
          account_name:            accounts.name,
        })
        .from(bills)
        .leftJoin(categories, eq(bills.category_id, categories.id))
        .leftJoin(accounts, eq(bills.account_id, accounts.id))
        .where(eq(bills.is_active, 1));

      const items: BillItem[] = rows.map((b) => {
        const dueObj = new Date(b.due_date);
        const diffMs = dueObj.getTime() - todayObj.getTime();
        const daysDiff = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

        let statusTag: 'overdue' | 'due_soon' | 'upcoming' | 'paid' = 'upcoming';
        if (b.is_paid === 1) {
          statusTag = 'paid';
        } else if (daysDiff < 0) {
          statusTag = 'overdue';
        } else if (daysDiff <= 7) {
          statusTag = 'due_soon';
        } else {
          statusTag = 'upcoming';
        }

        return {
          id:                      b.id,
          name:                    b.name,
          amount:                  b.amount,
          due_date:                b.due_date,
          frequency:               b.frequency,
          note:                    b.note,
          is_paid:                 b.is_paid,
          paid_date:               b.paid_date,
          auto_create_transaction: b.auto_create_transaction,
          transaction_id:          b.transaction_id,
          notification_id:         b.notification_id,
          category_id:             b.category_id,
          category_name:           b.category_name || 'General',
          category_icon:           b.category_icon || 'receipt-outline',
          account_id:              b.account_id,
          account_name:            b.account_name || 'Account',
          statusTag,
          daysDiff,
        };
      });

      setBillList(items);
    } catch (err) {
      console.warn('[BillsScreen] Drizzle join failed, executing raw SQL fallback:', err);
      try {
        const today = todayISO();
        const todayObj = new Date(today);
        const rawRows = await sqliteDb.getAllAsync<any>(
          `SELECT b.id, b.name, b.amount, b.due_date, b.frequency, b.note, b.is_paid, b.paid_date, b.auto_create_transaction, b.transaction_id, b.category_id, b.account_id, c.name as category_name, c.icon as category_icon, a.name as account_name FROM bills b LEFT JOIN categories c ON b.category_id = c.id LEFT JOIN accounts a ON b.account_id = a.id WHERE b.is_active = 1 OR b.is_active IS NULL`
        );
        const fallbackItems: BillItem[] = (rawRows || []).map((b) => {
          const dueObj = new Date(b.due_date);
          const diffMs = dueObj.getTime() - todayObj.getTime();
          const daysDiff = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
          let statusTag: 'overdue' | 'due_soon' | 'upcoming' | 'paid' = 'upcoming';
          if (b.is_paid === 1) statusTag = 'paid';
          else if (daysDiff < 0) statusTag = 'overdue';
          else if (daysDiff <= 7) statusTag = 'due_soon';

          return {
            id:                      b.id,
            name:                    b.name,
            amount:                  b.amount,
            due_date:                b.due_date,
            frequency:               b.frequency,
            note:                    b.note,
            is_paid:                 b.is_paid,
            paid_date:               b.paid_date,
            auto_create_transaction: b.auto_create_transaction ?? 1,
            transaction_id:          b.transaction_id || null,
            notification_id:         null,
            category_id:             b.category_id,
            category_name:           b.category_name || 'General',
            category_icon:           b.category_icon || 'receipt-outline',
            account_id:              b.account_id,
            account_name:            b.account_name || 'Account',
            statusTag,
            daysDiff,
          };
        });
        setBillList(fallbackItems);
      } catch (fallbackErr) {
        console.error('[BillsScreen] Critical fallback error loading bills:', fallbackErr);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [sqliteDb]);

  useEffect(() => {
    setLoading(true);
    loadBillsData();
  }, [dataVersion, loadBillsData]);

  const onRefresh = () => {
    setRefreshing(true);
    loadBillsData();
  };

  // ─── Mark Bill Paid Handler (Option B: Mark Paid + Auto-Create Transaction) ────
  const handleMarkPaid = async (item: BillItem) => {
    if (item.is_paid === 1) return; // Prevent duplicate payment!

    try {
      const db = createDrizzleDB(sqliteDb);
      const today = todayISO();
      const now = nowISO();
      let createdTxnId: string | null = null;

      // Cancel pending local notification for paid bill
      try {
        await cancelBillNotification(item.notification_id);
      } catch (e) {
        console.warn('[BillsScreen] Notification cancel warning:', e);
      }

      // Option B: Auto-create expense transaction if enabled
      if (item.auto_create_transaction === 1) {
        // Resolve valid fallback category if null or empty
        let catId = item.category_id;
        if (!catId) {
          const cats = await db
            .select()
            .from(categories)
            .where(and(eq(categories.type, 'expense'), eq(categories.is_active, 1)))
            .limit(1);
          if (cats.length > 0) catId = cats[0].id;
        }

        // Resolve valid fallback account if null or empty
        let accId = item.account_id;
        if (!accId) {
          const accs = await db
            .select()
            .from(accounts)
            .where(eq(accounts.is_active, 1))
            .limit(1);
          if (accs.length > 0) accId = accs[0].id;
        }

        if (catId && accId) {
          createdTxnId = generateUUID();
          await db.insert(transactions).values({
            id:                     createdTxnId,
            type:                   'expense',
            amount:                 item.amount,
            category_id:            catId,
            account_id:             accId,
            transfer_to_account_id: null,
            date:                   today,
            time:                   '10:00',
            note:                   `Bill payment: ${item.name}`,
            merchant:               item.name,
            payment_method:         'cash',
            is_recurring:           0,
            recurring_id:           null,
            bill_id:                item.id,
            created_at:             now,
            updated_at:             now,
          });
        }
      }

      // Mark current bill as paid
      await db
        .update(bills)
        .set({
          is_paid:        1,
          paid_date:      today,
          transaction_id: createdTxnId,
          notification_id:null,
          updated_at:     now,
        })
        .where(eq(bills.id, item.id));

      // If bill is recurring (frequency !== 'one_time'), automatically schedule next occurrence
      if (item.frequency !== 'one_time') {
        const nextDueDate = calculateNextOccurrence(item.due_date, item.frequency as any);
        const nextBillId = generateUUID();
        const formattedAmt = formatCurrency(item.amount, currencyCode);

        // Schedule local notification for next occurrence safely
        let nextNotifId: string | null = null;
        try {
          nextNotifId = await scheduleBillNotification(
            nextBillId,
            item.name,
            formattedAmt,
            nextDueDate,
            1
          );
        } catch (e) {
          console.warn('[BillsScreen] Next notification schedule warning:', e);
        }

        await db.insert(bills).values({
          id:                      nextBillId,
          name:                    item.name,
          amount:                  item.amount,
          category_id:             item.category_id,
          account_id:              item.account_id,
          due_date:                nextDueDate,
          frequency:               item.frequency as any,
          note:                    item.note,
          is_paid:                 0,
          paid_date:               null,
          auto_create_transaction: item.auto_create_transaction,
          transaction_id:          null,
          is_active:               1,
          reminder_days_before:    1,
          notification_id:         nextNotifId,
          recurring_id:            null,
          created_at:              now,
          updated_at:              now,
        });
      }

      loadBillsData();
      invalidateData();
    } catch (err) {
      console.error('[BillsScreen] Mark paid error:', err);
      Alert.alert('Error', 'Could not mark bill as paid.');
    }
  };

  const handleDeleteBill = (billId: string, billName: string, notifId: string | null) => {
    Alert.alert(
      'Delete Bill Reminder?',
      `Are you sure you want to delete "${billName}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            if (!sqliteDb) return;
            try {
              const db = createDrizzleDB(sqliteDb);

              // Cancel pending notification
              await cancelBillNotification(notifId);

              // Unlink transactions pointing to this bill
              await db
                .update(transactions)
                .set({ bill_id: null })
                .where(eq(transactions.bill_id, billId));

              // Delete bill record
              await db.delete(bills).where(eq(bills.id, billId));

              loadBillsData();
              invalidateData();
            } catch (err) {
              console.error('[BillsScreen] Error deleting bill:', err);
              Alert.alert('Error', 'Could not delete bill.');
            }
          },
        },
      ]
    );
  };

  // Dashboard Metrics Computations
  const { from: monthFrom, to: monthTo } = currentMonthRange();

  const totalDue = useMemo(
    () => billList.filter((b) => b.is_paid === 0).reduce((sum, b) => sum + b.amount, 0),
    [billList]
  );
  const overdueTotal = useMemo(
    () => billList.filter((b) => b.statusTag === 'overdue').reduce((sum, b) => sum + b.amount, 0),
    [billList]
  );
  const dueThisWeekTotal = useMemo(
    () => billList.filter((b) => b.statusTag === 'due_soon').reduce((sum, b) => sum + b.amount, 0),
    [billList]
  );
  const paidThisMonthTotal = useMemo(
    () =>
      billList
        .filter((b) => b.is_paid === 1 && b.paid_date && b.paid_date >= monthFrom && b.paid_date <= monthTo)
        .reduce((sum, b) => sum + b.amount, 0),
    [billList, monthFrom, monthTo]
  );

  // Filtered Bills List
  const filteredBills = useMemo(() => {
    return billList.filter((b) => {
      // Tab filter
      if (filter === 'overdue' && b.statusTag !== 'overdue') return false;
      if (filter === 'due_soon' && b.statusTag !== 'due_soon') return false;
      if (filter === 'upcoming' && b.statusTag !== 'upcoming') return false;
      if (filter === 'paid' && b.statusTag !== 'paid') return false;

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = b.name.toLowerCase().includes(q);
        const matchesCat = b.category_name.toLowerCase().includes(q);
        return matchesName || matchesCat;
      }
      return true;
    });
  }, [billList, filter, searchQuery]);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* ─── Top Navigation Header ────────────────────────────────────────── */}
      <View style={styles.navbar}>
        <View style={styles.navLeft}>
          <Pressable onPress={() => router.back()} style={styles.navBtn}>
            <Ionicons name="arrow-back" size={24} color={EthosColors.onSurface} />
          </Pressable>
          <Text style={styles.navTitle}>Bills & Reminders</Text>
        </View>

        <View style={styles.navRight}>
          <Pressable onPress={() => setShowSearch(!showSearch)} style={styles.navBtn}>
            <Ionicons name="search" size={22} color={EthosColors.onSurface} />
          </Pressable>
          <Pressable
            id="add-bill-header-btn"
            onPress={() => router.push('/bills/add' as any)}
            style={({ pressed }) => [styles.navBtn, pressed && { opacity: 0.7 }]}
          >
            <Ionicons name="add" size={26} color={EthosColors.onSurface} />
          </Pressable>
        </View>
      </View>

      {/* Optional Search Bar */}
      {showSearch && (
        <View style={styles.searchBarWrap}>
          <Ionicons name="search" size={18} color={EthosColors.outline} />
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search bills..."
            placeholderTextColor={EthosColors.outline}
            style={styles.searchInput}
          />
          {searchQuery !== '' && (
            <Pressable onPress={() => setSearchQuery('')}>
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
        {/* ─── Dashboard Summary Hero Cards Grid ──────────────────────────── */}
        <View style={styles.metricsGrid}>
          <View style={styles.metricCard}>
            <Text style={styles.metricLabel}>TOTAL DUE</Text>
            <Text style={[styles.metricValue, { color: EthosColors.primary }]}>
              {formatCurrency(totalDue, currencyCode)}
            </Text>
          </View>

          <View style={styles.metricCard}>
            <Text style={styles.metricLabel}>OVERDUE</Text>
            <Text style={[styles.metricValue, { color: EthosColors.error }]}>
              {formatCurrency(overdueTotal, currencyCode)}
            </Text>
          </View>

          <View style={styles.metricCard}>
            <Text style={styles.metricLabel}>DUE THIS WEEK</Text>
            <Text style={[styles.metricValue, { color: '#D97706' }]}>
              {formatCurrency(dueThisWeekTotal, currencyCode)}
            </Text>
          </View>

          <View style={styles.metricCard}>
            <Text style={styles.metricLabel}>PAID THIS MONTH</Text>
            <Text style={[styles.metricValue, { color: '#059669' }]}>
              {formatCurrency(paidThisMonthTotal, currencyCode)}
            </Text>
          </View>
        </View>

        {/* ─── Filter Segmented Control Tabs ──────────────────────────────── */}
        <View style={styles.filterTabsRow}>
          {[
            { id: 'all',      label: 'All' },
            { id: 'overdue',  label: 'Overdue' },
            { id: 'due_soon', label: 'Due Soon' },
            { id: 'upcoming', label: 'Upcoming' },
            { id: 'paid',     label: 'Paid' },
          ].map((tab) => {
            const active = filter === tab.id;
            return (
              <Pressable
                key={tab.id}
                id={`filter-tab-${tab.id}`}
                onPress={() => setFilter(tab.id as BillFilter)}
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

        {/* ─── Bills Cards List Container ─────────────────────────────────── */}
        <View style={styles.bentoCardList}>
          {filteredBills.length === 0 ? (
            <EmptyState
              icon="receipt-outline"
              title="No bills found"
              description="Keep track of recurring electricity, rent, internet, or subscription bills."
              actionLabel="Add Bill"
              onAction={() => router.push('/bills/add' as any)}
              style={{ paddingVertical: EthosSpacing.stackLg }}
            />
          ) : (
            filteredBills.map((item, index) => {
              const isLast = index === filteredBills.length - 1;

              return (
                <Pressable
                  key={item.id}
                  id={`bill-item-${item.id}`}
                  onPress={() => router.push(`/bills/edit/${item.id}` as any)}
                  style={({ pressed }) => [
                    styles.billRow,
                    item.statusTag === 'overdue' && styles.overdueRowBg,
                    !isLast && styles.rowBorderBottom,
                    pressed && { backgroundColor: EthosColors.surfaceContainerLow },
                  ]}
                >
                  <View style={styles.billLeft}>
                    <View style={styles.iconChip}>
                      <Ionicons
                        name={(item.category_icon || 'receipt-outline') as any}
                        size={22}
                        color={EthosColors.primary}
                      />
                    </View>

                    <View style={{ gap: 2, flex: 1 }}>
                      <Text style={styles.billName} numberOfLines={1}>{item.name}</Text>
                      <Text style={styles.billSubtext} numberOfLines={1}>
                        {item.category_name} • {item.account_name}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.billRight}>
                    <View style={{ alignItems: 'flex-end', gap: 2 }}>
                      <Text style={styles.billAmount}>
                        {formatCurrency(item.amount, currencyCode)}
                      </Text>

                      {/* Status Badge or Mark Paid Action */}
                      {item.is_paid === 1 ? (
                        <View style={[styles.statusBadge, styles.paidBadge]}>
                          <Ionicons name="checkmark-circle" size={12} color="#059669" />
                          <Text style={styles.paidBadgeText}>PAID</Text>
                        </View>
                      ) : item.statusTag === 'overdue' ? (
                        <Pressable
                          onPress={() => handleMarkPaid(item)}
                          style={[styles.statusBadge, styles.overdueBadge]}
                        >
                          <Text style={styles.overdueBadgeText}>
                            {Math.abs(item.daysDiff)}d OVERDUE • MARK PAID
                          </Text>
                        </Pressable>
                      ) : (
                        <Pressable
                          onPress={() => handleMarkPaid(item)}
                          style={[styles.statusBadge, styles.payActionBadge]}
                        >
                          <Text style={styles.payActionBadgeText}>MARK PAID</Text>
                        </Pressable>
                      )}
                    </View>

                    <Pressable
                      onPress={(e) => {
                        e.stopPropagation();
                        handleDeleteBill(item.id, item.name, item.notification_id);
                      }}
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
  navRight: {
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
  searchBarWrap: {
    flexDirection:     'row',
    alignItems:        'center',
    backgroundColor:   EthosColors.surfaceContainerLowest,
    borderBottomWidth: EthosBorder.width,
    borderBottomColor: EthosBorder.color,
    paddingHorizontal: EthosSpacing.containerPadding,
    paddingVertical:   EthosSpacing.stackSm,
    gap:               EthosSpacing.stackSm,
  },
  searchInput: {
    ...EthosTypography.bodyMd,
    flex:  1,
    color: EthosColors.onSurface,
  },
  scrollContent: {
    paddingHorizontal: EthosSpacing.containerPadding,
    paddingTop:        EthosSpacing.stackMd,
    paddingBottom:     96,
    gap:               EthosSpacing.stackLg,
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap:      'wrap',
    gap:           EthosSpacing.stackSm,
  },
  metricCard: {
    width:           '48%',
    backgroundColor: EthosColors.surfaceContainerLowest,
    borderRadius:    EthosRadius.lg,
    borderWidth:     EthosBorder.width,
    borderColor:     EthosBorder.color,
    padding:         EthosSpacing.stackMd,
    gap:             4,
  },
  metricLabel: {
    ...EthosTypography.labelSm,
    color:         EthosColors.outline,
    letterSpacing: 1,
  },
  metricValue: {
    ...EthosTypography.headlineLg,
    fontSize:    18,
    fontWeight:  '600',
    fontVariant: ['tabular-nums'],
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
  bentoCardList: {
    backgroundColor: EthosColors.surfaceContainerLowest,
    borderRadius:    EthosRadius.lg,
    borderWidth:     EthosBorder.width,
    borderColor:     EthosBorder.color,
    overflow:        'hidden',
  },
  billRow: {
    flexDirection:     'row',
    alignItems:        'center',
    justifyContent:    'space-between',
    paddingHorizontal: EthosSpacing.containerPadding,
    paddingVertical:   EthosSpacing.stackMd,
  },
  overdueRowBg: {
    backgroundColor: 'rgba(186, 26, 26, 0.04)',
  },
  rowBorderBottom: {
    borderBottomWidth: EthosBorder.width,
    borderBottomColor: EthosBorder.color,
  },
  billLeft: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           EthosSpacing.stackMd,
    flex:          1,
  },
  iconChip: {
    width:           44,
    height:          44,
    borderRadius:    EthosRadius.md,
    backgroundColor: EthosColors.surfaceContainer,
    alignItems:      'center',
    justifyContent:  'center',
  },
  billName: {
    ...EthosTypography.bodyMd,
    fontWeight: '500',
    color:      EthosColors.primary,
  },
  billSubtext: {
    ...EthosTypography.labelSm,
    color: EthosColors.outline,
  },
  billRight: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           4,
  },
  billAmount: {
    ...EthosTypography.bodyMd,
    fontWeight:  '500',
    color:       EthosColors.primary,
    fontVariant: ['tabular-nums'],
  },
  statusBadge: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               4,
    paddingHorizontal: EthosSpacing.stackSm + 2,
    paddingVertical:   3,
    borderRadius:      EthosRadius.full,
  },
  paidBadge: {
    backgroundColor: 'rgba(5, 150, 105, 0.12)',
  },
  paidBadgeText: {
    ...EthosTypography.labelSm,
    color:      '#059669',
    fontWeight: '600',
  },
  overdueBadge: {
    backgroundColor: 'rgba(186, 26, 26, 0.15)',
  },
  overdueBadgeText: {
    ...EthosTypography.labelSm,
    color:      EthosColors.error,
    fontWeight: '600',
  },
  payActionBadge: {
    backgroundColor: EthosColors.primary,
  },
  payActionBadgeText: {
    ...EthosTypography.labelSm,
    color:      EthosColors.onPrimary,
    fontWeight: '600',
  },
});
