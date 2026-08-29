/**
 * AetherExpense — Backup Types
 */

import type { Transaction, Tag, TransactionTag } from './transaction';
import type { Category } from './category';
import type { Budget } from './budget';
import type { RecurringTransaction } from './recurring';

export const BACKUP_VERSION = 1;
export const BACKUP_EXTENSION = 'aetherbackup.json';

export interface BackupMeta {
  backup_version:  number;
  app_version:     string;
  schema_version:  number;
  created_at:      string;   // ISO 8601
  device_id_hash?: string;
  is_encrypted:    boolean;
}

export interface BackupData {
  categories:             Category[];
  tags:                   Tag[];
  transactions:           Transaction[];
  transaction_tags:       TransactionTag[];
  budgets:                Budget[];
  recurring_transactions: RecurringTransaction[];
  settings:               Record<string, string>;
}

export interface BackupFile {
  meta: BackupMeta;
  data: BackupData;
}

export type ImportStrategy = 'replace' | 'merge' | 'cancel';

export interface ImportValidationResult {
  valid:    boolean;
  errors:   string[];
  warnings: string[];
  stats: {
    categories:   number;
    transactions: number;
    budgets:      number;
    recurring:    number;
  };
}
