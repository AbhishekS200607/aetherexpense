/**
 * AetherExpense — Ethos Validation & Confirmation Modal
 *
 * Enforces human confirmation before saving OCR results to SQLite.
 * Allows user to review and edit extracted amount, merchant, date, category, and payment account.
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  Modal,
  ScrollView,
  Pressable,
  Image,
  StyleSheet,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSQLiteContext } from 'expo-sqlite';
import { eq } from 'drizzle-orm';

import {
  EthosColors,
  EthosTypography,
  EthosSpacing,
  EthosRadius,
  EthosBorder,
} from '@/theme/ethos';
import { createDrizzleDB } from '@/database/client';
import { categories, accounts, transactions, bills } from '@/database/schema';
import { generateUUID } from '@/utils/uuid';
import { nowISO, currentTimeHHMM } from '@/utils/dates';
import { useAppStore } from '@/store/appStore';
import { SuccessAnimation } from '@/components/ui/SuccessAnimation';
import type { ParsedScanResult } from '@/utils/ocr';

interface ValidationModalProps {
  visible:       boolean;
  imageUri:      string | null;
  scannedResult: ParsedScanResult | null;
  onClose:       () => void;
  onSuccess:     () => void;
}

export function ValidationModal({
  visible,
  imageUri,
  scannedResult,
  onClose,
  onSuccess,
}: ValidationModalProps) {
  const sqliteDb = useSQLiteContext();
  const invalidateData = useAppStore((s) => s.invalidateData);

  const [showSuccess, setShowSuccess] = useState(false);
  const [type, setType] = useState<'expense' | 'income' | 'bill'>('expense');
  const [amountInput, setAmountInput] = useState('');
  const [merchant, setMerchant] = useState('');
  const [date, setDate] = useState('');
  const [note, setNote] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('');
  const [selectedAccountId, setSelectedAccountId] = useState<string>('');

  const [allCategories, setAllCategories] = useState<Array<{ id: string; name: string; icon: string }>>([]);
  const [allAccounts, setAllAccounts] = useState<Array<{ id: string; name: string; icon: string }>>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function loadOptions() {
      if (!sqliteDb || !visible) return;
      try {
        const db = createDrizzleDB(sqliteDb);
        const catRows = await db.select().from(categories).where(eq(categories.is_active, 1));
        const accRows = await db.select().from(accounts).where(eq(accounts.is_active, 1));

        setAllCategories(catRows.map((c) => ({ id: c.id, name: c.name, icon: c.icon })));
        setAllAccounts(accRows.map((a) => ({ id: a.id, name: a.name, icon: a.icon })));

        if (catRows.length > 0) {
          // Pre-select category matching OCR inference if available
          const matched = catRows.find(
            (c) => c.name.toLowerCase() === scannedResult?.suggestedCategoryName.toLowerCase()
          );
          setSelectedCategoryId(matched ? matched.id : catRows[0].id);
        }
        if (accRows.length > 0) {
          setSelectedAccountId(accRows[0].id);
        }
      } catch (err) {
        console.error('[ValidationModal] Error loading categories/accounts:', err);
      }
    }

    if (scannedResult) {
      setAmountInput(scannedResult.amountFormatted);
      setMerchant(scannedResult.merchant);
      setDate(scannedResult.date);
      setNote(scannedResult.referenceId ? `Ref: ${scannedResult.referenceId}` : '');
      setType(scannedResult.scanType === 'bill' ? 'bill' : 'expense');
    }

    loadOptions();
  }, [visible, scannedResult, sqliteDb]);

  if (!visible || !scannedResult) return null;

  const handleSave = async () => {
    const numericAmount = parseFloat(amountInput.replace(/,/g, ''));
    if (isNaN(numericAmount) || numericAmount <= 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid amount greater than ₹0.');
      return;
    }
    if (!selectedCategoryId) {
      Alert.alert('Missing Category', 'Please select a category.');
      return;
    }

    const paise = Math.round(numericAmount * 100);
    const now = nowISO();
    const db = createDrizzleDB(sqliteDb);
    setSaving(true);

    try {
      if (type === 'bill') {
        // Save as Bill
        await db.insert(bills).values({
          id:                       generateUUID(),
          name:                     merchant || 'Scanned Bill',
          amount:                   paise,
          category_id:              selectedCategoryId,
          account_id:               selectedAccountId || null,
          due_date:                 date,
          frequency:                'one_time',
          note:                     note || null,
          is_paid:                  0,
          auto_create_transaction:  1,
          is_active:                1,
          created_at:               now,
          updated_at:               now,
        });
      } else {
        // Save as Transaction (Expense / Income)
        await db.insert(transactions).values({
          id:                   generateUUID(),
          type:                 type,
          amount:               paise,
          category_id:          selectedCategoryId,
          account_id:           selectedAccountId || null,
          date:                 date,
          time:                 currentTimeHHMM(),
          merchant:             merchant || null,
          note:                 note || null,
          receipt_path:         imageUri || null,
          created_at:           now,
          updated_at:           now,
        });
      }

      invalidateData();
      setSaving(false);
      setShowSuccess(true);
    } catch (err) {
      setSaving(false);
      console.error('[ValidationModal] Error saving OCR result:', err);
      Alert.alert('Error', 'Failed to save scanned data. Please try again.');
    }
  };

  return (
    <>
      <SuccessAnimation
        visible={showSuccess}
        title={type === 'bill' ? 'Bill Created!' : 'Transaction Saved!'}
        subtext="Recorded into SQLite database"
        onFinish={() => {
          setShowSuccess(false);
          onSuccess();
        }}
      />
      <Modal visible={visible && !showSuccess} transparent animationType="slide">
      <View style={styles.overlay}>
        <View style={styles.card}>
          <View style={styles.header}>
            <Text style={styles.title}>Confirm Scanned Details</Text>
            <Pressable onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={24} color={EthosColors.onSurface} />
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
            {/* Scanned Image Preview */}
            {imageUri && (
              <View style={styles.imagePreviewWrap}>
                <Image source={{ uri: imageUri }} style={styles.imagePreview} resizeMode="cover" />
              </View>
            )}

            {/* Type Switcher: Expense | Income | Bill */}
            <View style={styles.typeRow}>
              {(['expense', 'income', 'bill'] as const).map((t) => (
                <Pressable
                  key={t}
                  onPress={() => setType(t)}
                  style={[styles.typeChip, type === t && styles.typeChipActive]}
                >
                  <Text style={[styles.typeText, type === t && styles.typeTextActive]}>
                    {t === 'expense' ? 'Expense' : t === 'income' ? 'Income' : 'Create Bill'}
                  </Text>
                </Pressable>
              ))}
            </View>

            {/* Amount Field */}
            <View style={styles.inputWrap}>
              <Text style={styles.label}>Amount (₹)</Text>
              <TextInput
                value={amountInput}
                onChangeText={setAmountInput}
                keyboardType="decimal-pad"
                placeholder="0.00"
                style={styles.input}
              />
            </View>

            {/* Merchant / Payee Field */}
            <View style={styles.inputWrap}>
              <Text style={styles.label}>Merchant / Payee</Text>
              <TextInput
                value={merchant}
                onChangeText={setMerchant}
                placeholder="Store / Payee Name"
                style={styles.input}
              />
            </View>

            {/* Date Field */}
            <View style={styles.inputWrap}>
              <Text style={styles.label}>Date (YYYY-MM-DD)</Text>
              <TextInput
                value={date}
                onChangeText={setDate}
                placeholder="YYYY-MM-DD"
                style={styles.input}
              />
            </View>

            {/* Category Selector */}
            <View style={styles.inputWrap}>
              <Text style={styles.label}>Category</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                {allCategories.map((c) => {
                  const active = c.id === selectedCategoryId;
                  return (
                    <Pressable
                      key={c.id}
                      onPress={() => setSelectedCategoryId(c.id)}
                      style={[styles.chip, active && styles.chipActive]}
                    >
                      <Ionicons
                        name={c.icon as any}
                        size={16}
                        color={active ? EthosColors.onPrimary : EthosColors.primary}
                      />
                      <Text style={[styles.chipText, active && styles.chipTextActive]}>{c.name}</Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>

            {/* Account Selector */}
            <View style={styles.inputWrap}>
              <Text style={styles.label}>Payment Account</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                {allAccounts.map((a) => {
                  const active = a.id === selectedAccountId;
                  return (
                    <Pressable
                      key={a.id}
                      onPress={() => setSelectedAccountId(a.id)}
                      style={[styles.chip, active && styles.chipActive]}
                    >
                      <Ionicons
                        name={a.icon as any}
                        size={16}
                        color={active ? EthosColors.onPrimary : EthosColors.primary}
                      />
                      <Text style={[styles.chipText, active && styles.chipTextActive]}>{a.name}</Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>

            {/* Note Field */}
            <View style={styles.inputWrap}>
              <Text style={styles.label}>Note / Reference ID</Text>
              <TextInput
                value={note}
                onChangeText={setNote}
                placeholder="Optional transaction reference"
                style={styles.input}
              />
            </View>
          </ScrollView>

          {/* Action Buttons */}
          <View style={styles.actions}>
            <Pressable onPress={onClose} style={styles.cancelBtn}>
              <Text style={styles.cancelText}>Discard</Text>
            </Pressable>
            <Pressable onPress={handleSave} disabled={saving} style={styles.saveBtn}>
              <Text style={styles.saveText}>{saving ? 'Saving...' : 'Confirm & Save'}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex:            1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent:  'flex-end',
  },
  card: {
    backgroundColor:      EthosColors.surfaceContainerLowest,
    borderTopLeftRadius:  EthosRadius.lg,
    borderTopRightRadius: EthosRadius.lg,
    maxHeight:            '88%',
    padding:              EthosSpacing.containerPadding,
    gap:                  EthosSpacing.stackMd,
  },
  header: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'space-between',
  },
  title: {
    ...EthosTypography.headlineLg,
    fontSize:   18,
    color:      EthosColors.primary,
    fontWeight: '600',
  },
  closeBtn: {
    padding: 4,
  },
  scroll: {
    gap: EthosSpacing.stackMd,
  },
  imagePreviewWrap: {
    height:       140,
    borderRadius: EthosRadius.md,
    overflow:     'hidden',
    borderWidth:  EthosBorder.width,
    borderColor:  EthosBorder.color,
  },
  imagePreview: {
    width:  '100%',
    height: '100%',
  },
  typeRow: {
    flexDirection: 'row',
    gap:           8,
  },
  typeChip: {
    flex:            1,
    paddingVertical: 8,
    borderRadius:    EthosRadius.full,
    backgroundColor: EthosColors.surfaceContainerLow,
    alignItems:      'center',
    borderWidth:     EthosBorder.width,
    borderColor:     EthosBorder.color,
  },
  typeChipActive: {
    backgroundColor: EthosColors.primary,
    borderColor:     EthosColors.primary,
  },
  typeText: {
    ...EthosTypography.labelSm,
    color: EthosColors.onSurface,
  },
  typeTextActive: {
    color:      EthosColors.onPrimary,
    fontWeight: '600',
  },
  inputWrap: {
    gap: 4,
  },
  label: {
    ...EthosTypography.labelSm,
    color: EthosColors.outline,
  },
  input: {
    ...EthosTypography.bodyMd,
    backgroundColor:   EthosColors.surfaceContainerLow,
    borderRadius:      EthosRadius.md,
    borderWidth:       EthosBorder.width,
    borderColor:       EthosBorder.color,
    paddingHorizontal: EthosSpacing.stackMd,
    paddingVertical:   EthosSpacing.stackSm,
    color:             EthosColors.onSurface,
  },
  chip: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               6,
    paddingHorizontal: 12,
    paddingVertical:   6,
    borderRadius:      EthosRadius.full,
    backgroundColor:   EthosColors.surfaceContainerLow,
    borderWidth:       EthosBorder.width,
    borderColor:       EthosBorder.color,
  },
  chipActive: {
    backgroundColor: EthosColors.primary,
    borderColor:     EthosColors.primary,
  },
  chipText: {
    ...EthosTypography.labelSm,
    color: EthosColors.primary,
  },
  chipTextActive: {
    color:      EthosColors.onPrimary,
    fontWeight: '600',
  },
  actions: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'flex-end',
    gap:            EthosSpacing.stackMd,
    paddingTop:     EthosSpacing.stackSm,
  },
  cancelBtn: {
    paddingHorizontal: EthosSpacing.stackMd,
    paddingVertical:   EthosSpacing.stackSm,
  },
  cancelText: {
    ...EthosTypography.labelMd,
    color: EthosColors.outline,
  },
  saveBtn: {
    backgroundColor:   EthosColors.primary,
    borderRadius:      EthosRadius.md,
    paddingHorizontal: EthosSpacing.containerPadding,
    paddingVertical:   EthosSpacing.stackSm + 4,
  },
  saveText: {
    ...EthosTypography.labelMd,
    fontWeight: '600',
    color:      EthosColors.onPrimary,
  },
});
