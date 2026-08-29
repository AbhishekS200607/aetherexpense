/**
 * AetherExpense — Ethos Edit Category Screen
 *
 * Pre-fills category data for editing or deleting custom categories.
 * Updates local SQLite database via Drizzle ORM.
 */

import React, { useEffect, useState } from 'react';
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
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSQLiteContext } from 'expo-sqlite';
import { eq } from 'drizzle-orm';

import { createDrizzleDB } from '@/database/client';
import { categories } from '@/database/schema';
import { useAppStore } from '@/store/appStore';
import {
  EthosColors,
  EthosTypography,
  EthosSpacing,
  EthosRadius,
  EthosBorder,
} from '@/theme/ethos';
import { nowISO } from '@/utils/dates';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import type { CategoryRow } from '@/database/schema';

const ICON_OPTIONS = [
  'restaurant',
  'car-outline',
  'cart-outline',
  'receipt-outline',
  'fitness-outline',
  'film-outline',
  'home-outline',
  'plane-outline',
  'medical-outline',
  'school-outline',
  'briefcase-outline',
  'gift-outline',
  'game-controller-outline',
  'cafe-outline',
  'fast-food-outline',
  'shield-checkmark-outline',
  'cash-outline',
  'trending-up-outline',
  'help-circle-outline',
];

const COLOR_OPTIONS = [
  '#6366F1',
  '#10B981',
  '#F59E0B',
  '#F43F5E',
  '#3B82F6',
  '#8B5CF6',
  '#06B6D4',
  '#EC4899',
  '#000000',
];

export default function EditCategoryScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const sqliteDb = useSQLiteContext();
  const invalidateData = useAppStore((s) => s.invalidateData);

  const [category, setCategory] = useState<CategoryRow | null>(null);
  const [name, setName] = useState('');
  const [type, setType] = useState<'expense' | 'income'>('expense');
  const [selectedIcon, setSelectedIcon] = useState('restaurant');
  const [selectedColor, setSelectedColor] = useState('#6366F1');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showDelete, setShowDelete] = useState(false);

  useEffect(() => {
    if (!id) return;
    async function load() {
      try {
        const db = createDrizzleDB(sqliteDb);
        const [cat] = await db
          .select()
          .from(categories)
          .where(eq(categories.id, id))
          .limit(1);

        if (cat) {
          setCategory(cat);
          setName(cat.name);
          setType(cat.type as 'expense' | 'income');
          setSelectedIcon(cat.icon);
          setSelectedColor(cat.color);
        }
      } catch (err) {
        console.error('[EditCategoryScreen] Load error:', err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id, sqliteDb]);

  const handleSave = async () => {
    if (!id) return;
    if (!name.trim()) {
      Alert.alert('Required', 'Please enter a category name.');
      return;
    }

    setSaving(true);
    try {
      const db = createDrizzleDB(sqliteDb);

      await db
        .update(categories)
        .set({
          name:       name.trim(),
          type,
          icon:       selectedIcon,
          color:      selectedColor,
          updated_at: nowISO(),
        })
        .where(eq(categories.id, id));

      invalidateData();
      router.back();
    } catch (err) {
      console.error('[EditCategoryScreen] Update error:', err);
      Alert.alert('Error', 'Could not update category.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!id) return;
    try {
      const db = createDrizzleDB(sqliteDb);

      // Soft delete category
      await db
        .update(categories)
        .set({ is_active: 0, updated_at: nowISO() })
        .where(eq(categories.id, id));

      invalidateData();
      router.replace('/categories' as any);
    } catch (err) {
      console.error('[EditCategoryScreen] Delete error:', err);
      Alert.alert('Error', 'Could not delete category.');
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator color={EthosColors.primary} size="large" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      {/* Top Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.navBtn}>
          <Ionicons name="arrow-back" size={24} color={EthosColors.onSurface} />
        </Pressable>
        <Text style={styles.headerTitle}>Edit Category</Text>
        <View style={{ width: 32 }} />
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {/* Category Name */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Category Name</Text>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="Category Name"
              placeholderTextColor={EthosColors.outline}
              style={styles.underlinedInput}
            />
          </View>

          {/* Type Toggle */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Category Type</Text>
            <View style={styles.segmentedContainer}>
              <Pressable
                onPress={() => setType('expense')}
                style={[
                  styles.segmentBtn,
                  type === 'expense' && styles.segmentBtnActive,
                ]}
              >
                <Text
                  style={[
                    styles.segmentText,
                    type === 'expense' && styles.segmentTextActive,
                  ]}
                >
                  EXPENSE
                </Text>
              </Pressable>

              <Pressable
                onPress={() => setType('income')}
                style={[
                  styles.segmentBtn,
                  type === 'income' && styles.segmentBtnActive,
                ]}
              >
                <Text
                  style={[
                    styles.segmentText,
                    type === 'income' && styles.segmentTextActive,
                  ]}
                >
                  INCOME
                </Text>
              </Pressable>
            </View>
          </View>

          {/* Icon Selector Grid */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Choose Icon</Text>
            <View style={styles.iconGrid}>
              {ICON_OPTIONS.map((iconName) => {
                const active = selectedIcon === iconName;
                return (
                  <Pressable
                    key={iconName}
                    onPress={() => setSelectedIcon(iconName)}
                    style={[
                      styles.iconTile,
                      active ? styles.iconTileActive : styles.iconTileInactive,
                    ]}
                  >
                    <Ionicons
                      name={iconName as any}
                      size={22}
                      color={active ? EthosColors.primary : EthosColors.outline}
                    />
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* Color Selector Palette */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Choose Color</Text>
            <View style={styles.colorRow}>
              {COLOR_OPTIONS.map((colorHex) => {
                const active = selectedColor === colorHex;
                return (
                  <Pressable
                    key={colorHex}
                    onPress={() => setSelectedColor(colorHex)}
                    style={[
                      styles.colorDot,
                      { backgroundColor: colorHex },
                      active && styles.colorDotActive,
                    ]}
                  />
                );
              })}
            </View>
          </View>

          {/* Delete Action */}
          <View style={styles.secondaryActionsRow}>
            <Pressable onPress={() => setShowDelete(true)} style={styles.deleteBtn}>
              <Ionicons name="trash-outline" size={18} color={EthosColors.error} />
              <Text style={styles.deleteBtnText}>Delete Category</Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Footer Save Button */}
      <View style={styles.footer}>
        <Pressable
          id="update-category-btn"
          onPress={handleSave}
          disabled={saving}
          style={({ pressed }) => [
            styles.saveBtn,
            pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] },
          ]}
        >
          <Text style={styles.saveBtnText}>
            {saving ? 'Updating...' : 'Update Category'}
          </Text>
        </Pressable>
      </View>

      {/* Confirm Delete Dialog */}
      <ConfirmDialog
        visible={showDelete}
        title="Delete Category?"
        message="This category will be archived. Transactions linked to this category will keep their records."
        confirmLabel="Delete"
        danger
        onConfirm={handleDelete}
        onCancel={() => setShowDelete(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: EthosColors.surface,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
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
    paddingTop:        EthosSpacing.stackLg,
    paddingBottom:     120,
    gap:               EthosSpacing.stackLg,
  },
  inputGroup: {
    gap: EthosSpacing.unit,
  },
  label: {
    ...EthosTypography.labelSm,
    color: EthosColors.outline,
  },
  underlinedInput: {
    ...EthosTypography.bodyMd,
    color:             EthosColors.onSurface,
    paddingVertical:   EthosSpacing.unit,
    borderBottomWidth: EthosBorder.width,
    borderBottomColor: EthosColors.outlineVariant,
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
  iconGrid: {
    flexDirection: 'row',
    flexWrap:      'wrap',
    gap:           EthosSpacing.unit,
  },
  iconTile: {
    width:          44,
    height:         44,
    borderRadius:   EthosRadius.base,
    alignItems:     'center',
    justifyContent: 'center',
    backgroundColor: EthosColors.surfaceContainerLowest,
  },
  iconTileInactive: {
    borderWidth: EthosBorder.width,
    borderColor: EthosColors.outlineVariant,
  },
  iconTileActive: {
    borderWidth: 1.5,
    borderColor: EthosColors.primary,
  },
  colorRow: {
    flexDirection: 'row',
    flexWrap:      'wrap',
    gap:           EthosSpacing.gutter,
  },
  colorDot: {
    width:        32,
    height:       32,
    borderRadius: EthosRadius.full,
  },
  colorDotActive: {
    borderWidth: 3,
    borderColor: EthosColors.onSurface,
  },
  secondaryActionsRow: {
    alignItems:     'center',
    justifyContent: 'center',
    marginTop:      EthosSpacing.stackLg,
    paddingTop:     EthosSpacing.stackMd,
    borderTopWidth: EthosBorder.width,
    borderTopColor: EthosColors.outlineVariant,
  },
  deleteBtn: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           6,
    padding:       EthosSpacing.unit,
  },
  deleteBtnText: {
    ...EthosTypography.labelMd,
    color: EthosColors.error,
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
