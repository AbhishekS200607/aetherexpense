/**
 * AetherExpense — Root Layout
 *
 * Responsibilities:
 * 1. Initialize SQLite database with Drizzle migrations
 * 2. Seed default categories and settings on first launch
 * 3. Load settings into Zustand store
 * 4. Provide theme context
 * 5. Handle splash screen
 * 6. Set up navigation stack
 */

import 'react-native-reanimated';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, View, StyleSheet, useColorScheme, StatusBar } from 'react-native';
import { LockScreen } from '@/components/security/LockScreen';
import { getLockType, getAutoLockDelay, LockType } from '@/utils/security';
import { Stack } from 'expo-router';
import { SQLiteProvider, useSQLiteContext } from 'expo-sqlite';
import { useMigrations } from 'drizzle-orm/expo-sqlite/migrator';
import * as SplashScreen from 'expo-splash-screen';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import {
  useFonts,
  Inter_200ExtraLight,
  Inter_300Light,
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from '@expo-google-fonts/inter';
import { DB_NAME, createDrizzleDB } from '@/database/client';
import { seedDatabase } from '@/database/seed';
import { processRecurringTransactions } from '@/utils/recurring';
import { useAppStore } from '@/store/appStore';
import { useSettingsStore } from '@/store/settingsStore';
import { DarkColors, LightColors } from '@/theme';
import { EthosColors } from '@/theme/ethos';
import { settings } from '@/database/schema';
import migrations from '@/database/migrations/migrations';
import type { AppSettings } from '@/types/settings';

SplashScreen.preventAutoHideAsync();

// ─── Database Initializer ─────────────────────────────────────────────────────

/**
 * Runs inside SQLiteProvider. Has access to the SQLite context.
 * Runs Drizzle migrations, then seeds the DB and loads settings into Zustand.
 */
function DatabaseInitializer({ children }: { children: React.ReactNode }) {
  const sqliteDb = useSQLiteContext();
  const db = React.useMemo(() => createDrizzleDB(sqliteDb), [sqliteDb]);
  const { success: migrationsSuccess, error: migrationsError } = useMigrations(db, migrations);
  const setDbReady = useAppStore((s) => s.setDbReady);
  const updateSettings = useSettingsStore((s) => s.updateSettings);
  const setHydrated = useSettingsStore((s) => s.setHydrated);

  useEffect(() => {
    console.log('[APP START] Initializing DatabaseInitializer');
    console.log('[SQLite OPEN] SQLiteProvider initialized');
    console.log('[MIGRATIONS START] Running Drizzle migrations...');
  }, []);

  useEffect(() => {
    if (!migrationsSuccess) return;

    console.log('[MIGRATIONS SUCCESS] Drizzle migrations completed successfully');

    async function initialize() {
      try {
        // Seed default categories and settings (idempotent)
        await seedDatabase(db);

        // Auto-generate due recurring transactions cleanly
        await processRecurringTransactions(db);

        // Load persisted settings into Zustand store
        const rows = await db.select().from(settings);
        const settingsMap: Partial<AppSettings> = {};
        for (const row of rows) {
          const key = row.key as keyof AppSettings;
          const value = row.value;
          if (value === 'true') {
            (settingsMap as any)[key] = true;
          } else if (value === 'false') {
            (settingsMap as any)[key] = false;
          } else if (!isNaN(Number(value)) && value.trim() !== '') {
            (settingsMap as any)[key] = Number(value);
          } else {
            (settingsMap as any)[key] = value;
          }
        }
        updateSettings(settingsMap);
        setHydrated(true);
        setDbReady(true);
        console.log('[DATABASE READY] Database seeded and store hydrated');
      } catch (err) {
        console.error('[DB Init] Error during initialization:', err);
        setHydrated(true);
        setDbReady(true);
        console.log('[DATABASE READY] Fallback database ready after error');
      }
    }

    initialize();
  }, [migrationsSuccess, db, setDbReady, setHydrated, updateSettings]);

  if (migrationsError) {
    console.error('[Migrations] Error running migrations:', migrationsError);
  }

  return <>{children}</>;
}

// ─── App Layout ───────────────────────────────────────────────────────────────

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Inter_200ExtraLight,
    Inter_300Light,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  const colorScheme = useColorScheme();
  const dbReady = useAppStore((s) => s.dbReady);
  const dataVersion = useAppStore((s) => s.dataVersion);
  const themeMode = useSettingsStore((s) => s.theme);

  const [isLocked, setIsLocked] = useState(false);
  const [lockType, setLockTypeState] = useState<LockType>('off');
  const backgroundTimestamp = useRef<number | null>(null);

  // Initial Lock Check on Launch
  useEffect(() => {
    if (!dbReady) return;
    async function checkInitialLock() {
      const lType = await getLockType();
      setLockTypeState(lType);
      if (lType !== 'off') {
        setIsLocked(true);
      }
    }
    checkInitialLock();
  }, [dbReady, dataVersion]);

  // AppState Listener for Background Auto-Lock Timer
  useEffect(() => {
    const sub = AppState.addEventListener('change', async (nextState) => {
      if (nextState === 'background' || nextState === 'inactive') {
        backgroundTimestamp.current = Date.now();
      } else if (nextState === 'active') {
        const lType = await getLockType();
        setLockTypeState(lType);
        if (lType !== 'off' && backgroundTimestamp.current) {
          const delay = await getAutoLockDelay();
          const elapsedSec = (Date.now() - backgroundTimestamp.current) / 1000;
          if (elapsedSec >= delay) {
            setIsLocked(true);
          }
        }
        backgroundTimestamp.current = null;
      }
    });
    return () => sub.remove();
  }, []);

  const effectiveScheme =
    themeMode === 'system' ? colorScheme : themeMode;
  const colors = effectiveScheme === 'dark' ? DarkColors : LightColors;

  // Hide Splash Screen when database is ready and fonts are loaded
  useEffect(() => {
    if (dbReady && fontsLoaded) {
      SplashScreen.hideAsync()
        .then(() => {
          console.log('[SPLASH HIDDEN] SplashScreen hidden, rendering Dashboard');
        })
        .catch((err) => {
          console.warn('[SplashScreen] Error hiding splash screen:', err);
        });
    }
  }, [dbReady, fontsLoaded]);

  const onLayoutRootView = useCallback(async () => {
    if (dbReady && fontsLoaded) {
      await SplashScreen.hideAsync().catch(() => {});
    }
  }, [dbReady, fontsLoaded]);

  return (
    <GestureHandlerRootView style={styles.root}>
      <SQLiteProvider
        databaseName={DB_NAME}
        useSuspense={false}
        onInit={async (db) => {
          // Enable WAL mode for better concurrent read performance
          await db.execAsync('PRAGMA journal_mode = WAL;');
          await db.execAsync('PRAGMA foreign_keys = ON;');
        }}
      >
        <DatabaseInitializer>
          <View
            style={[styles.root, { backgroundColor: colors.background }]}
            onLayout={onLayoutRootView}
          >
            <StatusBar
              barStyle={effectiveScheme === 'dark' ? 'light-content' : 'dark-content'}
              backgroundColor={colors.background}
              translucent={false}
            />

            <LockScreen
              visible={isLocked}
              lockType={lockType}
              onUnlock={() => setIsLocked(false)}
            />
            <Stack
              screenOptions={{
                headerStyle: { backgroundColor: colors.surface },
                headerTintColor: colors.textPrimary,
                headerShadowVisible: false,
                contentStyle: { backgroundColor: colors.background },
                animation: 'slide_from_right',
              }}
            >
              <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
              <Stack.Screen
                name="accounts/index"
                options={{ title: 'Accounts & Wallets', headerShown: false }}
              />
              <Stack.Screen
                name="accounts/add"
                options={{
                  title: 'Add Account',
                  presentation: 'modal',
                  animation: 'slide_from_bottom',
                  headerShown: false,
                }}
              />
              <Stack.Screen
                name="accounts/[id]"
                options={{ title: 'Account Details', headerShown: false }}
              />
              <Stack.Screen
                name="accounts/edit/[id]"
                options={{
                  title: 'Edit Account',
                  presentation: 'modal',
                  animation: 'slide_from_bottom',
                  headerShown: false,
                }}
              />
              <Stack.Screen
                name="transaction/transfer"
                options={{
                  title: 'Transfer Money',
                  presentation: 'modal',
                  animation: 'slide_from_bottom',
                  headerShown: false,
                }}
              />
              <Stack.Screen
                name="transaction/add"
                options={{
                  title: 'Add Transaction',
                  presentation: 'modal',
                  animation: 'slide_from_bottom',
                  headerShown: false,
                }}
              />
              <Stack.Screen
                name="transaction/[id]"
                options={{ title: 'Transaction Details' }}
              />
              <Stack.Screen
                name="transaction/edit/[id]"
                options={{
                  title: 'Edit Transaction',
                  presentation: 'modal',
                  animation: 'slide_from_bottom',
                }}
              />
              <Stack.Screen
                name="categories/index"
                options={{ title: 'Categories', headerShown: false }}
              />
              <Stack.Screen
                name="categories/add"
                options={{
                  title: 'Add Category',
                  presentation: 'modal',
                  animation: 'slide_from_bottom',
                  headerShown: false,
                }}
              />
              <Stack.Screen
                name="categories/edit/[id]"
                options={{
                  title: 'Edit Category',
                  presentation: 'modal',
                  animation: 'slide_from_bottom',
                  headerShown: false,
                }}
              />
              <Stack.Screen
                name="budgets/add"
                options={{
                  title: 'Add Budget',
                  presentation: 'modal',
                  animation: 'slide_from_bottom',
                  headerShown: false,
                }}
              />
              <Stack.Screen
                name="budgets/edit/[id]"
                options={{
                  title: 'Edit Budget',
                  presentation: 'modal',
                  animation: 'slide_from_bottom',
                  headerShown: false,
                }}
              />
              <Stack.Screen
                name="recurring/index"
                options={{ title: 'Recurring Transactions', headerShown: false }}
              />
              <Stack.Screen
                name="recurring/add"
                options={{
                  title: 'Add Recurring Rule',
                  presentation: 'modal',
                  animation: 'slide_from_bottom',
                  headerShown: false,
                }}
              />
              <Stack.Screen
                name="recurring/edit/[id]"
                options={{
                  title: 'Edit Recurring Rule',
                  presentation: 'modal',
                  animation: 'slide_from_bottom',
                  headerShown: false,
                }}
              />
              <Stack.Screen
                name="bills/index"
                options={{ title: 'Bills & Reminders', headerShown: false }}
              />
              <Stack.Screen
                name="bills/add"
                options={{
                  title: 'Add Bill',
                  presentation: 'modal',
                  animation: 'slide_from_bottom',
                  headerShown: false,
                }}
              />
              <Stack.Screen
                name="bills/edit/[id]"
                options={{
                  title: 'Edit Bill',
                  presentation: 'modal',
                  animation: 'slide_from_bottom',
                  headerShown: false,
                }}
              />
              <Stack.Screen
                name="settings/security"
                options={{ title: 'Security' }}
              />
              <Stack.Screen
                name="settings/notifications"
                options={{ title: 'Notifications' }}
              />
              <Stack.Screen
                name="settings/data"
                options={{ title: 'Data Management' }}
              />
              <Stack.Screen
                name="scan"
                options={{
                  title: 'Smart Scan',
                  presentation: 'modal',
                  animation: 'slide_from_bottom',
                  headerShown: false,
                }}
              />
            </Stack>
          </View>
        </DatabaseInitializer>
      </SQLiteProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
});
