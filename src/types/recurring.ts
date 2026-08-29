/**
 * AetherExpense — Recurring Transaction Types
 */

import type { PaymentMethod, TransactionType } from './transaction';

export type RecurringFrequency = 'daily' | 'weekly' | 'monthly' | 'yearly';

export interface RecurringTransaction {
  id:              string;
  type:            TransactionType;
  /** Amount in minor units */
  amount:          number;
  category_id:     string;
  note?:           string | null;
  merchant?:       string | null;
  payment_method:  PaymentMethod;
  frequency:       RecurringFrequency;
  start_date:      string;      // YYYY-MM-DD
  end_date?:       string | null;
  last_run_date?:  string | null;
  next_run_date:   string;
  is_active:       0 | 1;
  notification_id?: string | null;
  created_at:      string;
  updated_at:      string;
}

export interface RecurringFormData {
  type:            TransactionType;
  amount:          string;
  category_id:     string;
  note?:           string;
  merchant?:       string;
  payment_method:  PaymentMethod;
  frequency:       RecurringFrequency;
  start_date:      string;
  end_date?:       string;
}
