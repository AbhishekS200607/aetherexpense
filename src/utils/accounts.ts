/**
 * AetherExpense — Accounts Utilities & Calculations
 *
 * Computes current balance for accounts based on opening balance,
 * income, expenses, and inter-account transfers.
 * All monetary amounts are stored & processed as INTEGER minor units (paise).
 */

import { eq } from 'drizzle-orm';
import type { DrizzleDB } from '@/database/client';
import { accounts, type AccountRow } from '@/database/schema';

export type Account = AccountRow;

export async function getAccounts(db: DrizzleDB): Promise<Account[]> {
  return await db.select().from(accounts).where(eq(accounts.is_active, 1));
}

export interface TxnSummaryItem {
  id:                     string;
  type:                   'income' | 'expense' | 'transfer';
  amount:                 number;
  account_id:             string | null;
  transfer_to_account_id: string | null;
}

/**
 * Calculate current balance for a single account.
 */
export function calculateAccountBalance(
  openingBalance: number,
  accountId: string,
  transactionsList: TxnSummaryItem[]
): number {
  let incomeSum = 0;
  let expenseSum = 0;
  let transferInSum = 0;
  let transferOutSum = 0;

  for (const t of transactionsList) {
    if (t.type === 'income' && t.account_id === accountId) {
      incomeSum += t.amount;
    } else if (t.type === 'expense' && t.account_id === accountId) {
      expenseSum += t.amount;
    } else if (t.type === 'transfer') {
      if (t.transfer_to_account_id === accountId) {
        transferInSum += t.amount;
      }
      if (t.account_id === accountId) {
        transferOutSum += t.amount;
      }
    }
  }

  return openingBalance + incomeSum - expenseSum + transferInSum - transferOutSum;
}

/**
 * Map account type to display label and default Ionicons icon name.
 */
export const ACCOUNT_TYPE_CONFIG: Record<
  string,
  { label: string; defaultIcon: string; defaultColor: string }
> = {
  cash:        { label: 'Cash Wallet',    defaultIcon: 'cash-outline',     defaultColor: '#059669' },
  bank:        { label: 'Bank Account',   defaultIcon: 'business-outline', defaultColor: '#2563EB' },
  upi:         { label: 'UPI Account',    defaultIcon: 'qr-code-outline',  defaultColor: '#7C3AED' },
  debit_card:  { label: 'Debit Card',     defaultIcon: 'card-outline',     defaultColor: '#0284C7' },
  credit_card: { label: 'Credit Card',    defaultIcon: 'card-outline',     defaultColor: '#DC2626' },
  savings:     { label: 'Savings Account',defaultIcon: 'wallet-outline',   defaultColor: '#059669' },
  custom:      { label: 'Custom Account', defaultIcon: 'briefcase-outline',defaultColor: '#475569' },
};

/**
 * Calculates current balance for a specific account ID directly from SQLite database.
 */
export async function getAccountCurrentBalance(db: DrizzleDB, accountId: string): Promise<number> {
  const accRows = await db.select().from(accounts).where(eq(accounts.id, accountId));
  if (accRows.length === 0) return 0;
  const targetAcc = accRows[0];

  const { transactions } = await import('@/database/schema');
  const allTxns = await db.select({
    id:                     transactions.id,
    type:                   transactions.type,
    amount:                 transactions.amount,
    account_id:             transactions.account_id,
    transfer_to_account_id: transactions.transfer_to_account_id,
  }).from(transactions);

  return calculateAccountBalance(targetAcc.opening_balance, accountId, allTxns as TxnSummaryItem[]);
}

export interface ExecuteTransferInput {
  fromAccountId: string;
  toAccountId:   string;
  amountPaise:   number;
  date:          string;
  time:          string;
  note?:         string;
}

/**
 * Executes a 100% atomic financial transfer between two accounts.
 * Enforces:
 *   1. Source and target accounts must be different.
 *   2. Amount must be positive integer minor units.
 *   3. Insufficient Balance Check: Source account MUST have available balance >= amount.
 *   4. Atomic transaction wrapper: ROLLBACK if any step fails.
 */
export async function executeAccountTransfer(
  db: DrizzleDB,
  input: ExecuteTransferInput
): Promise<string> {
  if (!input.fromAccountId || !input.toAccountId) {
    throw new Error('Please select both source and target accounts.');
  }
  if (input.fromAccountId === input.toAccountId) {
    throw new Error('Source and target accounts must be different.');
  }
  if (input.amountPaise <= 0) {
    throw new Error('Transfer amount must be greater than zero.');
  }

  // 1. Verify available balance of source account
  const sourceBalance = await getAccountCurrentBalance(db, input.fromAccountId);
  if (sourceBalance < input.amountPaise) {
    const formattedAvailable = (sourceBalance / 100).toFixed(2);
    const formattedRequested = (input.amountPaise / 100).toFixed(2);
    throw new Error(
      `Insufficient balance in source account. Available: ₹${formattedAvailable}, Requested: ₹${formattedRequested}.`
    );
  }

  const { transactions, categories } = await import('@/database/schema');
  const { generateUUID } = await import('@/utils/uuid');
  const { nowISO } = await import('@/utils/dates');

  const transferTxnId = generateUUID();

  // 2. Wrap multi-step transfer in an atomic transaction
  await db.transaction(async (tx) => {
    const cats = await tx.select().from(categories).limit(1);
    const defaultCatId = cats[0]?.id ?? 'default-cat';
    const now = nowISO();

    await tx.insert(transactions).values({
      id:                     transferTxnId,
      type:                   'transfer',
      amount:                 input.amountPaise,
      category_id:            defaultCatId,
      account_id:             input.fromAccountId,
      transfer_to_account_id: input.toAccountId,
      date:                   input.date,
      time:                   input.time,
      note:                   input.note ? input.note.trim() : 'Account Transfer',
      merchant:               null,
      payment_method:         'bank',
      is_recurring:           0,
      created_at:             now,
      updated_at:             now,
    });
  });

  return transferTxnId;
}
