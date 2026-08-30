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

let initInvocationCount = 0;

/**
 * Runs inside SQLiteProvider. Has access to the SQLite context.
 * Runs Drizzle migrations, then seeds the DB and loads settings into Zustand.
 */
function DatabaseInitializer({ children }: { children: React.ReactNode }) {
  const sqliteDb = useSQLiteContext();
  const db = React.useMemo(() => {
    if (!sqliteDb) {
      console.error('[DB Init] sqliteDb is null or undefined!');
      return null;
    }
    return createDrizzleDB(sqliteDb);
  }, [sqliteDb]);

  const { success: migrationsSuccess, error: migrationsError } = useMigrations(
    db!,
    migrations
  );

  const setDbReady = useAppStore((s) => s.setDbReady);
  const updateSettings = useSettingsStore((s) => s.updateSettings);
  const setHydrated = useSettingsStore((s) => s.setHydrated);

  const isInitializingRef = useRef(false);
  const hasInitializedRef = useRef(false);

  useEffect(() => {
    initInvocationCount++;
    console.log(`[DB Init] Initializing DatabaseInitializer (Invocation Count: ${initInvocationCount}, DB_NAME: "${DB_NAME}")`);
    console.log(`[DB Init] Drizzle DB valid: ${db !== null}, sqliteDb valid: ${sqliteDb !== null}`);
  }, [db, sqliteDb]);

  useEffect(() => {
    // CRITICAL: DO NOT execute seeding, ALTER statements, or queries until migrations complete successfully!
    if (!migrationsSuccess || !sqliteDb || !db) {
      if (migrationsError) {
        console.error('[Migrations Error] Drizzle migration failed:', migrationsError);
      } else {
        console.log('[MIGRATIONS START] Waiting for Drizzle migrations to complete...');
      }
      return;
    }

    if (hasInitializedRef.current || isInitializingRef.current) {
      console.log('[DB Init] Initialization already in progress or completed. Skipping duplicate call.');
      return;
    }

    async function initialize() {
      isInitializingRef.current = true;
      console.log('[DB Init] Database initialization START');

      try {
        console.log('[MIGRATIONS END] Drizzle migrations finished successfully');

        // Seed default categories and settings (idempotent)
        console.log('[SEED START] Seeding default database data...');
        await seedDatabase(db!);
        console.log('[SEED END] Database seeding completed successfully');

        // Auto-generate due recurring transactions
        await processRecurringTransactions(db!);

        // Load persisted settings into Zustand store
        const rows = await db!.select().from(settings);
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
        hasInitializedRef.current = true;
        console.log('[DB Init] Database initialization END — Database ready & hydrated');
      } catch (err) {
        console.error('[DB Init] Error during database initialization:', err);
        setHydrated(true);
        setDbReady(false);
        useAppStore.getState().setError(`Database initialization failure: ${err instanceof Error ? err.message : String(err)}`);
      } finally {
        isInitializingRef.current = false;
      }
    }

    initialize();
  }, [migrationsSuccess, migrationsError, sqliteDb, db, setDbReady, setHydrated, updateSettings]);

  if (migrationsError) {
    console.warn('[Migrations Notice] Drizzle migrations error:', migrationsError);
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
  const isLocked = useAppStore((s) => s.isLocked);
  const setIsLocked = useAppStore((s) => s.setIsLocked);
  const themeMode = useSettingsStore((s) => s.theme);

  const [lockType, setLockTypeState] = useState<LockType>('off');
  const [securityChecked, setSecurityChecked] = useState(false);
  const backgroundTimestamp = useRef<number | null>(null);

  // Security Lock State Synchronization (runs on Launch, Data Invalidation, & Lock Toggle)
  useEffect(() => {
    async function syncSecurityLock() {
      if (!dbReady) return;
      try {
        const lType = await getLockType();
        setLockTypeState(lType);
        if (lType === 'off') {
          setIsLocked(false);
        } else if (!securityChecked) {
          // Force lock screen on cold application launch
          setIsLocked(true);
        }
      } catch (err) {
        console.warn('[Security] Check failed:', err);
      } finally {
        setSecurityChecked(true);
      }
    }
    syncSecurityLock();
  }, [dbReady, dataVersion, isLocked, setIsLocked, securityChecked]);

  // AppState Listener for Background Auto-Lock Timer
  useEffect(() => {
    const sub = AppState.addEventListener('change', async (nextState) => {
      console.log(`[APPSTATE] state changed to: ${nextState}`);
      const lType = await getLockType();
      setLockTypeState(lType);
      if (lType === 'off') return;

      const delay = await getAutoLockDelay();

      if (nextState === 'background' || nextState === 'inactive') {
        console.log('[APPSTATE] background or inactive');
        if (delay === 0) {
          console.log('[APPLOCK] locking (Immediate on background/inactive)');
          setIsLocked(true);
        } else if (!backgroundTimestamp.current) {
          backgroundTimestamp.current = Date.now();
        }
      } else if (nextState === 'active') {
        console.log('[APPSTATE] active');
        if (backgroundTimestamp.current) {
          const elapsedSec = (Date.now() - backgroundTimestamp.current) / 1000;
          if (elapsedSec >= delay) {
            console.log(`[APPLOCK] locking (Elapsed: ${elapsedSec}s >= Delay: ${delay}s)`);
            setIsLocked(true);
          } else {
            console.log(`[APPLOCK] unlocked (Elapsed: ${elapsedSec}s < Delay: ${delay}s)`);
          }
        }
        backgroundTimestamp.current = null;
      }
    });
    return () => sub.remove();
  }, [setIsLocked]);

  const effectiveScheme =
    themeMode === 'system' ? colorScheme : themeMode;
  const colors = effectiveScheme === 'dark' ? DarkColors : LightColors;

  // Memoized SQLiteProvider onInit handler to prevent Provider recreation on RootLayout re-renders
  const handleSQLiteInit = useCallback(async (db: any) => {
    console.log('[SQLITE] provider mounted / onInit executing');
    await db.execAsync('PRAGMA journal_mode = WAL;');
    await db.execAsync('PRAGMA foreign_keys = ON;');
  }, []);

  useEffect(() => {
    console.log('[SQLITE] provider mounted');
    return () => {
      console.log('[SQLITE] provider unmounted');
    };
  }, []);

  // Hide Splash Screen ONLY when DB is ready, fonts are loaded, AND security check has completed!
  useEffect(() => {
    if (dbReady && fontsLoaded && securityChecked) {
      SplashScreen.hideAsync()
        .then(() => {
          console.log('[SPLASH HIDDEN] SplashScreen hidden, rendering Dashboard');
        })
        .catch((err) => {
          console.warn('[SplashScreen] Error hiding splash screen:', err);
        });
    }
  }, [dbReady, fontsLoaded, securityChecked]);

  const onLayoutRootView = useCallback(async () => {
    if (dbReady && fontsLoaded && securityChecked) {
      await SplashScreen.hideAsync().catch(() => {});
    }
  }, [dbReady, fontsLoaded, securityChecked]);

  return (
    <GestureHandlerRootView style={styles.root}>
      <SQLiteProvider
        databaseName={DB_NAME}
        useSuspense={false}
        onInit={handleSQLiteInit}
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
              <Stack.Screen
                name="assistant/index"
                options={{
                  title: 'AI Assistant',
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
