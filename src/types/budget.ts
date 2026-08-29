/**
 * AetherExpense — Budget Types
 */

export type BudgetPeriod = 'weekly' | 'monthly' | 'yearly' | 'custom';

export interface Budget {
  id:           string;
  name:         string;
  /** Limit amount in minor units */
  amount:       number;
  period:       BudgetPeriod;
  start_date:   string;   // YYYY-MM-DD
  end_date?:    string | null;
  /** NULL = overall budget (not category-specific) */
  category_id?: string | null;
  /** Percentage at which to show warning (default 80) */
  warn_at:      number;
  is_active:    0 | 1;
  created_at:   string;
  updated_at:   string;
}

export interface BudgetFormData {
  name:         string;
  amount:       string;   // display string
  period:       BudgetPeriod;
  start_date:   string;
  end_date?:    string;
  category_id?: string;
  warn_at?:     number;
}

/** Budget with computed spending data */
export interface BudgetWithProgress extends Budget {
  spent:        number;   // minor units spent so far
  remaining:    number;   // minor units remaining
  percentage:   number;   // 0-100+
  is_exceeded:  boolean;
  is_warned:    boolean;
  category_name?: string;
  category_icon?: string;
  category_color?: string;
}
