/**
 * AetherExpense — Transaction Types
 */

export type TransactionType = 'income' | 'expense' | 'transfer';

export type PaymentMethod =
  | 'cash'
  | 'bank'
  | 'upi'
  | 'credit_card'
  | 'debit_card'
  | 'other';

/** Raw DB row (amounts in minor units / paise) */
export interface Transaction {
  id:             string;
  type:           TransactionType;
  /** Amount in minor units (e.g. paise). Always positive. */
  amount:         number;
  category_id:    string;
  subcategory?:   string | null;
  date:           string;   // YYYY-MM-DD
  time:           string;   // HH:MM
  note?:          string | null;
  merchant?:      string | null;
  payment_method: PaymentMethod;
  receipt_path?:  string | null;
  is_recurring:   0 | 1;
  recurring_id?:  string | null;
  created_at:     string;   // ISO 8601
  updated_at:     string;
}

/** Transaction with resolved category and tags */
export interface TransactionWithCategory extends Transaction {
  category_name:  string;
  category_icon:  string;
  category_color: string;
  tags:           Tag[];
}

/** Form input (user-facing, decimal amounts) */
export interface TransactionFormData {
  type:           TransactionType;
  /** Display amount string e.g. "100.50" */
  amount:         string;
  category_id:    string;
  subcategory?:   string;
  date:           string;
  time:           string;
  note?:          string;
  merchant?:      string;
  payment_method: PaymentMethod;
  tags?:          string[];
}

export interface Tag {
  id:         string;
  name:       string;
  color:      string;
  created_at: string;
}

export interface TransactionTag {
  transaction_id: string;
  tag_id:         string;
}

/** Filter state for transaction list */
export interface TransactionFilter {
  type?:            TransactionType;
  category_ids?:    string[];
  payment_methods?: PaymentMethod[];
  date_from?:       string;
  date_to?:         string;
  amount_min?:      number;
  amount_max?:      number;
  tag_ids?:         string[];
  search?:          string;
}

export type SortField = 'date' | 'amount' | 'merchant';
export type SortOrder = 'asc' | 'desc';

export interface TransactionSort {
  field: SortField;
  order: SortOrder;
}
