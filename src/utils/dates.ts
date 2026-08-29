/**
 * AetherExpense — Date Utilities
 * Thin wrappers over native Date (no external lib needed for basics).
 * date-fns used for complex operations like period ranges.
 */

import type { DateFormat } from '../types/settings';

/**
 * Get today's date string in YYYY-MM-DD format.
 */
export function todayISO(): string {
  return new Date().toISOString().split('T')[0];
}

/**
 * Get current time in HH:MM format.
 */
export function currentTimeHHMM(): string {
  const now = new Date();
  const h = String(now.getHours()).padStart(2, '0');
  const m = String(now.getMinutes()).padStart(2, '0');
  return `${h}:${m}`;
}

/**
 * Format a YYYY-MM-DD string to the user's preferred display format.
 */
export function formatDate(isoDate: string, format: DateFormat = 'DD/MM/YYYY'): string {
  const [year, month, day] = isoDate.split('-');
  switch (format) {
    case 'DD/MM/YYYY': return `${day}/${month}/${year}`;
    case 'MM/DD/YYYY': return `${month}/${day}/${year}`;
    case 'YYYY-MM-DD': return isoDate;
  }
}

/**
 * Parse any of the supported date format strings back to YYYY-MM-DD.
 */
export function parseDisplayDate(display: string, format: DateFormat = 'DD/MM/YYYY'): string {
  const parts = display.split(/[\/\-]/);
  switch (format) {
    case 'DD/MM/YYYY': return `${parts[2]}-${parts[1].padStart(2,'0')}-${parts[0].padStart(2,'0')}`;
    case 'MM/DD/YYYY': return `${parts[2]}-${parts[0].padStart(2,'0')}-${parts[1].padStart(2,'0')}`;
    case 'YYYY-MM-DD': return display;
  }
}

/**
 * Get first and last day of a given month (1-indexed).
 */
export function getMonthRange(year: number, month: number): { from: string; to: string } {
  const from = `${year}-${String(month).padStart(2, '0')}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const to = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
  return { from, to };
}

/**
 * Get the current month range.
 */
export function currentMonthRange(): { from: string; to: string } {
  const now = new Date();
  return getMonthRange(now.getFullYear(), now.getMonth() + 1);
}

/**
 * Get the current week range (Monday → Sunday by default).
 */
export function currentWeekRange(weekStart: 'monday' | 'sunday' = 'monday'): { from: string; to: string } {
  const now = new Date();
  const day = now.getDay(); // 0 = Sunday
  const startOffset = weekStart === 'monday'
    ? (day === 0 ? -6 : 1 - day)
    : -day;
  const start = new Date(now);
  start.setDate(now.getDate() + startOffset);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  return {
    from: start.toISOString().split('T')[0],
    to:   end.toISOString().split('T')[0],
  };
}

/**
 * Get today's date range (from 00:00 to 23:59).
 */
export function todayRange(): { from: string; to: string } {
  const today = todayISO();
  return { from: today, to: today };
}

/**
 * Get a date N days ago.
 */
export function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().split('T')[0];
}

/**
 * Get a date N months ago.
 */
export function monthsAgo(n: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() - n);
  return d.toISOString().split('T')[0];
}

/**
 * Format a date for display in transaction lists.
 * Shows 'Today', 'Yesterday', or formatted date.
 */
export function formatRelativeDate(isoDate: string, dateFormat: DateFormat = 'DD/MM/YYYY'): string {
  const today = todayISO();
  const yesterday = daysAgo(1);
  if (isoDate === today) return 'Today';
  if (isoDate === yesterday) return 'Yesterday';
  return formatDate(isoDate, dateFormat);
}

/**
 * Get YYYY-MM from an ISO date string.
 */
export function toYearMonth(isoDate: string): string {
  return isoDate.substring(0, 7);
}

/**
 * Format a month label: "Aug 2026"
 */
export function formatMonthLabel(yearMonth: string): string {
  const [year, month] = yearMonth.split('-').map(Number);
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${months[month - 1]} ${year}`;
}

/**
 * Get the next occurrence of a recurring transaction date.
 */
export function nextRecurringDate(
  current: string,
  frequency: 'daily' | 'weekly' | 'monthly' | 'yearly',
): string {
  const d = new Date(current);
  switch (frequency) {
    case 'daily':   d.setDate(d.getDate() + 1); break;
    case 'weekly':  d.setDate(d.getDate() + 7); break;
    case 'monthly': d.setMonth(d.getMonth() + 1); break;
    case 'yearly':  d.setFullYear(d.getFullYear() + 1); break;
  }
  return d.toISOString().split('T')[0];
}

/**
 * ISO 8601 timestamp for created_at / updated_at fields.
 */
export function nowISO(): string {
  return new Date().toISOString();
}
