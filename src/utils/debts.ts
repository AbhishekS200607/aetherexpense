/**
 * AetherExpense — Debt & Loan Utility Operations
 *
 * 100% Offline SQLite CRUD operations for Debts, Loans, and Repayments.
 */

import { eq, desc, and } from 'drizzle-orm';
import type { DrizzleDB } from '@/database/client';
import { debts, debtRepayments, transactions, categories } from '@/database/schema';
import { generateUUID } from '@/utils/uuid';
import { todayISO, currentTimeHHMM } from '@/utils/dates';
import type {
  Debt,
  DebtRepayment,
  DebtsSummary,
  CreateDebtInput,
  CreateRepaymentInput,
} from '@/types/debts';

/** Helper to map raw database row to Debt domain object */
function mapDebtRow(row: any): Debt {
  return {
    id:              row.id,
    title:           row.title,
    personName:      row.person_name,
    type:            row.type as 'LENT' | 'BORROWED',
    totalAmount:     row.total_amount,
    remainingAmount: row.remaining_amount,
    dueDate:         row.due_date,
    status:          row.status as 'PENDING' | 'PARTIAL' | 'SETTLED',
    accountId:       row.account_id,
    note:            row.note,
    createdAt:       row.created_at,
    updatedAt:       row.updated_at,
  };
}

/** Helper to map raw database row to DebtRepayment domain object */
function mapRepaymentRow(row: any): DebtRepayment {
  return {
    id:            row.id,
    debtId:        row.debt_id,
    amount:        row.amount,
    paymentDate:   row.payment_date,
    accountId:     row.account_id,
    note:          row.note,
    transactionId: row.transaction_id,
    createdAt:     row.created_at,
  };
}

/**
 * Creates a new Debt or Loan record.
 * Optionally creates an initial balance-adjusting cashflow transaction.
 */
export async function createDebt(db: DrizzleDB, input: CreateDebtInput): Promise<Debt> {
  const debtId = generateUUID();
  const now = todayISO();

  const newDebt = {
    id:               debtId,
    title:            input.title.trim(),
    person_name:      input.personName.trim(),
    type:             input.type,
    total_amount:     input.totalAmountPaise,
    remaining_amount: input.totalAmountPaise,
    due_date:         input.dueDate || null,
    status:           'PENDING' as const,
    account_id:       input.accountId || null,
    note:             input.note ? input.note.trim() : null,
    created_at:       now,
    updated_at:       now,
  };

  await db.transaction(async (tx) => {
    await tx.insert(debts).values(newDebt);

    // If user opted to adjust account balance immediately on debt creation
    if (input.adjustAccountBalance && input.accountId) {
      const cats = await tx.select().from(categories).limit(1);
      const catId = cats[0]?.id || 'cat_other';

      await tx.insert(transactions).values({
        id:            generateUUID(),
        type:          input.type === 'LENT' ? 'expense' : 'income',
        amount:        input.totalAmountPaise,
        category_id:   catId,
        account_id:    input.accountId,
        date:          now,
        time:          currentTimeHHMM(),
        note:          `Initial ${input.type === 'LENT' ? 'Loan Lent to' : 'Borrowing from'} ${input.personName}`,
        merchant:      input.personName,
        payment_method: 'bank',
        created_at:    now,
        updated_at:    now,
      });
    }
  });

  return mapDebtRow(newDebt);
}

/**
 * Adds a repayment to an existing Debt/Loan record.
 * Recalculates remaining balance, updates status, and optionally adjusts account balance.
 */
export async function addDebtRepayment(
  db: DrizzleDB,
  input: CreateRepaymentInput
): Promise<DebtRepayment> {
  const debtRows = await db.select().from(debts).where(eq(debts.id, input.debtId));
  if (debtRows.length === 0) {
    throw new Error('Debt record not found');
  }
  const currentDebt = debtRows[0];

  const repaymentId = generateUUID();
  const now = todayISO();
  let transactionId: string | null = null;
  let newRepaymentObj: any = null;

  await db.transaction(async (tx) => {
    // Optional: Create transaction in account
    if (input.adjustAccountBalance && input.accountId) {
      const cats = await tx.select().from(categories).limit(1);
      const catId = cats[0]?.id || 'cat_other';
      transactionId = generateUUID();

      await tx.insert(transactions).values({
        id:            transactionId,
        type:          currentDebt.type === 'LENT' ? 'income' : 'expense',
        amount:        input.amountPaise,
        category_id:   catId,
        account_id:    input.accountId,
        date:          input.paymentDate || now,
        time:          currentTimeHHMM(),
        note:          `Repayment for ${currentDebt.title} (${currentDebt.person_name})`,
        merchant:      currentDebt.person_name,
        payment_method: 'bank',
        created_at:    now,
        updated_at:    now,
      });
    }

    // Insert repayment log
    newRepaymentObj = {
      id:             repaymentId,
      debt_id:        input.debtId,
      amount:         input.amountPaise,
      payment_date:   input.paymentDate || now,
      account_id:     input.accountId || null,
      note:           input.note ? input.note.trim() : null,
      transaction_id: transactionId,
      created_at:     now,
    };
    await tx.insert(debtRepayments).values(newRepaymentObj);

    // Recalculate remaining amount and status
    const newRemaining = Math.max(0, currentDebt.remaining_amount - input.amountPaise);
    const newStatus = newRemaining === 0 ? 'SETTLED' : 'PARTIAL';

    await tx
      .update(debts)
      .set({
        remaining_amount: newRemaining,
        status:           newStatus,
        updated_at:       now,
      })
      .where(eq(debts.id, input.debtId));
  });

  return mapRepaymentRow(newRepaymentObj);
}

/**
 * Instantly marks a debt/loan as fully settled / paid in full.
 */
export async function settleDebtInFull(
  db: DrizzleDB,
  debtId: string,
  accountId?: string | null,
  adjustAccountBalance = false
): Promise<void> {
  const dRows = await db.select().from(debts).where(eq(debts.id, debtId));
  if (dRows.length === 0) return;
  const debt = dRows[0];
  if (debt.remaining_amount <= 0 || debt.status === 'SETTLED') return;

  await addDebtRepayment(db, {
    debtId,
    amountPaise:           debt.remaining_amount,
    paymentDate:           todayISO(),
    accountId:             accountId || null,
    note:                  'Marked as Paid in Full',
    adjustAccountBalance:  adjustAccountBalance,
  });
}

/**
 * Fetches all Debts with optional filter.
 */
export async function getDebtsList(
  db: DrizzleDB,
  filterType: 'ALL' | 'LENT' | 'BORROWED' | 'SETTLED' = 'ALL'
): Promise<Debt[]> {
  let query = db.select().from(debts);

  let rows: any[] = [];
  if (filterType === 'LENT') {
    rows = await db.select().from(debts).where(eq(debts.type, 'LENT')).orderBy(desc(debts.created_at));
  } else if (filterType === 'BORROWED') {
    rows = await db.select().from(debts).where(eq(debts.type, 'BORROWED')).orderBy(desc(debts.created_at));
  } else if (filterType === 'SETTLED') {
    rows = await db.select().from(debts).where(eq(debts.status, 'SETTLED')).orderBy(desc(debts.created_at));
  } else {
    rows = await db.select().from(debts).orderBy(desc(debts.created_at));
  }

  return rows.map(mapDebtRow);
}

/**
 * Computes top summary analytics for Debts & Loans.
 */
export async function getDebtsSummary(db: DrizzleDB): Promise<DebtsSummary> {
  const allDebts = await db.select().from(debts);
  const today = todayISO();

  let totalLent = 0;
  let totalBorrowed = 0;
  let activeLentCount = 0;
  let activeBorrowCount = 0;
  let overdueCount = 0;

  for (const d of allDebts) {
    if (d.status !== 'SETTLED') {
      if (d.type === 'LENT') {
        totalLent += d.remaining_amount;
        activeLentCount++;
      } else {
        totalBorrowed += d.remaining_amount;
        activeBorrowCount++;
      }

      if (d.due_date && d.due_date < today) {
        overdueCount++;
      }
    }
  }

  return {
    totalLent,
    totalBorrowed,
    netPosition: totalLent - totalBorrowed,
    activeLentCount,
    activeBorrowCount,
    overdueCount,
  };
}

/**
 * Fetches a single debt detail record with its repayment timeline logs.
 */
export async function getDebtDetails(
  db: DrizzleDB,
  debtId: string
): Promise<{ debt: Debt; repayments: DebtRepayment[] } | null> {
  const dRows = await db.select().from(debts).where(eq(debts.id, debtId));
  if (dRows.length === 0) return null;

  const rRows = await db
    .select()
    .from(debtRepayments)
    .where(eq(debtRepayments.debt_id, debtId))
    .orderBy(desc(debtRepayments.created_at));

  return {
    debt:       mapDebtRow(dRows[0]),
    repayments: rRows.map(mapRepaymentRow),
  };
}

/**
 * Deletes a debt record (repayments cascade delete via SQLite foreign key).
 */
export async function deleteDebt(db: DrizzleDB, debtId: string): Promise<void> {
  await db.delete(debts).where(eq(debts.id, debtId));
}
