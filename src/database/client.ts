/**
 * AetherExpense — Database Client & Pragma Manager
 *
 * Provides typed Drizzle ORM instances wrapping expo-sqlite,
 * WAL journal mode configuration, foreign key enforcement, and
 * PRAGMA user_version schema migration tracking.
 */

import { drizzle } from 'drizzle-orm/expo-sqlite';
import * as SQLite from 'expo-sqlite';
import * as schema from './schema';

export const DB_NAME = 'aetherexpense.db';
export const CURRENT_DB_VERSION = 1;

/**
 * Open the SQLite database synchronously.
 */
export function openDatabase() {
  return SQLite.openDatabaseSync(DB_NAME);
}

/**
 * Create a typed Drizzle ORM instance from an opened SQLite handle.
 */
export function createDrizzleDB(sqliteDb: SQLite.SQLiteDatabase) {
  return drizzle(sqliteDb, { schema, logger: __DEV__ });
}

export type DrizzleDB = ReturnType<typeof createDrizzleDB>;

/**
 * Configures performance & security PRAGMAs on database connection:
 * - WAL journal mode (prevents UI lockups during writes)
 * - Foreign key enforcement
 * - Version migration tracking via PRAGMA user_version
 */
export async function configureDatabasePragmas(sqliteDb: SQLite.SQLiteDatabase): Promise<number> {
  try {
    await sqliteDb.execAsync('PRAGMA journal_mode = WAL;');
    await sqliteDb.execAsync('PRAGMA foreign_keys = ON;');

    const result = await sqliteDb.getFirstAsync<{ user_version: number }>('PRAGMA user_version;');
    const currentVersion = result?.user_version ?? 0;
    console.log(`[DB Pragma] WAL mode enabled. Current PRAGMA user_version: ${currentVersion}`);
    return currentVersion;
  } catch (err) {
    console.error('[DB Pragma] Error configuring database pragmas:', err);
    return 0;
  }
}

/**
 * Sets the database user_version PRAGMA.
 */
export async function setDatabaseVersion(sqliteDb: SQLite.SQLiteDatabase, version: number): Promise<void> {
  await sqliteDb.execAsync(`PRAGMA user_version = ${version};`);
  console.log(`[DB Version] PRAGMA user_version updated to ${version}`);
}

