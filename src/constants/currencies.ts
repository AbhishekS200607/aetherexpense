/**
 * AetherExpense — Currency Definitions
 * Subset of common currencies. Full ISO 4217 can be added.
 */

export interface CurrencyDef {
  code:      string;  // ISO 4217
  symbol:    string;
  name:      string;
  minorUnit: number;  // decimal places (2 for most, 0 for JPY etc.)
  locale:    string;  // Intl.NumberFormat locale
}

export const CURRENCIES: CurrencyDef[] = [
  { code: 'INR', symbol: '₹',  name: 'Indian Rupee',       minorUnit: 2, locale: 'en-IN' },
  { code: 'USD', symbol: '$',  name: 'US Dollar',          minorUnit: 2, locale: 'en-US' },
  { code: 'EUR', symbol: '€',  name: 'Euro',               minorUnit: 2, locale: 'de-DE' },
  { code: 'GBP', symbol: '£',  name: 'British Pound',      minorUnit: 2, locale: 'en-GB' },
  { code: 'JPY', symbol: '¥',  name: 'Japanese Yen',       minorUnit: 0, locale: 'ja-JP' },
  { code: 'AUD', symbol: 'A$', name: 'Australian Dollar',  minorUnit: 2, locale: 'en-AU' },
  { code: 'CAD', symbol: 'C$', name: 'Canadian Dollar',    minorUnit: 2, locale: 'en-CA' },
  { code: 'CHF', symbol: 'Fr', name: 'Swiss Franc',        minorUnit: 2, locale: 'de-CH' },
  { code: 'SGD', symbol: 'S$', name: 'Singapore Dollar',   minorUnit: 2, locale: 'en-SG' },
  { code: 'AED', symbol: 'د.إ',name: 'UAE Dirham',         minorUnit: 2, locale: 'ar-AE' },
  { code: 'SAR', symbol: '﷼',  name: 'Saudi Riyal',        minorUnit: 2, locale: 'ar-SA' },
  { code: 'MYR', symbol: 'RM', name: 'Malaysian Ringgit',  minorUnit: 2, locale: 'ms-MY' },
  { code: 'IDR', symbol: 'Rp', name: 'Indonesian Rupiah',  minorUnit: 0, locale: 'id-ID' },
  { code: 'PHP', symbol: '₱',  name: 'Philippine Peso',    minorUnit: 2, locale: 'en-PH' },
  { code: 'THB', symbol: '฿',  name: 'Thai Baht',          minorUnit: 2, locale: 'th-TH' },
  { code: 'BDT', symbol: '৳',  name: 'Bangladeshi Taka',   minorUnit: 2, locale: 'bn-BD' },
  { code: 'PKR', symbol: '₨',  name: 'Pakistani Rupee',    minorUnit: 2, locale: 'ur-PK' },
  { code: 'NPR', symbol: '₨',  name: 'Nepalese Rupee',     minorUnit: 2, locale: 'ne-NP' },
  { code: 'LKR', symbol: '₨',  name: 'Sri Lankan Rupee',   minorUnit: 2, locale: 'si-LK' },
  { code: 'BRL', symbol: 'R$', name: 'Brazilian Real',     minorUnit: 2, locale: 'pt-BR' },
  { code: 'MXN', symbol: '$',  name: 'Mexican Peso',       minorUnit: 2, locale: 'es-MX' },
  { code: 'ZAR', symbol: 'R',  name: 'South African Rand', minorUnit: 2, locale: 'en-ZA' },
  { code: 'NGN', symbol: '₦',  name: 'Nigerian Naira',     minorUnit: 2, locale: 'en-NG' },
  { code: 'KES', symbol: 'KSh',name: 'Kenyan Shilling',    minorUnit: 2, locale: 'en-KE' },
];

export const CURRENCY_MAP = Object.fromEntries(
  CURRENCIES.map((c) => [c.code, c])
) as Record<string, CurrencyDef>;

export const DEFAULT_CURRENCY = CURRENCIES[0]; // INR
