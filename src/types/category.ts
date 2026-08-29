/**
 * AetherExpense — Category Types
 */

export type CategoryType = 'income' | 'expense';

export interface Category {
  id:          string;
  name:        string;
  type:        CategoryType;
  icon:        string;   // Ionicons name
  color:       string;   // hex color
  is_default:  0 | 1;
  is_active:   0 | 1;
  sort_order:  number;
  created_at:  string;
  updated_at:  string;
}

export interface CategoryFormData {
  name:       string;
  type:       CategoryType;
  icon:       string;
  color:      string;
}

/** Summary of spending per category for a period */
export interface CategorySummary {
  category:     Category;
  total_amount: number;   // minor units
  count:        number;
  percentage:   number;   // 0-100
}
