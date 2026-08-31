/**
 * AetherExpense — Drizzle ORM Schema
 *
 * All money amounts stored as INTEGER minor units (paise for INR).
 * Never use REAL columns for money.
 */

import {
  integer,
  sqliteTable,
  text,
  index,
  primaryKey,
} from 'drizzle-orm/sqlite-core';

// ─── Categories ──────────────────────────────────────────────────────────────

export const categories = sqliteTable('categories', {
  id:         text('id').primaryKey(),          // UUID v4
  name:       text('name').notNull(),
  type:       text('type', { enum: ['income', 'expense'] }).notNull(),
  icon:       text('icon').notNull().default('help-circle'),
  color:      text('color').notNull().default('#6366F1'),
  is_default: integer('is_default').notNull().default(0),  // 0|1
  is_active:  integer('is_active').notNull().default(1),   // soft-delete
  sort_order: integer('sort_order').notNull().default(0),
  created_at: text('created_at').notNull(),
  updated_at: text('updated_at').notNull(),
});

// ─── Tags ────────────────────────────────────────────────────────────────────

export const tags = sqliteTable('tags', {
  id:         text('id').primaryKey(),
  name:       text('name').notNull().unique(),
  color:      text('color').notNull().default('#6366F1'),
  created_at: text('created_at').notNull(),
});

// ─── Recurring Transactions ──────────────────────────────────────────────────
// Declared before transactions so the FK reference compiles correctly.

export const recurringTransactions = sqliteTable('recurring_transactions', {
  id:              text('id').primaryKey(),
  type:            text('type', { enum: ['income', 'expense', 'transfer'] }).notNull(),
  amount:          integer('amount').notNull(),        // minor units
  category_id:     text('category_id')
                     .notNull()
                     .references(() => categories.id),
  account_id:      text('account_id')
                     .references(() => accounts.id),
  note:            text('note'),
  merchant:        text('merchant'),
  payment_method:  text('payment_method', {
                     enum: ['cash', 'bank', 'upi', 'credit_card', 'debit_card', 'other'],
                   }).notNull().default('cash'),
  frequency:       text('frequency', {
                     enum: ['daily', 'weekly', 'monthly', 'yearly'],
                   }).notNull(),
  start_date:      text('start_date').notNull(),       // YYYY-MM-DD
  end_date:        text('end_date'),                   // nullable
  last_run_date:   text('last_run_date'),
  next_run_date:   text('next_run_date').notNull(),
  is_active:       integer('is_active').notNull().default(1),
  notification_id: text('notification_id'),
  created_at:      text('created_at').notNull(),
  updated_at:      text('updated_at').notNull(),
});

// ─── Accounts & Wallets ───────────────────────────────────────────────────────

export const accounts = sqliteTable('accounts', {
  id:              text('id').primaryKey(),
  name:            text('name').notNull(),
  type:            text('type', {
                     enum: ['cash', 'bank', 'upi', 'debit_card', 'credit_card', 'savings', 'custom'],
                   }).notNull().default('cash'),
  opening_balance: integer('opening_balance').notNull().default(0), // minor units
  icon:            text('icon').notNull().default('wallet-outline'),
  color:           text('color').notNull().default('#000000'),
  is_active:       integer('is_active').notNull().default(1),
  sort_order:      integer('sort_order').notNull().default(0),
  created_at:      text('created_at').notNull(),
  updated_at:      text('updated_at').notNull(),
});

// ─── Bills & Reminders ────────────────────────────────────────────────────────

export const bills = sqliteTable('bills', {
  id:                      text('id').primaryKey(),
  name:                    text('name').notNull(),
  amount:                  integer('amount').notNull(),        // minor units
  category_id:             text('category_id').references(() => categories.id),
  account_id:              text('account_id').references(() => accounts.id),
  due_date:                text('due_date').notNull(),         // YYYY-MM-DD
  frequency:               text('frequency', {
                             enum: ['one_time', 'weekly', 'monthly', 'yearly'],
                           }).notNull().default('monthly'),
  note:                    text('note'),
  is_paid:                 integer('is_paid').notNull().default(0),
  paid_date:               text('paid_date'),
  auto_create_transaction: integer('auto_create_transaction').notNull().default(1),
  transaction_id:          text('transaction_id'),
  is_active:               integer('is_active').notNull().default(1),
  reminder_days_before:    integer('reminder_days_before').notNull().default(1),
  notification_id:         text('notification_id'),
  recurring_id:            text('recurring_id').references(() => recurringTransactions.id),
  created_at:              text('created_at').notNull(),
  updated_at:              text('updated_at').notNull(),
});

// ─── Transactions ────────────────────────────────────────────────────────────

export const transactions = sqliteTable(
  'transactions',
  {
    id:                     text('id').primaryKey(),
    type:                   text('type', { enum: ['income', 'expense', 'transfer'] }).notNull(),
    amount:                 integer('amount').notNull(),        // minor units; always positive
    category_id:            text('category_id')
                              .notNull()
                              .references(() => categories.id),
    subcategory:            text('subcategory'),
    account_id:             text('account_id')
                              .references(() => accounts.id),
    transfer_to_account_id: text('transfer_to_account_id')
                              .references(() => accounts.id),
    date:                   text('date').notNull(),             // YYYY-MM-DD
    time:                   text('time').notNull(),             // HH:MM
    note:                   text('note'),
    merchant:               text('merchant'),
    payment_method:         text('payment_method', {
                              enum: ['cash', 'bank', 'upi', 'credit_card', 'debit_card', 'other'],
                            }).notNull().default('cash'),
    receipt_path:           text('receipt_path'),
    is_recurring:           integer('is_recurring').notNull().default(0),
    recurring_id:           text('recurring_id')
                              .references(() => recurringTransactions.id),
    bill_id:                text('bill_id')
                              .references(() => bills.id),
    created_at:             text('created_at').notNull(),
    updated_at:             text('updated_at').notNull(),
  },
  (t) => ({
    dateIdx:     index('idx_transactions_date').on(t.date),
    categoryIdx: index('idx_transactions_category').on(t.category_id),
    typeIdx:     index('idx_transactions_type').on(t.type),
    dateTypeIdx: index('idx_transactions_date_type').on(t.date, t.type),
    accountIdx:  index('idx_transactions_account').on(t.account_id),
  })
);

// ─── Transaction Tags (junction) ─────────────────────────────────────────────

export const transactionTags = sqliteTable(
  'transaction_tags',
  {
    transaction_id: text('transaction_id')
                      .notNull()
                      .references(() => transactions.id, { onDelete: 'cascade' }),
    tag_id:         text('tag_id')
                      .notNull()
                      .references(() => tags.id, { onDelete: 'cascade' }),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.transaction_id, t.tag_id] }),
  })
);

// ─── Budgets ─────────────────────────────────────────────────────────────────

export const budgets = sqliteTable('budgets', {
  id:          text('id').primaryKey(),
  name:        text('name').notNull(),
  amount:      integer('amount').notNull(),        // minor units (budget limit)
  period:      text('period', {
                 enum: ['weekly', 'monthly', 'yearly', 'custom'],
               }).notNull(),
  start_date:  text('start_date').notNull(),
  end_date:    text('end_date'),
  category_id: text('category_id')
                 .references(() => categories.id),  // NULL = overall budget
  warn_at:     integer('warn_at').notNull().default(80), // warning percentage
  is_active:   integer('is_active').notNull().default(1),
  created_at:  text('created_at').notNull(),
  updated_at:  text('updated_at').notNull(),
});

// ─── Settings (key-value) ────────────────────────────────────────────────────

export const settings = sqliteTable('settings', {
  key:        text('key').primaryKey(),
  value:      text('value').notNull(),
  updated_at: text('updated_at').notNull(),
});

// ─── Debts & Loans ────────────────────────────────────────────────────────────

export const debts = sqliteTable('debts', {
  id:               text('id').primaryKey(),
  title:            text('title').notNull(),
  person_name:      text('person_name').notNull(),
  type:             text('type', { enum: ['LENT', 'BORROWED'] }).notNull(),
  total_amount:     integer('total_amount').notNull(), // minor units (paise)
  remaining_amount: integer('remaining_amount').notNull(), // minor units (paise)
  due_date:         text('due_date'), // YYYY-MM-DD
  status:           text('status', { enum: ['PENDING', 'PARTIAL', 'SETTLED'] }).notNull().default('PENDING'),
  account_id:       text('account_id').references(() => accounts.id),
  note:             text('note'),
  created_at:       text('created_at').notNull(),
  updated_at:       text('updated_at').notNull(),
});

export const debtRepayments = sqliteTable('debt_repayments', {
  id:             text('id').primaryKey(),
  debt_id:        text('debt_id')
                    .notNull()
                    .references(() => debts.id, { onDelete: 'cascade' }),
  amount:         integer('amount').notNull(), // minor units (paise)
  payment_date:   text('payment_date').notNull(), // YYYY-MM-DD
  account_id:     text('account_id').references(() => accounts.id),
  note:           text('note'),
  transaction_id: text('transaction_id').references(() => transactions.id),
  created_at:     text('created_at').notNull(),
});

// ─── Type Inference ──────────────────────────────────────────────────────────

export type CategoryRow           = typeof categories.$inferSelect;
export type CategoryInsert        = typeof categories.$inferInsert;
export type AccountRow            = typeof accounts.$inferSelect;
export type AccountInsert         = typeof accounts.$inferInsert;
export type TagRow                = typeof tags.$inferSelect;
export type TagInsert             = typeof tags.$inferInsert;
export type TransactionRow        = typeof transactions.$inferSelect;
export type TransactionInsert     = typeof transactions.$inferInsert;
export type TransactionTagRow     = typeof transactionTags.$inferSelect;
export type RecurringRow          = typeof recurringTransactions.$inferSelect;
export type RecurringInsert       = typeof recurringTransactions.$inferInsert;
export type BudgetRow             = typeof budgets.$inferSelect;
export type BudgetInsert          = typeof budgets.$inferInsert;
export type SettingsRow           = typeof settings.$inferSelect;
export type DebtRow               = typeof debts.$inferSelect;
export type DebtInsert            = typeof debts.$inferInsert;
export type DebtRepaymentRow      = typeof debtRepayments.$inferSelect;
export type DebtRepaymentInsert   = typeof debtRepayments.$inferInsert;
