/**
 * AetherExpense — Ethos Add Transaction Screen
 *
 * Implements the Stitch `add_transaction` visual source of truth:
 *   - Back navigation header
 *   - Large centered hero amount input
 *   - EXPENSE / INCOME segmented pill control
 *   - 4-column category grid with 1px active/inactive borders
 *   - Minimalist underlined input fields (Payment Method, Date & Time, Merchant, Note)
 *   - Full-width fixed bottom Save CTA button
 *   - React Hook Form + Zod validation with offline SQLite persistence
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  Pressable,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Ionicons } from '@expo/vector-icons';
import { useSQLiteContext } from 'expo-sqlite';
import { generateUUID as uuidv4 } from '@/utils/uuid';

import { createDrizzleDB } from '@/database/client';
import { transactions, categories, accounts } from '@/database/schema';
import { useSettingsStore } from '@/store/settingsStore';
import { useAppStore } from '@/store/appStore';
import {
  EthosColors,
  EthosTypography,
  EthosSpacing,
  EthosRadius,
  EthosBorder,
} from '@/theme/ethos';
import { TransactionSchema, type TransactionFormSchema } from '@/utils/validation';
import { toMinorUnits, getCurrencySymbol } from '@/utils/currency';
import { todayISO, currentTimeHHMM, nowISO } from '@/utils/dates';
import { PAYMENT_METHODS } from '@/constants/paymentMethods';
import type { CategoryRow } from '@/database/schema';
import { SuccessAnimation } from '@/components/ui/SuccessAnimation';
import type { TransactionType, PaymentMethod } from '@/types/transaction';
import { eq } from 'drizzle-orm';

export default function AddTransactionScreen() {
  const sqliteDb = useSQLiteContext();
  const params = useLocalSearchParams<{ type?: string }>();
  const currencyCode = useSettingsStore((s) => s.currency);
  const currencySymbol = getCurrencySymbol(currencyCode);
  const invalidateData = useAppStore((s) => s.invalidateData);

  const [showSuccess, setShowSuccess] = useState(false);
  const [cats, setCats] = useState<CategoryRow[]>([]);
  const [accs, setAccs] = useState<Array<{ id: string; name: string; icon: string }>>([]);
  const [saving, setSaving] = useState(false);
  const [activeType, setActiveType] = useState<TransactionType>(
    (params.type as TransactionType) ?? 'expense'
  );
  const [showPmSelector, setShowPmSelector] = useState(false);
  const [selectedAccountId, setSelectedAccountId] = useState<string>('');

  const {
    control,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<TransactionFormSchema>({
    resolver: zodResolver(TransactionSchema),
    defaultValues: {
      type:           activeType,
      amount:         '',
      category_id:    '',
      date:           todayISO(),
      time:           currentTimeHHMM(),
      payment_method: 'cash',
    },
  });

  // Load categories and active accounts
  useEffect(() => {
    async function loadData() {
      const db = createDrizzleDB(sqliteDb);
      const catResult = await db
        .select()
        .from(categories)
        .where(eq(categories.type, activeType === 'transfer' ? 'expense' : activeType))
        .orderBy(categories.sort_order);
      setCats(catResult.filter((c) => c.is_active === 1));

      const accResult = await db
        .select({ id: accounts.id, name: accounts.name, icon: accounts.icon })
        .from(accounts)
        .where(eq(accounts.is_active, 1))
        .orderBy(accounts.sort_order);

      setAccs(accResult);
      if (accResult.length > 0 && !selectedAccountId) {
        setSelectedAccountId(accResult[0].id);
      }
    }
    loadData();
    setValue('type', activeType);
    setValue('category_id', ''); // Reset category on type change
  }, [activeType, sqliteDb]);

  const onSubmit = async (data: TransactionFormSchema) => {
    if (!data.category_id) {
      Alert.alert('Category Required', 'Please select a category.');
      return;
    }

    setSaving(true);
    try {
      const db = createDrizzleDB(sqliteDb);
      const now = nowISO();
      await db.insert(transactions).values({
        id:             uuidv4(),
        type:           data.type,
        amount:         toMinorUnits(data.amount),
        category_id:    data.category_id,
        subcategory:    data.subcategory ?? null,
        account_id:     selectedAccountId || null,
        date:           data.date,
        time:           data.time,
        note:           data.note ?? null,
        merchant:       data.merchant ?? null,
        payment_method: data.payment_method as PaymentMethod,
        is_recurring:   0,
        created_at:     now,
        updated_at:     now,
      });
      invalidateData();
      setShowSuccess(true);
    } catch (err) {
      console.error('[AddTransactionScreen] Error saving:', err);
      Alert.alert('Error', 'Could not save transaction. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const currentCategoryId = watch('category_id');
  const currentPaymentMethod = watch('payment_method');
  const selectedPmObj = PAYMENT_METHODS.find((p) => p.value === currentPaymentMethod) || PAYMENT_METHODS[0];

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <SuccessAnimation
        visible={showSuccess}
        title="Transaction Saved!"
        subtext="Account balance & analytics updated"
        onFinish={() => {
          setShowSuccess(false);
          router.back();
        }}
      />
      {/* ─── Top Header ─────────────────────────────────────────────────── */}
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [styles.navBtn, pressed && { opacity: 0.7 }]}
          accessibilityLabel="Back"
        >
          <Ionicons name="arrow-back" size={24} color={EthosColors.onSurface} />
        </Pressable>
        <Text style={styles.headerTitle}>Add transaction</Text>
        <View style={{ width: 32 }} />
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* ─── Amount Input Hero Section ─────────────────────────────── */}
          <View style={styles.amountHeroSection}>
            <Controller
              control={control}
              name="amount"
              render={({ field: { onChange, value } }) => (
                <View style={styles.amountWrap}>
                  <Text style={styles.amountSymbol}>{currencySymbol}</Text>
                  <TextInput
                    autoFocus
                    value={value}
                    onChangeText={onChange}
                    placeholder="0.00"
                    placeholderTextColor={EthosColors.outline}
                    keyboardType="decimal-pad"
                    style={styles.amountInput}
                  />
                </View>
              )}
            />
            {errors.amount && (
              <Text style={styles.errorText}>{errors.amount.message}</Text>
            )}
          </View>

          {/* ─── Segmented Toggle (EXPENSE / INCOME) ───────────────────── */}
          <View style={styles.segmentedContainer}>
            <Pressable
              id="segment-expense"
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
              id="segment-income"
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

          {/* ─── Category Selection Grid ───────────────────────────────── */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Category</Text>
            <View style={styles.categoryGrid}>
              {cats.map((cat) => {
                const selected = currentCategoryId === cat.id;
                return (
                  <Controller
                    key={cat.id}
                    control={control}
                    name="category_id"
                    render={({ field: { onChange } }) => (
                      <Pressable
                        id={`cat-${cat.id}`}
                        onPress={() => onChange(cat.id)}
                        style={[
                          styles.catCard,
                          selected ? styles.catCardSelected : styles.catCardUnselected,
                        ]}
                      >
                        <Ionicons
                          name={(cat.icon || 'restaurant') as any}
                          size={22}
                          color={selected ? EthosColors.primary : EthosColors.outline}
                        />
                        <Text
                          style={[
                            styles.catCardText,
                            selected && styles.catCardTextSelected,
                          ]}
                          numberOfLines={1}
                        >
                          {cat.name}
                        </Text>
                      </Pressable>
                    )}
                  />
                );
              })}
            </View>
            {errors.category_id && (
              <Text style={styles.errorText}>{errors.category_id.message}</Text>
            )}
          </View>

          {/* ─── Input Fields Section ──────────────────────────────────── */}
          <View style={styles.section}>
            {/* Account Selector */}
            {accs.length > 0 && (
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Account / Wallet</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: EthosSpacing.unit }}>
                  {accs.map((acc) => {
                    const selected = selectedAccountId === acc.id;
                    return (
                      <Pressable
                        key={acc.id}
                        onPress={() => setSelectedAccountId(acc.id)}
                        style={[
                          styles.pmDropdownItem,
                          {
                            borderRadius: EthosRadius.full,
                            borderWidth: selected ? 1.5 : EthosBorder.width,
                            borderColor: selected ? EthosColors.primary : EthosBorder.color,
                            backgroundColor: selected ? EthosColors.surfaceContainerLow : EthosColors.surfaceContainerLowest,
                          },
                        ]}
                      >
                        <Ionicons name={(acc.icon || 'wallet-outline') as any} size={16} color={selected ? EthosColors.primary : EthosColors.outline} />
                        <Text style={{ ...EthosTypography.labelSm, color: selected ? EthosColors.primary : EthosColors.outline }}>{acc.name}</Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              </View>
            )}

            {/* Payment Method */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Payment Method</Text>
              <Pressable
                onPress={() => setShowPmSelector((prev) => !prev)}
                style={styles.underlinedRow}
              >
                <View style={styles.rowLeft}>
                  <Ionicons
                    name={(selectedPmObj.icon || 'card-outline') as any}
                    size={20}
                    color={EthosColors.outline}
                  />
                  <Text style={styles.rowValueText}>{selectedPmObj.label}</Text>
                </View>
                <Ionicons
                  name={showPmSelector ? 'chevron-up' : 'chevron-down'}
                  size={18}
                  color={EthosColors.outline}
                />
              </Pressable>

              {/* Payment Method Dropdown List */}
              {showPmSelector && (
                <View style={styles.pmListDropdown}>
                  {PAYMENT_METHODS.map((pm) => (
                    <Controller
                      key={pm.value}
                      control={control}
                      name="payment_method"
                      render={({ field: { onChange } }) => (
                        <Pressable
                          onPress={() => {
                            onChange(pm.value);
                            setShowPmSelector(false);
                          }}
                          style={[
                            styles.pmDropdownItem,
                            currentPaymentMethod === pm.value && styles.pmDropdownItemActive,
                          ]}
                        >
                          <Ionicons
                            name={pm.icon as any}
                            size={18}
                            color={
                              currentPaymentMethod === pm.value
                                ? EthosColors.primary
                                : EthosColors.outline
                            }
                          />
                          <Text
                            style={[
                              styles.pmDropdownText,
                              currentPaymentMethod === pm.value && styles.pmDropdownTextActive,
                            ]}
                          >
                            {pm.label}
                          </Text>
                        </Pressable>
                      )}
                    />
                  ))}
                </View>
              )}
            </View>

            {/* Date & Time */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Date & Time</Text>
              <View style={styles.underlinedRow}>
                <Ionicons name="calendar-outline" size={18} color={EthosColors.outline} />
                <Controller
                  control={control}
                  name="date"
                  render={({ field: { onChange, value } }) => (
                    <TextInput
                      value={value}
                      onChangeText={onChange}
                      placeholder="YYYY-MM-DD"
                      placeholderTextColor={EthosColors.outline}
                      style={[styles.underlinedInput, { flex: 1, marginLeft: 8 }]}
                    />
                  )}
                />
                <Controller
                  control={control}
                  name="time"
                  render={({ field: { onChange, value } }) => (
                    <TextInput
                      value={value}
                      onChangeText={onChange}
                      placeholder="HH:MM"
                      placeholderTextColor={EthosColors.outline}
                      style={[styles.underlinedInput, { width: 60, textAlign: 'right' }]}
                    />
                  )}
                />
              </View>
              {(errors.date || errors.time) && (
                <Text style={styles.errorText}>
                  {errors.date?.message || errors.time?.message}
                </Text>
              )}
            </View>

            {/* Merchant */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Merchant</Text>
              <Controller
                control={control}
                name="merchant"
                render={({ field: { onChange, value } }) => (
                  <TextInput
                    value={value ?? ''}
                    onChangeText={onChange}
                    placeholder="e.g. Starbucks"
                    placeholderTextColor={EthosColors.outline}
                    style={styles.underlinedInput}
                  />
                )}
              />
            </View>

            {/* Note (Optional) */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Note (Optional)</Text>
              <Controller
                control={control}
                name="note"
                render={({ field: { onChange, value } }) => (
                  <TextInput
                    value={value ?? ''}
                    onChangeText={onChange}
                    placeholder="Add details..."
                    placeholderTextColor={EthosColors.outline}
                    style={styles.underlinedInput}
                  />
                )}
              />
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* ─── Footer Save CTA Button ─────────────────────────────────────── */}
      <View style={styles.footer}>
        <Pressable
          id="save-transaction-btn"
          onPress={handleSubmit(onSubmit)}
          disabled={saving}
          style={({ pressed }) => [
            styles.saveBtn,
            pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] },
          ]}
        >
          <Text style={styles.saveBtnText}>
            {saving ? 'Saving...' : 'Save transaction'}
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: EthosColors.surface,
  },
  header: {
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
  headerTitle: {
    ...EthosTypography.headlineLg,
    color: EthosColors.primary,
    fontWeight: '500',
  },
  scrollContent: {
    paddingHorizontal: EthosSpacing.containerPadding,
    paddingTop:        EthosSpacing.unit,
    paddingBottom:     120, // space for footer
    gap:               EthosSpacing.stackLg,
  },
  amountHeroSection: {
    alignItems:        'center',
    justifyContent:    'center',
    paddingVertical:   EthosSpacing.stackLg,
    borderBottomWidth: EthosBorder.width,
    borderBottomColor: EthosColors.outlineVariant,
  },
  amountWrap: {
    flexDirection: 'row',
    alignItems:    'center',
    justifyContent: 'center',
  },
  amountSymbol: {
    ...EthosTypography.displayMd,
    color: EthosColors.primary,
    marginRight: 6,
  },
  amountInput: {
    ...EthosTypography.displayMd,
    color: EthosColors.primary,
    fontVariant: ['tabular-nums'],
    minWidth: 120,
    textAlign: 'center',
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
    color: EthosColors.primary,
    fontWeight: '600',
  },
  section: {
    gap: EthosSpacing.stackMd,
  },
  sectionTitle: {
    ...EthosTypography.labelMd,
    color: EthosColors.outline,
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap:      'wrap',
    gap:           EthosSpacing.unit,
  },
  catCard: {
    width:          '23%', // 4 columns
    aspectRatio:    1,
    borderRadius:   EthosRadius.base,
    backgroundColor: EthosColors.surfaceContainerLowest,
    alignItems:     'center',
    justifyContent: 'center',
    padding:        EthosSpacing.unit,
    gap:            4,
  },
  catCardUnselected: {
    borderWidth: EthosBorder.width,
    borderColor: EthosColors.outlineVariant,
  },
  catCardSelected: {
    borderWidth: 1.5,
    borderColor: EthosColors.primary,
  },
  catCardText: {
    ...EthosTypography.labelSm,
    fontSize: 11,
    color:    EthosColors.outline,
  },
  catCardTextSelected: {
    color:      EthosColors.primary,
    fontWeight: '600',
  },
  inputGroup: {
    gap: 4,
  },
  inputLabel: {
    ...EthosTypography.labelSm,
    color: EthosColors.outline,
  },
  underlinedRow: {
    flexDirection:     'row',
    alignItems:        'center',
    justifyContent:    'space-between',
    paddingVertical:   EthosSpacing.unit,
    borderBottomWidth: EthosBorder.width,
    borderBottomColor: EthosColors.outlineVariant,
  },
  rowLeft: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           EthosSpacing.unit,
  },
  rowValueText: {
    ...EthosTypography.bodyMd,
    color: EthosColors.onSurface,
  },
  pmListDropdown: {
    backgroundColor: EthosColors.surfaceContainerLowest,
    borderRadius:    EthosRadius.base,
    borderWidth:     EthosBorder.width,
    borderColor:     EthosBorder.color,
    marginTop:       4,
    overflow:        'hidden',
  },
  pmDropdownItem: {
    flexDirection:   'row',
    alignItems:      'center',
    gap:             EthosSpacing.unit,
    paddingVertical: EthosSpacing.stackSm,
    paddingHorizontal: EthosSpacing.stackMd,
  },
  pmDropdownItemActive: {
    backgroundColor: EthosColors.surfaceContainerLow,
  },
  pmDropdownText: {
    ...EthosTypography.bodyMd,
    color: EthosColors.outline,
  },
  pmDropdownTextActive: {
    color:      EthosColors.primary,
    fontWeight: '600',
  },
  underlinedInput: {
    ...EthosTypography.bodyMd,
    color:             EthosColors.onSurface,
    paddingVertical:   EthosSpacing.unit,
    borderBottomWidth: EthosBorder.width,
    borderBottomColor: EthosColors.outlineVariant,
  },
  errorText: {
    ...EthosTypography.labelSm,
    color:     EthosColors.error,
    marginTop: 4,
  },
  footer: {
    position:          'absolute',
    bottom:            0,
    left:              0,
    right:             0,
    backgroundColor:   EthosColors.surfaceContainerLowest,
    borderTopWidth:    EthosBorder.width,
    borderTopColor:    EthosColors.outlineVariant,
    paddingHorizontal: EthosSpacing.containerPadding,
    paddingVertical:   EthosSpacing.stackMd,
  },
  saveBtn: {
    backgroundColor: EthosColors.primary,
    borderRadius:    EthosRadius.md,
    paddingVertical: EthosSpacing.stackMd,
    alignItems:      'center',
    justifyContent:  'center',
  },
  saveBtnText: {
    ...EthosTypography.labelMd,
    color:      EthosColors.onPrimary,
    fontWeight: '600',
  },
});
