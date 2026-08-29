/**
 * AetherExpense — Export Backup Screen (Phase 10 stub)
 */
import React from 'react';
import { View, Text, useColorScheme } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSettingsStore } from '@/store/settingsStore';
import { DarkColors, LightColors, Spacing, FontSize, FontWeight } from '@/theme';
import { EmptyState } from '@/components/ui/EmptyState';

export default function ExportScreen() {
  const themeMode = useSettingsStore((s) => s.theme);
  const colorScheme = useColorScheme();
  const colors = (themeMode === 'system' ? colorScheme : themeMode) === 'dark' ? DarkColors : LightColors;
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <EmptyState icon="cloud-upload-outline" title="Export Backup" description="Full backup & export coming in Phase 10. Your data is stored safely on your device." />
    </SafeAreaView>
  );
}
