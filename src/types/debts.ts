/**
 * AetherExpense — Debt & Loan Tracking Types
 *
 * Distinguishes pending cash flow (IOUs, freelance invoices, borrowings)
 * from standard budget expenses and income.
 */

export type DebtType = 'LENT' | 'BORROWED';
export type DebtStatus = 'PENDING' | 'PARTIAL' | 'SETTLED';

export interface Debt {
  id:               string;
  title:            string;
  personName:       string;
  type:             DebtType;
  totalAmount:      number; // minor units (paise)
  remainingAmount:  number; // minor units (paise)
  dueDate?:         string | null; // YYYY-MM-DD
  status:           DebtStatus;
  accountId?:       string | null;
  note?:            string | null;
  createdAt:        string;
  updatedAt:        string;
}

export interface DebtRepayment {
  id:             string;
  debtId:         string;
  amount:         number; // minor units (paise)
  paymentDate:    string; // YYYY-MM-DD
  accountId?:     string | null;
  note?:          string | null;
  transactionId?: string | null;
  createdAt:      string;
}

export interface DebtsSummary {
  totalLent:         number; // total outstanding money owed to user
  totalBorrowed:     number; // total outstanding money user owes
  netPosition:       number; // totalLent - totalBorrowed
  activeLentCount:   number;
  activeBorrowCount: number;
  overdueCount:      number;
}

export interface CreateDebtInput {
  title:                 string;
  personName:            string;
  type:                  DebtType;
  totalAmountPaise:      number;
  dueDate?:              string | null;
  note?:                 string | null;
  accountId?:            string | null;
  adjustAccountBalance?: boolean;
}

export interface CreateRepaymentInput {
  debtId:                string;
  amountPaise:           number;
  paymentDate:           string;
  accountId?:            string | null;
  note?:                 string | null;
  adjustAccountBalance?: boolean;
}
