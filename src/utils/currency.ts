/**
 * AetherExpense — Currency Utilities
 *
 * ALL money values are stored as integers (minor units / paise).
 * These functions convert between storage and display representations.
 *
 * Never use floating-point arithmetic for money calculations.
 */

import { CURRENCY_MAP, DEFAULT_CURRENCY, type CurrencyDef } from '../constants/currencies';

/**
 * Convert a user-facing display string (e.g. "100.50") to integer minor units.
 * Uses Math.round to avoid floating-point errors.
 * e.g. "100.50" with minorUnit=2  →  10050
 * e.g. "100"    with minorUnit=0  →  100
 */
export function toMinorUnits(displayValue: string | number, minorUnit = 2): number {
  const parsed = typeof displayValue === 'string'
    ? parseFloat(displayValue.replace(/[^0-9.-]/g, ''))
    : displayValue;
  if (isNaN(parsed)) return 0;
  return Math.round(parsed * Math.pow(10, minorUnit));
}

/** Alias for toMinorUnits for INR paise conversion */
export function toPaise(displayValue: string | number, minorUnit = 2): number {
  return toMinorUnits(displayValue, minorUnit);
}

/**
 * Convert integer minor units back to a decimal number.
 * e.g. 10050 with minorUnit=2  →  100.5
 */
export function fromMinorUnitsToDecimal(minorValue: number, minorUnit = 2): number {
  return minorValue / Math.pow(10, minorUnit);
}

/**
 * Format minor units as a localized currency string.
 * e.g. formatCurrency(10050, 'INR')  →  "₹100.50"
 */
export function formatCurrency(
  minorValue: number,
  currencyCode = 'INR',
  opts?: Intl.NumberFormatOptions,
): string {
  const def: CurrencyDef = CURRENCY_MAP[currencyCode] ?? DEFAULT_CURRENCY;
  const decimal = fromMinorUnitsToDecimal(minorValue, def.minorUnit);

  try {
    return new Intl.NumberFormat(def.locale, {
      style:                 'currency',
      currency:              def.code,
      minimumFractionDigits: def.minorUnit,
      maximumFractionDigits: def.minorUnit,
      ...opts,
    }).format(decimal);
  } catch {
    // Fallback if Intl is not available or currency unsupported
    return `${def.symbol}${decimal.toFixed(def.minorUnit)}`;
  }
}

/**
 * Format as a compact number (no currency symbol).
 * e.g. formatAmount(10050, 'INR')  →  "100.50"
 */
export function formatAmount(minorValue: number, currencyCode = 'INR'): string {
  const def = CURRENCY_MAP[currencyCode] ?? DEFAULT_CURRENCY;
  const decimal = fromMinorUnitsToDecimal(minorValue, def.minorUnit);
  return decimal.toFixed(def.minorUnit);
}

/**
 * Returns the currency symbol for a given code.
 */
export function getCurrencySymbol(currencyCode = 'INR'): string {
  return (CURRENCY_MAP[currencyCode] ?? DEFAULT_CURRENCY).symbol;
}

/**
 * Format a large number in compact form (1K, 1L, 1Cr for INR; 1K, 1M for others).
 */
export function formatCompact(minorValue: number, currencyCode = 'INR'): string {
  const def = CURRENCY_MAP[currencyCode] ?? DEFAULT_CURRENCY;
  const decimal = fromMinorUnitsToDecimal(minorValue, def.minorUnit);
  const abs = Math.abs(decimal);
  const sign = decimal < 0 ? '-' : '';

  if (currencyCode === 'INR') {
    if (abs >= 1_00_00_000) return `${sign}${def.symbol}${(abs / 1_00_00_000).toFixed(1)}Cr`;
    if (abs >= 1_00_000)    return `${sign}${def.symbol}${(abs / 1_00_000).toFixed(1)}L`;
    if (abs >= 1_000)       return `${sign}${def.symbol}${(abs / 1_000).toFixed(1)}K`;
  } else {
    if (abs >= 1_000_000_000) return `${sign}${def.symbol}${(abs / 1_000_000_000).toFixed(1)}B`;
    if (abs >= 1_000_000)     return `${sign}${def.symbol}${(abs / 1_000_000).toFixed(1)}M`;
    if (abs >= 1_000)         return `${sign}${def.symbol}${(abs / 1_000).toFixed(1)}K`;
  }

  return formatCurrency(minorValue, currencyCode);
}

/**
 * Safe integer addition for minor units.
 * Avoids floating-point drift when summing many values.
 */
export function sumMinorUnits(values: number[]): number {
  return values.reduce((acc, v) => acc + Math.trunc(v), 0);
}
