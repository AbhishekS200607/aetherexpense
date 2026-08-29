/**
 * AetherExpense — Ethos TransactionFilterModal
 *
 * Provides a clean bottom sheet modal for filtering & sorting transactions.
 * All operations execute locally against SQLite data.
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  EthosColors,
  EthosTypography,
  EthosSpacing,
  EthosRadius,
  EthosBorder,
} from '@/theme/ethos';

export interface FilterOptions {
  type: 'all' | 'income' | 'expense' | 'transfer';
  categoryId: string | null;
  sort: 'newest' | 'oldest' | 'highest' | 'lowest';
  minAmount: string;
  maxAmount: string;
}

interface FilterModalProps {
  visible: boolean;
  onClose: () => void;
  filters: FilterOptions;
  categories: Array<{ id: string; name: string }>;
  onApply: (filters: FilterOptions) => void;
  onReset: () => void;
}

export function TransactionFilterModal({
  visible,
  onClose,
  filters,
  categories,
  onApply,
  onReset,
}: FilterModalProps) {
  const [localFilters, setLocalFilters] = useState<FilterOptions>(filters);

  const handleSelectType = (type: FilterOptions['type']) => {
    setLocalFilters((prev) => ({ ...prev, type }));
  };

  const handleSelectSort = (sort: FilterOptions['sort']) => {
    setLocalFilters((prev) => ({ ...prev, sort }));
  };

  const handleSelectCategory = (catId: string | null) => {
    setLocalFilters((prev) => ({ ...prev, categoryId: catId }));
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={onClose} />

        <View style={styles.sheet}>
          {/* Sheet Header */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Filter & Sort</Text>
            <Pressable onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={22} color={EthosColors.onSurface} />
            </Pressable>
          </View>

          <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>
            {/* Transaction Type Filter */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>TRANSACTION TYPE</Text>
              <View style={styles.pillRow}>
                {(['all', 'expense', 'income', 'transfer'] as const).map((t) => {
                  const active = localFilters.type === t;
                  return (
                    <Pressable
                      key={t}
                      onPress={() => handleSelectType(t)}
                      style={[
                        styles.pill,
                        active && styles.activePill,
                      ]}
                    >
                      <Text
                        style={[
                          styles.pillText,
                          active && styles.activePillText,
                        ]}
                      >
                        {t.charAt(0).toUpperCase() + t.slice(1)}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            {/* Sort Order */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>SORT BY</Text>
              <View style={styles.pillRow}>
                {[
                  { id: 'newest', label: 'Newest First' },
                  { id: 'oldest', label: 'Oldest First' },
                  { id: 'highest', label: 'Highest Amount' },
                  { id: 'lowest', label: 'Lowest Amount' },
                ].map((s) => {
                  const active = localFilters.sort === s.id;
                  return (
                    <Pressable
                      key={s.id}
                      onPress={() => handleSelectSort(s.id as any)}
                      style={[
                        styles.pill,
                        active && styles.activePill,
                      ]}
                    >
                      <Text
                        style={[
                          styles.pillText,
                          active && styles.activePillText,
                        ]}
                      >
                        {s.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            {/* Category Filter */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>CATEGORY</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.scrollPillRow}
              >
                <Pressable
                  onPress={() => handleSelectCategory(null)}
                  style={[
                    styles.pill,
                    localFilters.categoryId === null && styles.activePill,
                  ]}
                >
                  <Text
                    style={[
                      styles.pillText,
                      localFilters.categoryId === null && styles.activePillText,
                    ]}
                  >
                    All Categories
                  </Text>
                </Pressable>
                {categories.map((c) => {
                  const active = localFilters.categoryId === c.id;
                  return (
                    <Pressable
                      key={c.id}
                      onPress={() => handleSelectCategory(c.id)}
                      style={[
                        styles.pill,
                        active && styles.activePill,
                      ]}
                    >
                      <Text
                        style={[
                          styles.pillText,
                          active && styles.activePillText,
                        ]}
                      >
                        {c.name}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>

            {/* Amount Range Filter */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>AMOUNT RANGE (₹)</Text>
              <View style={styles.amountInputRow}>
                <TextInput
                  placeholder="Min"
                  placeholderTextColor={EthosColors.outline}
                  keyboardType="numeric"
                  value={localFilters.minAmount}
                  onChangeText={(val) =>
                    setLocalFilters((prev) => ({ ...prev, minAmount: val }))
                  }
                  style={styles.amountInput}
                />
                <Text style={styles.toText}>to</Text>
                <TextInput
                  placeholder="Max"
                  placeholderTextColor={EthosColors.outline}
                  keyboardType="numeric"
                  value={localFilters.maxAmount}
                  onChangeText={(val) =>
                    setLocalFilters((prev) => ({ ...prev, maxAmount: val }))
                  }
                  style={styles.amountInput}
                />
              </View>
            </View>
          </ScrollView>

          {/* Footer Actions */}
          <View style={styles.footer}>
            <Pressable
              onPress={() => {
                onReset();
                onClose();
              }}
              style={styles.resetBtn}
            >
              <Text style={styles.resetText}>Reset All</Text>
            </Pressable>

            <Pressable
              onPress={() => {
                onApply(localFilters);
                onClose();
              }}
              style={styles.applyBtn}
            >
              <Text style={styles.applyText}>Apply Filters</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  sheet: {
    backgroundColor: EthosColors.surfaceContainerLowest,
    borderTopLeftRadius: EthosRadius.xl,
    borderTopRightRadius: EthosRadius.xl,
    maxHeight: '80%',
    paddingBottom: EthosSpacing.containerPadding,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: EthosSpacing.containerPadding,
    paddingVertical: EthosSpacing.stackMd,
    borderBottomWidth: EthosBorder.width,
    borderBottomColor: EthosColors.secondaryContainer,
  },
  headerTitle: {
    ...EthosTypography.headlineLg,
    fontSize: 20,
    color: EthosColors.onSurface,
  },
  closeBtn: {
    padding: 4,
  },
  body: {
    paddingHorizontal: EthosSpacing.containerPadding,
    paddingVertical: EthosSpacing.stackMd,
  },
  section: {
    marginBottom: EthosSpacing.stackLg,
    gap: EthosSpacing.unit,
  },
  sectionTitle: {
    ...EthosTypography.labelSm,
    color: EthosColors.outline,
    letterSpacing: EthosTypography.labelSm.letterSpacing,
  },
  pillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: EthosSpacing.unit,
  },
  scrollPillRow: {
    gap: EthosSpacing.unit,
    paddingRight: EthosSpacing.containerPadding,
  },
  pill: {
    paddingHorizontal: EthosSpacing.stackMd,
    paddingVertical: 8,
    borderRadius: EthosRadius.full,
    backgroundColor: EthosColors.surfaceContainerLow,
    borderWidth: EthosBorder.width,
    borderColor: EthosBorder.color,
  },
  activePill: {
    backgroundColor: EthosColors.primary,
    borderColor: EthosColors.primary,
  },
  pillText: {
    ...EthosTypography.labelMd,
    color: EthosColors.onSurface,
  },
  activePillText: {
    color: EthosColors.onPrimary,
  },
  amountInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: EthosSpacing.unit,
  },
  amountInput: {
    flex: 1,
    height: 44,
    backgroundColor: EthosColors.surfaceContainerLow,
    borderRadius: EthosRadius.base,
    borderWidth: EthosBorder.width,
    borderColor: EthosBorder.color,
    paddingHorizontal: EthosSpacing.stackMd,
    color: EthosColors.onSurface,
    ...EthosTypography.bodyMd,
  },
  toText: {
    ...EthosTypography.labelMd,
    color: EthosColors.outline,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: EthosSpacing.gutter,
    paddingHorizontal: EthosSpacing.containerPadding,
    paddingTop: EthosSpacing.stackMd,
    borderTopWidth: EthosBorder.width,
    borderTopColor: EthosColors.secondaryContainer,
  },
  resetBtn: {
    paddingVertical: EthosSpacing.stackMd,
    paddingHorizontal: EthosSpacing.containerPadding,
  },
  resetText: {
    ...EthosTypography.labelMd,
    color: EthosColors.outline,
  },
  applyBtn: {
    flex: 1,
    backgroundColor: EthosColors.primary,
    paddingVertical: EthosSpacing.stackMd,
    borderRadius: EthosRadius.full,
    alignItems: 'center',
  },
  applyText: {
    ...EthosTypography.labelMd,
    color: EthosColors.onPrimary,
    fontWeight: '600',
  },
});
