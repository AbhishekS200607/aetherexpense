/**
 * AetherExpense — Payment Methods
 */

import type { PaymentMethod } from '../types/transaction';

export const PAYMENT_METHODS: Array<{ value: PaymentMethod; label: string; icon: string }> = [
  { value: 'cash',        label: 'Cash',        icon: 'cash'           },
  { value: 'upi',         label: 'UPI',         icon: 'phone-portrait' },
  { value: 'debit_card',  label: 'Debit Card',  icon: 'card'           },
  { value: 'credit_card', label: 'Credit Card', icon: 'card-outline'   },
  { value: 'bank',        label: 'Bank Transfer',icon: 'business'      },
  { value: 'other',       label: 'Other',       icon: 'ellipsis-horizontal' },
];

export const PAYMENT_METHOD_MAP = Object.fromEntries(
  PAYMENT_METHODS.map((m) => [m.value, m])
) as Record<PaymentMethod, typeof PAYMENT_METHODS[0]>;
