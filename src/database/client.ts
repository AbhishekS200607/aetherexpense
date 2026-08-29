/**
 * AetherExpense — Database Client
 *
 * Provides a typed Drizzle ORM instance wrapping expo-sqlite.
 * The SQLiteProvider in _layout.tsx handles migrations and seeding.
 */

import { drizzle } from 'drizzle-orm/expo-sqlite';
import * as SQLite from 'expo-sqlite';
import * as schema from './schema';

export const DB_NAME = 'aetherexpense.db';

/**
 * Open the SQLite database.
 * Call this inside the SQLiteProvider onInit to get the db handle.
 */
export function openDatabase() {
  return SQLite.openDatabaseSync(DB_NAME);
}

/**
 * Create a Drizzle instance from an already-opened SQLite handle.
 * Pass the result of openDatabase() here.
 */
export function createDrizzleDB(sqliteDb: SQLite.SQLiteDatabase) {
  return drizzle(sqliteDb, { schema, logger: __DEV__ });
}

export type DrizzleDB = ReturnType<typeof createDrizzleDB>;
