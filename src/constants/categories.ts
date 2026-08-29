/**
 * AetherExpense — Default Categories
 * Seeded into the database on first launch.
 * Icons are from @expo/vector-icons Ionicons set.
 */

import type { CategoryType } from '../types/category';

interface DefaultCategory {
  name:       string;
  type:       CategoryType;
  icon:       string;
  color:      string;
  sort_order: number;
}

export const DEFAULT_EXPENSE_CATEGORIES: DefaultCategory[] = [
  { name: 'Food & Dining',    type: 'expense', icon: 'restaurant',        color: '#F59E0B', sort_order: 1 },
  { name: 'Groceries',        type: 'expense', icon: 'cart',              color: '#10B981', sort_order: 2 },
  { name: 'Transport',        type: 'expense', icon: 'car',               color: '#3B82F6', sort_order: 3 },
  { name: 'Shopping',         type: 'expense', icon: 'bag',               color: '#8B5CF6', sort_order: 4 },
  { name: 'Bills & Utilities',type: 'expense', icon: 'receipt',           color: '#EF4444', sort_order: 5 },
  { name: 'Entertainment',    type: 'expense', icon: 'film',              color: '#EC4899', sort_order: 6 },
  { name: 'Health',           type: 'expense', icon: 'medical',           color: '#F43F5E', sort_order: 7 },
  { name: 'Education',        type: 'expense', icon: 'school',            color: '#6366F1', sort_order: 8 },
  { name: 'Travel',           type: 'expense', icon: 'airplane',          color: '#06B6D4', sort_order: 9 },
  { name: 'Subscriptions',    type: 'expense', icon: 'repeat',            color: '#A855F7', sort_order: 10 },
  { name: 'Personal Care',    type: 'expense', icon: 'person',            color: '#F472B6', sort_order: 11 },
  { name: 'Home',             type: 'expense', icon: 'home',              color: '#84CC16', sort_order: 12 },
  { name: 'Fitness',          type: 'expense', icon: 'fitness',           color: '#14B8A6', sort_order: 13 },
  { name: 'Insurance',        type: 'expense', icon: 'shield-checkmark',  color: '#0EA5E9', sort_order: 14 },
  { name: 'Other',            type: 'expense', icon: 'ellipsis-horizontal',color: '#6B7280', sort_order: 15 },
];

export const DEFAULT_INCOME_CATEGORIES: DefaultCategory[] = [
  { name: 'Salary',           type: 'income', icon: 'briefcase',          color: '#10B981', sort_order: 1 },
  { name: 'Freelance',        type: 'income', icon: 'laptop',             color: '#6366F1', sort_order: 2 },
  { name: 'Business',         type: 'income', icon: 'storefront',         color: '#F59E0B', sort_order: 3 },
  { name: 'Investment',       type: 'income', icon: 'trending-up',        color: '#3B82F6', sort_order: 4 },
  { name: 'Rental',           type: 'income', icon: 'business',           color: '#8B5CF6', sort_order: 5 },
  { name: 'Gift',             type: 'income', icon: 'gift',               color: '#EC4899', sort_order: 6 },
  { name: 'Refund',           type: 'income', icon: 'refresh-circle',     color: '#14B8A6', sort_order: 7 },
  { name: 'Other',            type: 'income', icon: 'ellipsis-horizontal',color: '#6B7280', sort_order: 8 },
];

export const ALL_DEFAULT_CATEGORIES = [
  ...DEFAULT_INCOME_CATEGORIES,
  ...DEFAULT_EXPENSE_CATEGORIES,
];
