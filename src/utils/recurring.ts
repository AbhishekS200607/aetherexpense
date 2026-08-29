/**
 * AetherExpense — Recurring Transactions Generator Engine
 *
 * Checks due recurring rules on app launch / DB initialization.
 * Automatically generates planned income/expense transactions in SQLite.
 * Provides 100% deterministic duplicate protection via recurring_id and date matching.
 * Handles month-end calendar arithmetic safely (Jan 31 → Feb 28/29, leap years).
 */

import { eq, and, lte } from 'drizzle-orm';
import type { DrizzleDB } from '@/database/client';
import { recurringTransactions, transactions } from '@/database/schema';
import { todayISO, nowISO } from './dates';
import { generateUUID } from './uuid';

/**
 * Calculates the next valid date for a given frequency, safely handling
 * month-end variations (e.g., Jan 31 -> Feb 28/29, March 31 -> April 30).
 */
export function calculateNextOccurrence(currentDateStr: string, frequency: 'daily' | 'weekly' | 'monthly' | 'yearly'): string {
  const parts = currentDateStr.split('-').map(Number);
  const year = parts[0];
  const month = parts[1] - 1; // 0-indexed
  const day = parts[2];

  const dateObj = new Date(year, month, day);

  if (frequency === 'daily') {
    dateObj.setDate(dateObj.getDate() + 1);
  } else if (frequency === 'weekly') {
    dateObj.setDate(dateObj.getDate() + 7);
  } else if (frequency === 'monthly') {
    // Advance month by 1 while preserving target day if possible
    const targetMonth = month + 1;
    dateObj.setMonth(targetMonth);
    // If month overflowed (e.g., Jan 31 -> March 3), clamp to last day of target month
    if (dateObj.getMonth() !== (targetMonth % 12)) {
      dateObj.setDate(0); // Sets to last day of previous month
    }
  } else if (frequency === 'yearly') {
    const targetYear = year + 1;
    dateObj.setFullYear(targetYear);
    // Handle leap year Feb 29 -> Feb 28 in non-leap year
    if (dateObj.getMonth() !== month) {
      dateObj.setDate(0);
    }
  }

  const yyyy = dateObj.getFullYear();
  const mm = String(dateObj.getMonth() + 1).padStart(2, '0');
  const dd = String(dateObj.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * Automatically processes active recurring transactions whose next_run_date is <= today.
 * Inserts missing transactions and updates next_run_date idempotently.
 */
export async function processRecurringTransactions(db: DrizzleDB): Promise<number> {
  const today = todayISO();
  let generatedCount = 0;

  try {
    // Query active rules due on or before today
    const dueRules = await db
      .select()
      .from(recurringTransactions)
      .where(
        and(
          eq(recurringTransactions.is_active, 1),
          lte(recurringTransactions.next_run_date, today)
        )
      );

    if (dueRules.length === 0) return 0;

    const now = nowISO();

    for (const rule of dueRules) {
      let currentDate = rule.next_run_date;
      let iterations = 0;
      const MAX_MISSED_ITERATIONS = 12; // Safety limit for multi-month catchup

      while (currentDate <= today && iterations < MAX_MISSED_ITERATIONS) {
        iterations++;

        // 1. Duplicate Check: Check if transaction already exists for this rule & date
        const existingTxn = await db
          .select({ id: transactions.id })
          .from(transactions)
          .where(
            and(
              eq(transactions.recurring_id, rule.id),
              eq(transactions.date, currentDate)
            )
          )
          .limit(1);

        if (existingTxn.length === 0) {
          // 2. Generate transaction
          await db.insert(transactions).values({
            id:                     generateUUID(),
            type:                   rule.type,
            amount:                 rule.amount,
            category_id:            rule.category_id,
            account_id:             rule.account_id,
            transfer_to_account_id: null,
            date:                   currentDate,
            time:                   '09:00',
            note:                   rule.note || rule.merchant || 'Recurring Payment',
            merchant:               rule.merchant,
            payment_method:         rule.payment_method,
            is_recurring:           1,
            recurring_id:           rule.id,
            created_at:             now,
            updated_at:             now,
          });
          generatedCount++;
        }

        // 3. Compute next occurrence date
        const nextDate = calculateNextOccurrence(currentDate, rule.frequency as any);

        // Check if end_date reached
        if (rule.end_date && nextDate > rule.end_date) {
          await db
            .update(recurringTransactions)
            .set({
              is_active:     0,
              last_run_date: currentDate,
              updated_at:    now,
            })
            .where(eq(recurringTransactions.id, rule.id));
          break;
        }

        currentDate = nextDate;
      }

      // Update recurring rule with new next_run_date
      if (currentDate !== rule.next_run_date) {
        await db
          .update(recurringTransactions)
          .set({
            last_run_date: rule.next_run_date,
            next_run_date: currentDate,
            updated_at:    now,
          })
          .where(eq(recurringTransactions.id, rule.id));
      }
    }

    if (generatedCount > 0) {
      console.log(`[RecurringEngine] Generated ${generatedCount} due transactions cleanly`);
    }
  } catch (err) {
    console.error('[RecurringEngine] Error processing recurring transactions:', err);
  }

  return generatedCount;
}
