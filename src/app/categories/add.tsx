/**
 * AetherExpense — Ethos Add Category Screen
 *
 * Form to create custom Expense or Income categories with icon and color selection.
 * Persists locally in SQLite database via Drizzle ORM.
 */

import React, { useState } from 'react';
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
import { Ionicons } from '@expo/vector-icons';
import { useSQLiteContext } from 'expo-sqlite';
import { generateUUID as uuidv4 } from '@/utils/uuid';

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
  '#6366F1', // Indigo
  '#10B981', // Emerald
  '#F59E0B', // Amber
  '#F43F5E', // Rose
  '#3B82F6', // Blue
  '#8B5CF6', // Violet
  '#06B6D4', // Cyan
  '#EC4899', // Pink
  '#000000', // Black
];

export default function AddCategoryScreen() {
  const sqliteDb = useSQLiteContext();
  const params = useLocalSearchParams<{ type?: string }>();
  const invalidateData = useAppStore((s) => s.invalidateData);

  const [name, setName] = useState('');
  const [type, setType] = useState<'expense' | 'income'>(
    params.type === 'income' ? 'income' : 'expense'
  );
  const [selectedIcon, setSelectedIcon] = useState('restaurant');
  const [selectedColor, setSelectedColor] = useState('#6366F1');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert('Required', 'Please enter a category name.');
      return;
    }

    setSaving(true);
    try {
      const db = createDrizzleDB(sqliteDb);
      const now = nowISO();

      await db.insert(categories).values({
        id:         uuidv4(),
        name:       name.trim(),
        type,
        icon:       selectedIcon,
        color:      selectedColor,
        is_default: 0,
        is_active:  1,
        sort_order: 99,
        created_at: now,
        updated_at: now,
      });

      invalidateData();
      router.back();
    } catch (err) {
      console.error('[AddCategoryScreen] Save error:', err);
      Alert.alert('Error', 'Could not save category.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      {/* Top Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.navBtn}>
          <Ionicons name="arrow-back" size={24} color={EthosColors.onSurface} />
        </Pressable>
        <Text style={styles.headerTitle}>Add Category</Text>
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
              autoFocus
              value={name}
              onChangeText={setName}
              placeholder="e.g. Subscriptions"
              placeholderTextColor={EthosColors.outline}
              style={styles.underlinedInput}
            />
          </View>

          {/* Type Toggle (EXPENSE / INCOME) */}
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
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Footer Save Button */}
      <View style={styles.footer}>
        <Pressable
          id="save-category-btn"
          onPress={handleSave}
          disabled={saving}
          style={({ pressed }) => [
            styles.saveBtn,
            pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] },
          ]}
        >
          <Text style={styles.saveBtnText}>
            {saving ? 'Saving...' : 'Save Category'}
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
