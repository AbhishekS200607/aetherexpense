/**
 * AetherExpense — Financial Calculations
 *
 * ALL inputs and outputs are in INTEGER minor units (paise).
 * No floating-point arithmetic used for money calculations.
 */

/**
 * Compute balance = total income - total expenses.
 */
export function computeBalance(totalIncome: number, totalExpense: number): number {
  return totalIncome - totalExpense;
}

/**
 * Compute savings rate as a percentage (0–100).
 * Returns 0 if income is 0.
 */
export function computeSavingsRate(totalIncome: number, totalExpense: number): number {
  if (totalIncome <= 0) return 0;
  const savings = totalIncome - totalExpense;
  if (savings <= 0) return 0;
  return Math.round((savings / totalIncome) * 100);
}

/**
 * Compute budget usage percentage.
 * Can exceed 100 if budget is exceeded.
 */
export function computeBudgetPercentage(spent: number, budgetAmount: number): number {
  if (budgetAmount <= 0) return 0;
  return Math.round((spent / budgetAmount) * 100);
}

/**
 * Compute remaining budget (can be negative if exceeded).
 */
export function computeBudgetRemaining(budgetAmount: number, spent: number): number {
  return budgetAmount - spent;
}

/**
 * Check if budget warning threshold is reached.
 */
export function isBudgetWarned(spent: number, budgetAmount: number, warnAt: number): boolean {
  return computeBudgetPercentage(spent, budgetAmount) >= warnAt;
}

/**
 * Check if budget is exceeded.
 */
export function isBudgetExceeded(spent: number, budgetAmount: number): boolean {
  return spent > budgetAmount;
}

/**
 * Compute average daily spending for a period.
 * @param totalExpense - total minor units
 * @param days - number of days in the period
 */
export function computeAverageDailySpend(totalExpense: number, days: number): number {
  if (days <= 0) return 0;
  return Math.round(totalExpense / days);
}

/**
 * Projected monthly spending based on current daily average.
 */
export function projectMonthlySpend(avgDailySpend: number, daysInMonth = 30): number {
  return avgDailySpend * daysInMonth;
}

/**
 * Category percentage of total spending.
 */
export function computeCategoryPercentage(categoryAmount: number, totalAmount: number): number {
  if (totalAmount <= 0) return 0;
  return Math.round((categoryAmount / totalAmount) * 100);
}

/**
 * Month-over-month change percentage.
 * Returns null if previousMonth is 0 (can't divide by zero).
 */
export function computeMoMChange(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return Math.round(((current - previous) / previous) * 100);
}

/**
 * Sum an array of minor unit values safely (integer addition only).
 */
export function sumAmounts(values: number[]): number {
  return values.reduce((acc, v) => acc + Math.trunc(v), 0);
}

/**
 * Group transactions by date and sum per day.
 * Returns an array suitable for bar/line charts.
 */
export function groupByDate(
  items: Array<{ date: string; amount: number }>
): Array<{ date: string; total: number }> {
  const map = new Map<string, number>();
  for (const item of items) {
    map.set(item.date, (map.get(item.date) ?? 0) + Math.trunc(item.amount));
  }
  return Array.from(map.entries())
    .map(([date, total]) => ({ date, total }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Group and sum amounts by category_id.
 */
export function groupByCategory(
  items: Array<{ category_id: string; amount: number }>
): Map<string, number> {
  const map = new Map<string, number>();
  for (const item of items) {
    map.set(item.category_id, (map.get(item.category_id) ?? 0) + Math.trunc(item.amount));
  }
  return map;
}
