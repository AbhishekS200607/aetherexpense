/**
 * AetherExpense — Zod Validation Schemas
 * Centralized validation for all form inputs.
 */

import { z } from 'zod';

// ─── Primitives ──────────────────────────────────────────────────────────────

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD');

const timeHHMM = z
  .string()
  .regex(/^\d{2}:\d{2}$/, 'Must be HH:MM');

const positiveAmountString = z
  .string()
  .min(1, 'Amount is required')
  .refine((v) => {
    const n = parseFloat(v.replace(/[^0-9.]/g, ''));
    return !isNaN(n) && n > 0;
  }, 'Amount must be greater than 0');

// ─── Transaction ─────────────────────────────────────────────────────────────

export const TransactionSchema = z.object({
  type:           z.enum(['income', 'expense', 'transfer']),
  amount:         positiveAmountString,
  category_id:    z.string().uuid('Invalid category'),
  subcategory:    z.string().max(100).optional(),
  date:           isoDate,
  time:           timeHHMM,
  note:           z.string().max(500).optional(),
  merchant:       z.string().max(200).optional(),
  payment_method: z.enum(['cash', 'bank', 'upi', 'credit_card', 'debit_card', 'other']),
  tags:           z.array(z.string().uuid()).optional(),
});

export type TransactionFormSchema = z.infer<typeof TransactionSchema>;

// ─── Category ────────────────────────────────────────────────────────────────

export const CategorySchema = z.object({
  name:  z.string().min(1, 'Name is required').max(50, 'Name too long'),
  type:  z.enum(['income', 'expense']),
  icon:  z.string().min(1, 'Icon is required'),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Invalid hex color'),
});

export type CategoryFormSchema = z.infer<typeof CategorySchema>;

// ─── Budget ──────────────────────────────────────────────────────────────────

export const BudgetSchema = z.object({
  name:         z.string().min(1, 'Name is required').max(100),
  amount:       positiveAmountString,
  period:       z.enum(['weekly', 'monthly', 'yearly', 'custom']),
  start_date:   isoDate,
  end_date:     isoDate.optional(),
  category_id:  z.string().uuid().optional(),
  warn_at:      z.number().int().min(1).max(100).default(80),
}).refine(
  (d) => !d.end_date || d.end_date >= d.start_date,
  { message: 'End date must be after start date', path: ['end_date'] }
);

export type BudgetFormSchema = z.infer<typeof BudgetSchema>;

// ─── Recurring ───────────────────────────────────────────────────────────────

export const RecurringSchema = z.object({
  type:            z.enum(['income', 'expense']),
  amount:          positiveAmountString,
  category_id:     z.string().uuid('Invalid category'),
  note:            z.string().max(500).optional(),
  merchant:        z.string().max(200).optional(),
  payment_method:  z.enum(['cash', 'bank', 'upi', 'credit_card', 'debit_card', 'other']),
  frequency:       z.enum(['daily', 'weekly', 'monthly', 'yearly']),
  start_date:      isoDate,
  end_date:        isoDate.optional(),
}).refine(
  (d) => !d.end_date || d.end_date > d.start_date,
  { message: 'End date must be after start date', path: ['end_date'] }
);

export type RecurringFormSchema = z.infer<typeof RecurringSchema>;

// ─── Settings ────────────────────────────────────────────────────────────────

export const SettingsSchema = z.object({
  currency:               z.string().length(3),
  date_format:            z.enum(['DD/MM/YYYY', 'MM/DD/YYYY', 'YYYY-MM-DD']),
  week_start:             z.enum(['monday', 'sunday']),
  theme:                  z.enum(['dark', 'light', 'system']),
  language:               z.string().min(2).max(5),
  app_lock_enabled:       z.boolean(),
  biometrics_enabled:     z.boolean(),
  auto_lock_seconds:      z.number().int().min(0).max(600),
  daily_reminder_enabled: z.boolean(),
  daily_reminder_time:    timeHHMM,
  budget_warning_enabled: z.boolean(),
  ai_online_enabled:      z.boolean(),
});

// ─── Backup File ─────────────────────────────────────────────────────────────

export const BackupMetaSchema = z.object({
  backup_version: z.number().int().positive(),
  app_version:    z.string(),
  schema_version: z.number().int().positive(),
  created_at:     z.string(),
  is_encrypted:   z.boolean(),
});

export const BackupFileSchema = z.object({
  meta: BackupMetaSchema,
  data: z.object({
    categories:             z.array(z.any()),
    tags:                   z.array(z.any()).optional().default([]),
    transactions:           z.array(z.any()),
    transaction_tags:       z.array(z.any()).optional().default([]),
    budgets:                z.array(z.any()).optional().default([]),
    recurring_transactions: z.array(z.any()).optional().default([]),
    settings:               z.record(z.string()).optional().default({}),
  }),
});
