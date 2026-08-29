/**
 * AetherExpense — Import Backup Screen (Phase 10 stub)
 */
import React from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSettingsStore } from '@/store/settingsStore';
import { useColorScheme } from 'react-native';
import { DarkColors, LightColors } from '@/theme';
import { EmptyState } from '@/components/ui/EmptyState';

export default function ImportScreen() {
  const themeMode = useSettingsStore((s) => s.theme);
  const colorScheme = useColorScheme();
  const colors = (themeMode === 'system' ? colorScheme : themeMode) === 'dark' ? DarkColors : LightColors;
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <EmptyState icon="cloud-download-outline" title="Import Backup" description="Full import with merge/replace options coming in Phase 10." />
    </SafeAreaView>
  );
}
