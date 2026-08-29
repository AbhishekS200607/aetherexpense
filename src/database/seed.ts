/**
 * AetherExpense — Database Seed
 *
 * Seeds default categories and settings on first launch.
 * Idempotent: checks for existing data before inserting.
 */

import { eq, like } from 'drizzle-orm';
import { generateUUID as uuidv4 } from '../utils/uuid';
import type { DrizzleDB } from './client';
import { categories, settings, accounts, transactions } from './schema';
import { ALL_DEFAULT_CATEGORIES } from '../constants/categories';
import { DEFAULT_SETTINGS } from '../types/settings';
import { nowISO } from '../utils/dates';

export async function seedDatabase(db: DrizzleDB): Promise<void> {
  await seedCategories(db);
  await seedSettings(db);
  await seedAccounts(db);
}

export async function cleanTestTransactions(db: DrizzleDB): Promise<void> {
  try {
    await db.delete(transactions).where(like(transactions.note, 'Test %'));
    console.log('[Seed] Safely removed test dataset transactions');
  } catch (err) {
    console.error('[Seed] Error cleaning test dataset:', err);
  }
}

export async function seedLargeTestTransactions(db: DrizzleDB, totalToSeed = 1050): Promise<void> {
  try {
    const existing = await db.select({ id: transactions.id }).from(transactions).limit(1050);
    if (existing.length >= 1000) return; // already seeded 1000+ transactions

    const catRows = await db.select().from(categories);
    const accRows = await db.select().from(accounts);
    if (catRows.length === 0 || accRows.length === 0) return;

    const expCats = catRows.filter((c) => c.type === 'expense');
    const incCats = catRows.filter((c) => c.type === 'income');

    const now = new Date();
    const batch: (typeof transactions.$inferInsert)[] = [];

    for (let i = 0; i < totalToSeed; i++) {
      // Distribute dates over past 90 days
      const dayOffset = Math.floor(Math.random() * 90);
      const d = new Date(now.getTime() - dayOffset * 24 * 60 * 60 * 1000);
      const dateStr = d.toISOString().split('T')[0];
      const isoNow = d.toISOString();

      const randType = Math.random();
      if (randType < 0.70 && expCats.length > 0) {
        // 70% Expense
        const cat = expCats[i % expCats.length];
        const acc = accRows[i % accRows.length];
        batch.push({
          id:          uuidv4(),
          type:        'expense',
          amount:      (Math.floor(Math.random() * 45) + 5) * 10000,
          date:        dateStr,
          time:        '12:00',
          category_id: cat.id,
          account_id:  acc.id,
          note:        `Test expense ${i + 1}`,
          merchant:    `Merchant ${(i % 10) + 1}`,
          created_at:  isoNow,
          updated_at:  isoNow,
        });
      } else if (randType < 0.90 && incCats.length > 0) {
        // 20% Income
        const cat = incCats[i % incCats.length];
        const acc = accRows[i % accRows.length];
        batch.push({
          id:          uuidv4(),
          type:        'income',
          amount:      (Math.floor(Math.random() * 100) + 20) * 10000,
          date:        dateStr,
          time:        '12:00',
          category_id: cat.id,
          account_id:  acc.id,
          note:        `Test income ${i + 1}`,
          created_at:  isoNow,
          updated_at:  isoNow,
        });
      } else if (accRows.length >= 2) {
        // 10% Transfer
        const fromAcc = accRows[i % accRows.length];
        const toAcc = accRows[(i + 1) % accRows.length];
        batch.push({
          id:                     uuidv4(),
          type:                   'transfer',
          amount:                 (Math.floor(Math.random() * 50) + 10) * 10000,
          date:                   dateStr,
          time:                   '12:00',
          category_id:            '',
          account_id:             fromAcc.id,
          transfer_to_account_id: toAcc.id,
          note:                   `Test transfer ${i + 1}`,
          created_at:             isoNow,
          updated_at:             isoNow,
        });
      }
    }

    const CHUNK_SIZE = 100;
    for (let c = 0; c < batch.length; c += CHUNK_SIZE) {
      const chunk = batch.slice(c, c + CHUNK_SIZE);
      await db.insert(transactions).values(chunk);
    }

    console.log(`[Seed] Successfully inserted ${batch.length} test transactions across 90 days`);
  } catch (err) {
    console.error('[Seed] Error inserting large test transactions:', err);
  }
}

async function seedAccounts(db: DrizzleDB): Promise<void> {
  try {
    const existing = await db.select({ id: accounts.id }).from(accounts).limit(1);
    if (existing.length > 0) return;

    const now = nowISO();
    const defaultAccounts = [
      {
        id:              uuidv4(),
        name:            'Cash Wallet',
        type:            'cash' as const,
        opening_balance: 0,
        icon:            'cash-outline',
        color:           '#059669',
        is_active:       1,
        sort_order:      1,
        created_at:      now,
        updated_at:      now,
      },
      {
        id:              uuidv4(),
        name:            'Bank Account',
        type:            'bank' as const,
        opening_balance: 0,
        icon:            'business-outline',
        color:           '#2563EB',
        is_active:       1,
        sort_order:      2,
        created_at:      now,
        updated_at:      now,
      },
      {
        id:              uuidv4(),
        name:            'UPI Account',
        type:            'upi' as const,
        opening_balance: 0,
        icon:            'qr-code-outline',
        color:           '#7C3AED',
        is_active:       1,
        sort_order:      3,
        created_at:      now,
        updated_at:      now,
      },
      {
        id:              uuidv4(),
        name:            'Credit Card',
        type:            'credit_card' as const,
        opening_balance: 0,
        icon:            'card-outline',
        color:           '#DC2626',
        is_active:       1,
        sort_order:      4,
        created_at:      now,
        updated_at:      now,
      },
    ];

    await db.insert(accounts).values(defaultAccounts);
    console.log(`[Seed] Inserted ${defaultAccounts.length} default accounts`);
  } catch (err) {
    console.error('[Seed] Error seeding accounts:', err);
  }
}

async function seedCategories(db: DrizzleDB): Promise<void> {
  // Check if any categories already exist
  const existing = await db.select({ id: categories.id }).from(categories).limit(1);
  if (existing.length > 0) return; // already seeded

  const now = nowISO();
  const rows = ALL_DEFAULT_CATEGORIES.map((cat) => ({
    id:         uuidv4(),
    name:       cat.name,
    type:       cat.type,
    icon:       cat.icon,
    color:      cat.color,
    is_default: 1 as 0 | 1,
    is_active:  1 as 0 | 1,
    sort_order: cat.sort_order,
    created_at: now,
    updated_at: now,
  }));

  await db.insert(categories).values(rows);
  console.log(`[Seed] Inserted ${rows.length} default categories`);
}

async function seedSettings(db: DrizzleDB): Promise<void> {
  const now = nowISO();
  const entries = Object.entries(DEFAULT_SETTINGS) as [string, unknown][];

  for (const [key, value] of entries) {
    const existing = await db
      .select()
      .from(settings)
      .where(eq(settings.key, key))
      .limit(1);

    if (existing.length === 0) {
      await db.insert(settings).values({
        key,
        value: String(value),
        updated_at: now,
      });
    }
  }
  console.log('[Seed] Settings initialized');
}
