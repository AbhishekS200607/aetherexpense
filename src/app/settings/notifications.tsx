/**
 * AetherExpense — Notification Settings Screen (Phase 8 stub)
 */
import React from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSettingsStore } from '@/store/settingsStore';
import { useColorScheme } from 'react-native';
import { DarkColors, LightColors } from '@/theme';
import { EmptyState } from '@/components/ui/EmptyState';

export default function NotificationsScreen() {
  const themeMode = useSettingsStore((s) => s.theme);
  const colorScheme = useColorScheme();
  const colors = (themeMode === 'system' ? colorScheme : themeMode) === 'dark' ? DarkColors : LightColors;
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <EmptyState icon="notifications-outline" title="Notification Settings" description="Daily reminders and budget alerts coming in Phase 8." />
    </SafeAreaView>
  );
}
