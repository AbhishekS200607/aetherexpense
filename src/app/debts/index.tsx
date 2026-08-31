/**
 * AetherExpense — Debts & Loans Dashboard Screen
 *
 * Dedicated module for tracking pending cash flow (IOUs, freelance invoices, borrowings).
 * Features Ethos Design System summary cards, filter tabs, progress bars, and status badges.
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSQLiteContext } from 'expo-sqlite';

import {
  EthosColors,
  EthosTypography,
  EthosSpacing,
  EthosRadius,
  EthosBorder,
} from '@/theme/ethos';
import { useSettingsStore } from '@/store/settingsStore';
import { useAppStore } from '@/store/appStore';
import { createDrizzleDB } from '@/database/client';
import { formatCurrency } from '@/utils/currency';
import { todayISO } from '@/utils/dates';
import { getDebtsList, getDebtsSummary } from '@/utils/debts';
import type { Debt, DebtsSummary } from '@/types/debts';

type FilterTab = 'ALL' | 'LENT' | 'BORROWED' | 'SETTLED';

export default function DebtsDashboardScreen() {
  const sqliteDb = useSQLiteContext();
  const currencyCode = useSettingsStore((s) => s.currency);
  const dataVersion = useAppStore((s) => s.dataVersion);

  const [activeTab, setActiveTab] = useState<FilterTab>('ALL');
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<DebtsSummary | null>(null);
  const [debtsList, setDebtsList] = useState<Debt[]>([]);

  useEffect(() => {
    async function loadData() {
      if (!sqliteDb) return;
      try {
        const db = createDrizzleDB(sqliteDb);
        const [sumRes, listRes] = await Promise.all([
          getDebtsSummary(db),
          getDebtsList(db, activeTab),
        ]);
        setSummary(sumRes);
        setDebtsList(listRes);
      } catch (err) {
        console.error('[Debts] Error loading dashboard:', err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [sqliteDb, dataVersion, activeTab]);

  const today = todayISO();

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Header Bar */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.navBtn} hitSlop={8}>
          <Ionicons name="arrow-back" size={22} color={EthosColors.onSurface} />
        </Pressable>
        <Text style={styles.headerTitle}>Debts & Loans</Text>

        <Pressable
          onPress={() => router.push('/debts/add' as any)}
          style={styles.addNavBtn}
          hitSlop={8}
        >
          <Ionicons name="add" size={22} color={EthosColors.primary} />
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ─── Summary Cards Bento ──────────────────────────────────────── */}
        {summary && (
          <View style={styles.summaryWrap}>
            {/* Top Main Cards: Owed to Me vs I Owe */}
            <View style={styles.summaryRow}>
              {/* Owed to Me (Lent) */}
              <View style={[styles.summaryCard, { borderColor: '#10B98130' }]}>
                <View style={styles.cardHeaderRow}>
                  <Text style={styles.cardLabel}>OWED TO YOU</Text>
                  <View style={[styles.iconChip, { backgroundColor: '#10B98115' }]}>
                    <Ionicons name="arrow-down" size={16} color="#10B981" />
                  </View>
                </View>
                <Text style={[styles.cardVal, { color: '#059669' }]}>
                  {formatCurrency(summary.totalLent, currencyCode)}
                </Text>
                <Text style={styles.cardSubtext}>
                  {summary.activeLentCount} active receivables
                </Text>
              </View>

              {/* You Owe (Borrowed) */}
              <View style={[styles.summaryCard, { borderColor: 'rgba(239, 68, 68, 0.3)' }]}>
                <View style={styles.cardHeaderRow}>
                  <Text style={styles.cardLabel}>YOU OWE</Text>
                  <View style={[styles.iconChip, { backgroundColor: 'rgba(239, 68, 68, 0.12)' }]}>
                    <Ionicons name="arrow-up" size={16} color={EthosColors.error} />
                  </View>
                </View>
                <Text style={[styles.cardVal, { color: EthosColors.error }]}>
                  {formatCurrency(summary.totalBorrowed, currencyCode)}
                </Text>
                <Text style={styles.cardSubtext}>
                  {summary.activeBorrowCount} active liabilities
                </Text>
              </View>
            </View>

            {/* Net Position Banner */}
            <View style={styles.netBanner}>
              <View style={{ gap: 2 }}>
                <Text style={styles.netLabel}>NET OUTSTANDING POSITION</Text>
                <Text style={[
                  styles.netVal,
                  summary.netPosition >= 0 ? { color: '#059669' } : { color: EthosColors.error }
                ]}>
                  {summary.netPosition >= 0 ? '+' : ''}
                  {formatCurrency(summary.netPosition, currencyCode)}
                </Text>
              </View>
              {summary.overdueCount > 0 && (
                <View style={styles.overdueBadge}>
                  <Ionicons name="alert-circle" size={14} color={EthosColors.error} />
                  <Text style={styles.overdueBadgeText}>{summary.overdueCount} Overdue</Text>
                </View>
              )}
            </View>
          </View>
        )}

        {/* ─── Segmented Filter Tabs ───────────────────────────────────── */}
        <View style={styles.tabBar}>
          {[
            { id: 'ALL',      label: 'All' },
            { id: 'LENT',     label: 'Owed to Me' },
            { id: 'BORROWED', label: 'I Owe' },
            { id: 'SETTLED',  label: 'Settled' },
          ].map((t) => {
            const active = activeTab === t.id;
            return (
              <Pressable
                key={t.id}
                onPress={() => setActiveTab(t.id as FilterTab)}
                style={[styles.tabBtn, active && styles.tabBtnActive]}
              >
                <Text style={[styles.tabText, active && styles.tabTextActive]}>
                  {t.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* ─── Debt List View ───────────────────────────────────────────── */}
        {loading ? (
          <ActivityIndicator size="large" color={EthosColors.primary} style={{ marginTop: 32 }} />
        ) : debtsList.length === 0 ? (
          <View style={styles.emptyWrap}>
            <Ionicons name="cash-outline" size={40} color={EthosColors.outline} />
            <Text style={styles.emptyTitle}>No Records Found</Text>
            <Text style={styles.emptySubtext}>
              {activeTab === 'ALL'
                ? 'Track money you borrow or lend out to clients & friends.'
                : `No records in ${activeTab.toLowerCase()} category.`}
            </Text>
            <Pressable
              onPress={() => router.push('/debts/add' as any)}
              style={styles.emptyAddBtn}
            >
              <Ionicons name="add" size={18} color="#FFFFFF" />
              <Text style={styles.emptyAddText}>Add Debt or Loan</Text>
            </Pressable>
          </View>
        ) : (
          <View style={{ gap: EthosSpacing.stackMd }}>
            {debtsList.map((item) => {
              const isLent = item.type === 'LENT';
              const isSettled = item.status === 'SETTLED';
              const isOverdue = item.dueDate && item.dueDate < today && !isSettled;

              const paidAmount = item.totalAmount - item.remainingAmount;
              const progressPct = item.totalAmount > 0
                ? Math.min(100, Math.round((paidAmount / item.totalAmount) * 100))
                : 0;

              return (
                <Pressable
                  key={item.id}
                  onPress={() => router.push(`/debts/${item.id}` as any)}
                  style={({ pressed }) => [
                    styles.bentoCard,
                    pressed && styles.bentoCardPressed,
                  ]}
                >
                  {/* Top Line: Badge + Title + Amount */}
                  <View style={styles.cardTopRow}>
                    <View style={{ flex: 1, gap: 4 }}>
                      <View style={styles.badgeRow}>
                        <View style={[
                          styles.typeBadge,
                          isLent ? { backgroundColor: '#10B98115' } : { backgroundColor: 'rgba(239, 68, 68, 0.12)' }
                        ]}>
                          <Text style={[
                            styles.typeBadgeText,
                            isLent ? { color: '#059669' } : { color: EthosColors.error }
                          ]}>
                            {isLent ? 'OWED TO YOU' : 'YOU OWE'}
                          </Text>
                        </View>

                        {isSettled ? (
                          <View style={styles.settledBadge}>
                            <Ionicons name="checkmark-circle" size={12} color="#059669" />
                            <Text style={styles.settledText}>SETTLED</Text>
                          </View>
                        ) : isOverdue ? (
                          <View style={styles.overdueChip}>
                            <Ionicons name="time-outline" size={12} color={EthosColors.error} />
                            <Text style={styles.overdueChipText}>OVERDUE</Text>
                          </View>
                        ) : null}
                      </View>

                      <Text style={styles.itemTitle}>{item.title}</Text>
                      <Text style={styles.itemPerson}>With {item.personName}</Text>
                    </View>

                    <View style={{ alignItems: 'flex-end', gap: 2 }}>
                      <Text style={styles.remainingVal}>
                        {formatCurrency(item.remainingAmount, currencyCode)}
                      </Text>
                      <Text style={styles.totalVal}>
                        of {formatCurrency(item.totalAmount, currencyCode)}
                      </Text>
                    </View>
                  </View>

                  {/* Progress Bar */}
                  <View style={styles.progressWrap}>
                    <View style={styles.progressTrack}>
                      <View style={[
                        styles.progressFill,
                        { width: `${progressPct}%` },
                        isSettled ? { backgroundColor: '#10B981' } : { backgroundColor: EthosColors.primary }
                      ]} />
                    </View>
                    <Text style={styles.progressPctText}>{progressPct}% Paid</Text>
                  </View>

                  {/* Footer: Due Date & Arrow */}
                  <View style={styles.cardFooter}>
                    <Text style={styles.dueDateText}>
                      {item.dueDate ? `Due: ${item.dueDate}` : 'No Due Date'}
                    </Text>
                    <Ionicons name="chevron-forward" size={16} color={EthosColors.outline} />
                  </View>
                </Pressable>
              );
            })}
          </View>
        )}
      </ScrollView>

      {/* Floating Add Button */}
      <Pressable
        onPress={() => router.push('/debts/add' as any)}
        style={({ pressed }) => [
          styles.fabBtn,
          pressed && { opacity: 0.9 },
        ]}
      >
        <Ionicons name="add" size={24} color="#FFFFFF" />
        <Text style={styles.fabText}>Add Record</Text>
      </Pressable>
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
    borderBottomWidth: EthosBorder.width,
    borderBottomColor: EthosBorder.color,
  },
  navBtn: {
    padding: 4,
  },
  addNavBtn: {
    padding: 4,
  },
  headerTitle: {
    ...EthosTypography.headlineLg,
    fontSize:   18,
    color:      EthosColors.onSurface,
    fontWeight: '600',
  },
  scrollContent: {
    paddingHorizontal: EthosSpacing.containerPadding,
    paddingTop:        EthosSpacing.stackMd,
    paddingBottom:     100,
    gap:               EthosSpacing.stackLg,
  },
  summaryWrap: {
    gap: EthosSpacing.stackMd,
  },
  summaryRow: {
    flexDirection: 'row',
    gap:           EthosSpacing.stackMd,
  },
  summaryCard: {
    flex:            1,
    backgroundColor: EthosColors.surfaceContainerLowest,
    borderRadius:    EthosRadius.lg,
    borderWidth:     EthosBorder.width,
    padding:         EthosSpacing.containerPadding,
    gap:             6,
  },
  cardHeaderRow: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'space-between',
  },
  cardLabel: {
    ...EthosTypography.labelSm,
    color:         EthosColors.outline,
    fontSize:      10,
    letterSpacing: 0.8,
  },
  iconChip: {
    width:          24,
    height:         24,
    borderRadius:   12,
    alignItems:     'center',
    justifyContent: 'center',
  },
  cardVal: {
    ...EthosTypography.headlineLg,
    fontSize:   18,
    fontWeight: '700',
  },
  cardSubtext: {
    ...EthosTypography.labelSm,
    fontSize: 11,
    color:    EthosColors.outline,
  },
  netBanner: {
    flexDirection:     'row',
    alignItems:        'center',
    justifyContent:    'space-between',
    backgroundColor:   EthosColors.surfaceContainerLowest,
    borderRadius:      EthosRadius.lg,
    borderWidth:       EthosBorder.width,
    borderColor:       EthosBorder.color,
    paddingHorizontal: EthosSpacing.containerPadding,
    paddingVertical:   EthosSpacing.stackMd,
  },
  netLabel: {
    ...EthosTypography.labelSm,
    fontSize:      10,
    color:         EthosColors.outline,
    letterSpacing: 1,
  },
  netVal: {
    ...EthosTypography.headlineLg,
    fontSize:   16,
    fontWeight: '700',
  },
  overdueBadge: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               4,
    backgroundColor:   'rgba(239, 68, 68, 0.12)',
    paddingHorizontal: 10,
    paddingVertical:   4,
    borderRadius:      EthosRadius.full,
  },
  overdueBadgeText: {
    ...EthosTypography.labelSm,
    fontSize:   11,
    color:      EthosColors.error,
    fontWeight: '600',
  },
  tabBar: {
    flexDirection:   'row',
    backgroundColor: EthosColors.surfaceContainerLow,
    borderRadius:    EthosRadius.full,
    padding:         4,
  },
  tabBtn: {
    flex:           1,
    paddingVertical: 8,
    alignItems:     'center',
    justifyContent: 'center',
    borderRadius:   EthosRadius.full,
  },
  tabBtnActive: {
    backgroundColor: EthosColors.surfaceContainerLowest,
  },
  tabText: {
    ...EthosTypography.labelSm,
    color:      EthosColors.outline,
    fontWeight: '500',
  },
  tabTextActive: {
    color:      EthosColors.primary,
    fontWeight: '600',
  },
  bentoCard: {
    backgroundColor: EthosColors.surfaceContainerLowest,
    borderRadius:    EthosRadius.lg,
    borderWidth:     EthosBorder.width,
    borderColor:     EthosBorder.color,
    padding:         EthosSpacing.containerPadding,
    gap:             EthosSpacing.stackSm,
  },
  bentoCardPressed: {
    backgroundColor: EthosColors.surfaceContainerLow,
  },
  cardTopRow: {
    flexDirection:  'row',
    justifyContent: 'space-between',
    alignItems:     'flex-start',
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           6,
    marginBottom:  2,
  },
  typeBadge: {
    paddingHorizontal: 8,
    paddingVertical:   2,
    borderRadius:      EthosRadius.sm,
  },
  typeBadgeText: {
    ...EthosTypography.labelSm,
    fontSize:   10,
    fontWeight: '700',
  },
  settledBadge: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               3,
    backgroundColor:   '#10B98115',
    paddingHorizontal: 6,
    paddingVertical:   2,
    borderRadius:      EthosRadius.sm,
  },
  settledText: {
    ...EthosTypography.labelSm,
    fontSize:   10,
    color:      '#059669',
    fontWeight: '700',
  },
  overdueChip: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               3,
    backgroundColor:   'rgba(239, 68, 68, 0.12)',
    paddingHorizontal: 6,
    paddingVertical:   2,
    borderRadius:      EthosRadius.sm,
  },
  overdueChipText: {
    ...EthosTypography.labelSm,
    fontSize:   10,
    color:      EthosColors.error,
    fontWeight: '700',
  },
  itemTitle: {
    ...EthosTypography.bodyLg,
    fontWeight: '600',
    color:      EthosColors.primary,
  },
  itemPerson: {
    ...EthosTypography.labelSm,
    color: EthosColors.outline,
  },
  remainingVal: {
    ...EthosTypography.headlineLg,
    fontSize:   18,
    fontWeight: '700',
    color:      EthosColors.primary,
  },
  totalVal: {
    ...EthosTypography.labelSm,
    fontSize: 11,
    color:    EthosColors.outline,
  },
  progressWrap: {
    gap:        4,
    marginTop:  4,
  },
  progressTrack: {
    height:          6,
    borderRadius:    3,
    backgroundColor: EthosColors.surfaceContainerHigh,
    overflow:        'hidden',
  },
  progressFill: {
    height:       '100%',
    borderRadius: 3,
  },
  progressPctText: {
    ...EthosTypography.labelSm,
    fontSize:   10,
    color:      EthosColors.outline,
    textAlign:  'right',
  },
  cardFooter: {
    flexDirection:     'row',
    alignItems:        'center',
    justifyContent:    'space-between',
    paddingTop:        6,
    borderTopWidth:    EthosBorder.width,
    borderTopColor:    EthosBorder.color,
  },
  dueDateText: {
    ...EthosTypography.labelSm,
    fontSize: 11,
    color:    EthosColors.outline,
  },
  emptyWrap: {
    backgroundColor: EthosColors.surfaceContainerLowest,
    borderRadius:    EthosRadius.lg,
    borderWidth:     EthosBorder.width,
    borderColor:     EthosBorder.color,
    padding:         EthosSpacing.containerPadding + 8,
    alignItems:      'center',
    justifyContent:  'center',
    gap:             8,
    marginTop:       16,
  },
  emptyTitle: {
    ...EthosTypography.headlineLg,
    fontSize:   16,
    color:      EthosColors.primary,
    fontWeight: '600',
  },
  emptySubtext: {
    ...EthosTypography.bodyMd,
    fontSize:  13,
    color:     EthosColors.outline,
    textAlign: 'center',
  },
  emptyAddBtn: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               6,
    backgroundColor:   EthosColors.primary,
    borderRadius:      EthosRadius.md,
    paddingHorizontal: 16,
    paddingVertical:   10,
    marginTop:         8,
  },
  emptyAddText: {
    ...EthosTypography.labelMd,
    color:      '#FFFFFF',
    fontWeight: '600',
  },
  fabBtn: {
    position:        'absolute',
    bottom:          24,
    right:           24,
    backgroundColor: EthosColors.primary,
    borderRadius:    EthosRadius.full,
    paddingHorizontal: 20,
    paddingVertical:   14,
    flexDirection:   'row',
    alignItems:      'center',
    gap:             8,
    shadowColor:     EthosColors.primary,
    shadowOffset:    { width: 0, height: 4 },
    shadowOpacity:   0.3,
    shadowRadius:    8,
    elevation:       6,
  },
  fabText: {
    ...EthosTypography.labelMd,
    color:      '#FFFFFF',
    fontWeight: '600',
  },
});
