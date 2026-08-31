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
