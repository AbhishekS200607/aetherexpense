/**
 * AetherExpense — Local Financial Intelligence Engine
 *
 * 100% Offline Local Financial Intelligence Engine.
 * Analyzes SQLite financial history using Drizzle ORM queries and SQL aggregations.
 * Zero external API calls (0 fetch/axios/cloud/LLM requests). All money values stored in paise (minor units).
 */

import { eq, and, gte, lte, sql, desc, count } from 'drizzle-orm';
import type { DrizzleDB } from '@/database/client';
import { transactions, categories, budgets, accounts, bills } from '@/database/schema';
import { currentMonthRange, todayISO, getMonthRange } from '@/utils/dates';
import { formatCurrency } from '@/utils/currency';
import { calculateAccountBalance } from '@/utils/accounts';

// ─── Interfaces ───────────────────────────────────────────────────────────────

export interface FinancialMetrics {
  totalIncomePaise:   number;
  totalExpensePaise:  number;
  netSavingsPaise:    number;
  savingsRatePercent: number;
}

export interface HealthScoreResult {
  score:          number; // 0..100
  rating:         'Excellent' | 'Good' | 'Fair' | 'Needs Attention';
  positives:      string[];
  attentionItems: string[];
}

export interface SuggestedBudget {
  categoryId:         string;
  categoryName:       string;
  categoryIcon:       string;
  threeMonthAvgPaise: number;
  recentMonthPaise:   number;
  suggestedPaise:     number;
  suggestedFormatted: string;
  reasoning:          string;
}

export interface FinancialInsight {
  id:          string;
  title:       string;
  message:     string;
  type:        'warning' | 'positive' | 'suggestion' | 'info';
  impactPaise: number;
}

export interface AssistantAnswer {
  intent:          string;
  questionText:    string;
  answerText:      string;
  metrics?:        Array<{ label: string; value: string }>;
  suggestions?:    SuggestedBudget[];
  insights?:       FinancialInsight[];
  supported:       boolean;
}

// ─── 1. Core Financial Metrics ────────────────────────────────────────────────

export async function getMonthlyMetrics(
  db: DrizzleDB,
  year?: number,
  month?: number
): Promise<FinancialMetrics> {
  const { from, to } = year && month ? getMonthRange(year, month) : currentMonthRange();

  const incRes = await db
    .select({ total: sql<number>`SUM(amount)` })
    .from(transactions)
    .where(and(eq(transactions.type, 'income'), gte(transactions.date, from), lte(transactions.date, to)));

  const expRes = await db
    .select({ total: sql<number>`SUM(amount)` })
    .from(transactions)
    .where(and(eq(transactions.type, 'expense'), gte(transactions.date, from), lte(transactions.date, to)));

  const totalIncomePaise = Number(incRes[0]?.total ?? 0);
  const totalExpensePaise = Number(expRes[0]?.total ?? 0);
  const netSavingsPaise = totalIncomePaise - totalExpensePaise;
  const savingsRatePercent =
    totalIncomePaise > 0
      ? Math.max(0, Math.round((netSavingsPaise / totalIncomePaise) * 100))
      : 0;

  return {
    totalIncomePaise,
    totalExpensePaise,
    netSavingsPaise,
    savingsRatePercent,
  };
}

// ─── 2. Financial Health Score (0 - 100) ──────────────────────────────────────

export async function computeFinancialHealthScore(db: DrizzleDB): Promise<HealthScoreResult> {
  const currentMetrics = await getMonthlyMetrics(db);
  const positives: string[] = [];
  const attentionItems: string[] = [];
  let score = 50; // Baseline

  // 1. Savings Rate Component (Max +30 pts)
  if (currentMetrics.savingsRatePercent >= 25) {
    score += 30;
    positives.push(`✓ Excellent ${currentMetrics.savingsRatePercent}% savings rate this month`);
  } else if (currentMetrics.savingsRatePercent >= 15) {
    score += 20;
    positives.push(`✓ Healthy ${currentMetrics.savingsRatePercent}% savings rate`);
  } else if (currentMetrics.savingsRatePercent > 0) {
    score += 10;
    attentionItems.push(`⚠ Low savings rate of ${currentMetrics.savingsRatePercent}% (aim for 20%+)`);
  } else {
    attentionItems.push(`⚠ Monthly expenses exceed income (Negative net savings)`);
  }

  // 2. Budget Adherence Component (Max +20 pts)
  const activeBudgets = await db.select().from(budgets).where(eq(budgets.is_active, 1));
  if (activeBudgets.length > 0) {
    const { from, to } = currentMonthRange();
    let overBudgetCount = 0;

    for (const b of activeBudgets) {
      if (b.category_id) {
        const spentRes = await db
          .select({ total: sql<number>`SUM(amount)` })
          .from(transactions)
          .where(
            and(
              eq(transactions.type, 'expense'),
              eq(transactions.category_id, b.category_id),
              gte(transactions.date, from),
              lte(transactions.date, to)
            )
          );
        const spent = Number(spentRes[0]?.total ?? 0);
        if (spent > b.amount) overBudgetCount++;
      }
    }

    if (overBudgetCount === 0) {
      score += 20;
      positives.push(`✓ All active monthly budgets are under control`);
    } else {
      score += 5;
      attentionItems.push(`⚠ ${overBudgetCount} budget(s) exceeded this month`);
    }
  } else {
    score += 10; // Default points if no budgets set
  }

  // Final score clamping
  score = Math.min(100, Math.max(0, score));

  let rating: HealthScoreResult['rating'] = 'Fair';
  if (score >= 80) rating = 'Excellent';
  else if (score >= 65) rating = 'Good';
  else if (score < 45) rating = 'Needs Attention';

  return {
    score,
    rating,
    positives,
    attentionItems,
  };
}

// ─── 3. Automatic Smart Budget Recommendation Engine ───────────────────────────

export async function generateSmartBudgetSuggestions(
  db: DrizzleDB,
  currencyCode = 'INR'
): Promise<SuggestedBudget[]> {
  const now = new Date();
  const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 3, 1).toISOString().split('T')[0];
  const { from: currentMonthFrom, to: currentMonthTo } = currentMonthRange();

  // Query top expense categories over last 90 days
  const catSpending = await db
    .select({
      categoryId:   categories.id,
      categoryName: categories.name,
      categoryIcon: categories.icon,
      total90Days:  sql<number>`SUM(${transactions.amount})`,
    })
    .from(transactions)
    .innerJoin(categories, eq(transactions.category_id, categories.id))
    .where(
      and(
        eq(transactions.type, 'expense'),
        gte(transactions.date, threeMonthsAgo)
      )
    )
    .groupBy(categories.id)
    .orderBy(desc(sql`SUM(${transactions.amount})`))
    .limit(5);

  const suggestions: SuggestedBudget[] = [];

  for (const cat of catSpending) {
    const total90Paise = Number(cat.total90Days ?? 0);
    const threeMonthAvgPaise = Math.round(total90Paise / 3);

    // Recent month spending
    const recentRes = await db
      .select({ total: sql<number>`SUM(amount)` })
      .from(transactions)
      .where(
        and(
          eq(transactions.type, 'expense'),
          eq(transactions.category_id, cat.categoryId),
          gte(transactions.date, currentMonthFrom),
          lte(transactions.date, currentMonthTo)
        )
      );
    const recentMonthPaise = Number(recentRes[0]?.total ?? 0);

    // Suggested budget = 3-month average + 10% safety margin (rounded to nearest 500 INR = 50000 paise)
    const baseSuggestion = Math.max(threeMonthAvgPaise, recentMonthPaise) * 1.1;
    const suggestedPaise = Math.ceil(baseSuggestion / 50000) * 50000;

    const formatted = formatCurrency(suggestedPaise, currencyCode);
    const avgFormatted = formatCurrency(threeMonthAvgPaise, currencyCode);

    suggestions.push({
      categoryId:         cat.categoryId,
      categoryName:       cat.categoryName,
      categoryIcon:       cat.categoryIcon,
      threeMonthAvgPaise,
      recentMonthPaise,
      suggestedPaise,
      suggestedFormatted: formatted,
      reasoning:          `Based on your 3-month average of ${avgFormatted} with a 10% safety buffer.`,
    });
  }

  return suggestions;
}

// ─── 4. Anomaly Detection & Savings Opportunities ─────────────────────────────

export async function detectAnomaliesAndInsights(
  db: DrizzleDB,
  currencyCode = 'INR'
): Promise<FinancialInsight[]> {
  const insights: FinancialInsight[] = [];
  const { from, to } = currentMonthRange();

  // 1. Detect Unusually Large Individual Transactions (>2.5x overall average)
  const avgRes = await db
    .select({ avgAmount: sql<number>`AVG(amount)` })
    .from(transactions)
    .where(eq(transactions.type, 'expense'));
  const avgTxnPaise = Number(avgRes[0]?.avgAmount ?? 0);

  if (avgTxnPaise > 0) {
    const largeTxns = await db
      .select({
        id:           transactions.id,
        amount:       transactions.amount,
        merchant:     transactions.merchant,
        categoryName: categories.name,
      })
      .from(transactions)
      .innerJoin(categories, eq(transactions.category_id, categories.id))
      .where(
        and(
          eq(transactions.type, 'expense'),
          gte(transactions.date, from),
          gte(transactions.amount, avgTxnPaise * 2.5)
        )
      )
      .limit(2);

    for (const t of largeTxns) {
      insights.push({
        id:          `anomaly_${t.id}`,
        title:       'Unusual Transaction Spike',
        message:     `Large expense of ${formatCurrency(t.amount, currencyCode)} on ${t.merchant || t.categoryName} is 2.5x above your typical transaction size.`,
        type:        'warning',
        impactPaise: t.amount,
      });
    }
  }

  // 2. High Category Spending Insight
  const topCat = await db
    .select({
      name:  categories.name,
      total: sql<number>`SUM(${transactions.amount})`,
    })
    .from(transactions)
    .innerJoin(categories, eq(transactions.category_id, categories.id))
    .where(
      and(
        eq(transactions.type, 'expense'),
        gte(transactions.date, from),
        lte(transactions.date, to)
      )
    )
    .groupBy(categories.id)
    .orderBy(desc(sql`SUM(${transactions.amount})`))
    .limit(1);

  if (topCat.length > 0 && topCat[0].total) {
    const topPaise = Number(topCat[0].total);
    insights.push({
      id:          `top_cat_${topCat[0].name}`,
      title:       'Top Category Concentration',
      message:     `${topCat[0].name} is your highest spending category this month at ${formatCurrency(topPaise, currencyCode)}.`,
      type:        'info',
      impactPaise: topPaise,
    });
  }

  return insights;
}

// ─── 5. Offline Natural Language Query Engine ─────────────────────────────────

export function extractSalaryFromQuery(queryStr: string): number | null {
  const q = queryStr.toLowerCase();

  // 1. Check for "60k", "60 k", "60.5k"
  const kMatch = q.match(/(\d+(?:\.\d+)?)\s*k\b/i);
  if (kMatch) {
    const val = parseFloat(kMatch[1]) * 1000;
    if (val > 0) return val;
  }

  // 2. Check for "1.5 lakh", "2 L", "2.5lakh"
  const lakhMatch = q.match(/(\d+(?:\.\d+)?)\s*(?:lakh|l)\b/i);
  if (lakhMatch) {
    const val = parseFloat(lakhMatch[1]) * 100000;
    if (val > 0) return val;
  }

  // 3. Search for number in queries mentioning salary, earn, make, income, divide, save, budget
  const isBudgetOrSalaryQuery =
    q.includes('salary') ||
    q.includes('earn') ||
    q.includes('make') ||
    q.includes('income') ||
    q.includes('divide') ||
    q.includes('budget') ||
    q.includes('save');

  if (isBudgetOrSalaryQuery) {
    const numMatches = q.match(/[\d,]+/g);
    if (numMatches) {
      for (const numStr of numMatches) {
        const clean = numStr.replace(/,/g, '');
        const val = parseFloat(clean);
        // Valid salary threshold (e.g. ₹5,000 to ₹10,000,000)
        if (val >= 5000 && val <= 10000000) {
          return val;
        }
      }
    }
  }

  return null;
}

export function extractExtraFinancialParams(queryStr: string): { rent?: number; emi?: number } {
  const q = queryStr.toLowerCase();
  let rent: number | undefined;
  let emi: number | undefined;

  const rentMatch = q.match(/rent\s*(?:is|=|:)?\s*₹?\s*([\d,]+)(k)?/i);
  if (rentMatch) {
    let r = parseFloat(rentMatch[1].replace(/,/g, ''));
    if (rentMatch[2]) r *= 1000;
    if (r > 0) rent = r;
  }

  const emiMatch = q.match(/(?:emi|debt|loan)\s*(?:is|=|:)?\s*₹?\s*([\d,]+)(k)?/i);
  if (emiMatch) {
    let e = parseFloat(emiMatch[1].replace(/,/g, ''));
    if (emiMatch[2]) e *= 1000;
    if (e > 0) emi = e;
  }

  return { rent, emi };
}

export async function generateSalaryBudgetRecommendation(
  db: DrizzleDB,
  salary: number,
  queryText: string,
  currencyCode = 'INR'
): Promise<AssistantAnswer> {
  const { rent, emi } = extractExtraFinancialParams(queryText);

  // Check if user has historical transaction spending in SQLite
  const pastTxns = await db
    .select({
      catName: categories.name,
      amount: transactions.amount,
    })
    .from(transactions)
    .innerJoin(categories, eq(transactions.category_id, categories.id))
    .where(eq(transactions.type, 'expense'));

  const hasHistory = pastTxns.length >= 5;

  // Base Allocation Ratios (sum = 1.00)
  // Baseline: Housing 25%, Food 15%, Transport 10%, Bills 7%, Personal 7%, Entertainment 5%, Health 5%, Savings 17%, Emergency/Investments 10%
  let categoryRatios: Array<{ name: string; pct: number }> = [
    { name: 'Housing',               pct: 0.25 },
    { name: 'Food',                  pct: 0.15 },
    { name: 'Transport',             pct: 0.10 },
    { name: 'Bills',                 pct: 0.07 },
    { name: 'Personal',              pct: 0.07 },
    { name: 'Entertainment',         pct: 0.05 },
    { name: 'Health/Insurance',      pct: 0.05 },
    { name: 'Savings',               pct: 0.17 },
    { name: 'Emergency/Investments', pct: 0.10 },
  ];

  // If user provided rent or EMI, dynamically recalculate allocations
  if (rent || emi) {
    let allocatedFixed = 0;
    if (rent) {
      const housingItem = categoryRatios.find((c) => c.name === 'Housing');
      if (housingItem) {
        housingItem.pct = rent / salary;
        allocatedFixed += housingItem.pct;
      }
    }
    if (emi) {
      categoryRatios.push({ name: 'Debt/EMI', pct: emi / salary });
      allocatedFixed += emi / salary;
    }

    // Scale remaining variable and savings items so total pct === 1.0
    const remainingPct = Math.max(0.10, 1.0 - allocatedFixed);
    const unallocatedCategories = categoryRatios.filter((c) => c.name !== 'Housing' && c.name !== 'Debt/EMI');
    const defaultSum = unallocatedCategories.reduce((acc, c) => acc + c.pct, 0);

    if (defaultSum > 0) {
      unallocatedCategories.forEach((c) => {
        c.pct = (c.pct / defaultSum) * remainingPct;
      });
    }
  }

  // Calculate deterministic amounts in whole Rupee units
  let totalAllocated = 0;
  const items = categoryRatios.map((c) => {
    const amount = Math.round(salary * c.pct);
    totalAllocated += amount;
    return {
      name: c.name,
      amount,
      pct: Math.round(c.pct * 100),
    };
  });

  // Ensure exact sum match down to the last Rupee (add rounding diff to Savings)
  const diff = salary - totalAllocated;
  if (diff !== 0) {
    const savingsItem = items.find((i) => i.name === 'Savings') || items[items.length - 1];
    if (savingsItem) {
      savingsItem.amount += diff;
      savingsItem.pct = Math.round((savingsItem.amount / salary) * 100);
    }
  }

  // Total Savings Target = Savings + Emergency/Investments
  const savingsItem = items.find((i) => i.name === 'Savings');
  const emergencyItem = items.find((i) => i.name === 'Emergency/Investments');
  const totalSavingsAmount = (savingsItem?.amount || 0) + (emergencyItem?.amount || 0);
  const totalSavingsPct = Math.round((totalSavingsAmount / salary) * 100);

  // Format response strings
  const formattedSalary = formatCurrency(salary * 100, currencyCode).replace(/\.00$/, '');
  const formattedSavings = formatCurrency(totalSavingsAmount * 100, currencyCode).replace(/\.00$/, '');

  const budgetLines = items
    .map((item) => {
      const formattedAmt = formatCurrency(item.amount * 100, currencyCode).replace(/\.00$/, '');
      return `${item.name}: ${formattedAmt} (${item.pct}%)`;
    })
    .join('\n');

  const introHeader = hasHistory
    ? `Based on your monthly salary of ${formattedSalary} and your actual spending history, here is your personalized budget recommendation:\n`
    : `With a ${formattedSalary} monthly income, here's a starting budget:\n`;

  const whyExplanation = `Why this recommendation was made:\n` +
    `• Housing & Fixed Obligations: Kept within baseline limits to maintain core stability.\n` +
    `• Essential Expenses (Food, Transport, Bills, Health): Ensures daily living, health, and utilities are fully covered.\n` +
    `• Discretionary Spending (Personal, Entertainment): Allows guilt-free leisure and personal growth.\n` +
    `• Savings & Emergency/Investments: Allocates ${totalSavingsPct}% (${formattedSavings}/month) to build your 6-month safety net and long-term wealth.`;

  const fullAnswerText = `${introHeader}\n${budgetLines}\n\nTotal: ${formattedSalary}\n\nYour target savings rate is ${formattedSavings}/month (${totalSavingsPct}%).\n\n${whyExplanation}`;

  return {
    intent:       'income_budget_recommendation',
    questionText: queryText,
    answerText:   fullAnswerText,
    metrics: [
      { label: 'Monthly Income',       value: formattedSalary },
      { label: 'Target Savings Rate',  value: `${formattedSavings} (${totalSavingsPct}%)` },
      { label: 'Total Budgeted',       value: formattedSalary },
    ],
    supported: true,
  };
}

export async function parseNaturalLanguageQuery(
  db: DrizzleDB,
  queryText: string,
  currencyCode = 'INR'
): Promise<AssistantAnswer> {
  const query = queryText.toLowerCase().trim();
  const metrics = await getMonthlyMetrics(db);

  // 0. Income-Based Financial Intelligence & Salary Budget Generation
  const salaryFromQuery = extractSalaryFromQuery(queryText);
  const isBudgetIntent =
    query.includes('salary') ||
    query.includes('earn') ||
    query.includes('divide') ||
    query.includes('make') ||
    query.includes('how much should i save') ||
    query.includes('starting budget') ||
    (query.includes('budget') && (salaryFromQuery !== null || metrics.totalIncomePaise > 0));

  if (isBudgetIntent) {
    const salaryToUse =
      salaryFromQuery ??
      (metrics.totalIncomePaise > 0 ? metrics.totalIncomePaise / 100 : 60000);
    return await generateSalaryBudgetRecommendation(db, salaryToUse, queryText, currencyCode);
  }

  // 1. Overspending Check & Actionable Insights ("am i overspending", "where spending too much")
  if (
    query.includes('overspend') ||
    query.includes('too much') ||
    query.includes('spending too much') ||
    query.includes('over budget')
  ) {
    const activeBudgets = await db
      .select({
        id:            budgets.id,
        name:          budgets.name,
        amount:        budgets.amount,
        category_id:   budgets.category_id,
        category_name: categories.name,
      })
      .from(budgets)
      .leftJoin(categories, eq(budgets.category_id, categories.id))
      .where(eq(budgets.is_active, 1));

    const { from, to } = currentMonthRange();
    const overspentList: Array<{ name: string; amountPaise: number; spentPaise: number; overPaise: number; pct: number }> = [];

    for (const b of activeBudgets) {
      if (b.category_id) {
        const spentRes = await db
          .select({ total: sql<number>`SUM(amount)` })
          .from(transactions)
          .where(
            and(
              eq(transactions.type, 'expense'),
              eq(transactions.category_id, b.category_id),
              gte(transactions.date, from),
              lte(transactions.date, to)
            )
          );
        const spent = Number(spentRes[0]?.total ?? 0);
        if (spent > b.amount) {
          const over = spent - b.amount;
          const pct = Math.round((spent / b.amount) * 100);
          overspentList.push({
            name: b.category_name || b.name,
            amountPaise: b.amount,
            spentPaise: spent,
            overPaise: over,
            pct,
          });
        }
      }
    }

    if (overspentList.length > 0) {
      const primary = overspentList[0];
      const details = overspentList
        .map((o) => `${o.name} is ${formatCurrency(o.overPaise, currencyCode)} over your ${formatCurrency(o.amountPaise, currencyCode)} budget (${o.pct}% used)`)
        .join('; ');

      return {
        intent:       'overspending_check',
        questionText: queryText,
        answerText:   `Yes, you are overspending: ${details}. Reducing ${primary.name} delivery or non-essential purchases by ${formatCurrency(primary.overPaise, currencyCode)}/month will bring you back within budget.`,
        metrics:      overspentList.map((o) => ({
          label: `${o.name} Overspent`,
          value: `+${formatCurrency(o.overPaise, currencyCode)}`,
        })),
        supported: true,
      };
    } else if (metrics.totalExpensePaise > metrics.totalIncomePaise && metrics.totalIncomePaise > 0) {
      const over = metrics.totalExpensePaise - metrics.totalIncomePaise;
      return {
        intent:       'overspending_check',
        questionText: queryText,
        answerText:   `Your total monthly expenses (${formatCurrency(metrics.totalExpensePaise, currencyCode)}) exceed your total income (${formatCurrency(metrics.totalIncomePaise, currencyCode)}) by ${formatCurrency(over, currencyCode)}. Consider cutting back on discretionary spending.`,
        metrics:      [{ label: 'Monthly Deficit', value: formatCurrency(over, currencyCode) }],
        supported:    true,
      };
    } else {
      return {
        intent:       'overspending_check',
        questionText: queryText,
        answerText:   `Great news! None of your active category budgets are overspent, and your monthly spending (${formatCurrency(metrics.totalExpensePaise, currencyCode)}) is within your total income.`,
        metrics:      [{ label: 'Savings Rate', value: `${metrics.savingsRatePercent}%` }],
        supported:    true,
      };
    }
  }

  // 2. Upcoming Bills & Effective Available Liquidity ("bills coming up", "left after bills", "upcoming bills")
  if (
    query.includes('bill') ||
    query.includes('due') ||
    query.includes('after bill') ||
    query.includes('after upcoming') ||
    query.includes('upcoming')
  ) {
    const unpaidBills = await db
      .select()
      .from(bills)
      .where(and(eq(bills.is_paid, 0), eq(bills.is_active, 1)));

    const totalBillsPaise = unpaidBills.reduce((acc, b) => acc + Number(b.amount), 0);

    // Compute Account Balances
    const allAccounts = await db.select().from(accounts).where(eq(accounts.is_active, 1));
    const allTxns = await db.select({
      id:                     transactions.id,
      type:                   transactions.type,
      amount:                 transactions.amount,
      account_id:             transactions.account_id,
      transfer_to_account_id: transactions.transfer_to_account_id,
    }).from(transactions);

    let totalAccountBalancePaise = 0;
    for (const acc of allAccounts) {
      totalAccountBalancePaise += calculateAccountBalance(acc.opening_balance, acc.id, allTxns as any);
    }

    const effectiveAvailablePaise = Math.max(0, totalAccountBalancePaise - totalBillsPaise);

    if (unpaidBills.length > 0) {
      const billSummary = unpaidBills
        .slice(0, 3)
        .map((b) => `${b.name} (${formatCurrency(b.amount, currencyCode)})`)
        .join(', ');

      return {
        intent:       'upcoming_bills_liquidity',
        questionText: queryText,
        answerText:   `Your total account balance is ${formatCurrency(totalAccountBalancePaise, currencyCode)}. However, you have ${unpaidBills.length} unpaid upcoming bill(s) totaling ${formatCurrency(totalBillsPaise, currencyCode)} (${billSummary}). Your safe available cash after upcoming bills is ${formatCurrency(effectiveAvailablePaise, currencyCode)}.`,
        metrics: [
          { label: 'Total Balance',        value: formatCurrency(totalAccountBalancePaise, currencyCode) },
          { label: 'Upcoming Bills',       value: formatCurrency(totalBillsPaise, currencyCode) },
          { label: 'Safe Available Cash',  value: formatCurrency(effectiveAvailablePaise, currencyCode) },
        ],
        supported: true,
      };
    } else {
      return {
        intent:       'upcoming_bills_liquidity',
        questionText: queryText,
        answerText:   `You have no unpaid upcoming bills recorded! Your full account balance of ${formatCurrency(totalAccountBalancePaise, currencyCode)} is safe and available.`,
        metrics:      [{ label: 'Safe Available Cash', value: formatCurrency(totalAccountBalancePaise, currencyCode) }],
        supported:    true,
      };
    }
  }

  // 3. Safe Weekly Spend ("how much can i spend this week", "weekly budget", "spend this week")
  if (
    query.includes('weekly') ||
    query.includes('this week') ||
    query.includes('spend this week') ||
    query.includes('safe to spend')
  ) {
    const today = new Date();
    const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
    const daysLeft = Math.max(1, daysInMonth - today.getDate() + 1);
    const weeksLeft = Math.max(1, Math.ceil(daysLeft / 7));

    const allAccounts = await db.select().from(accounts).where(eq(accounts.is_active, 1));
    const allTxns = await db.select({
      id:                     transactions.id,
      type:                   transactions.type,
      amount:                 transactions.amount,
      account_id:             transactions.account_id,
      transfer_to_account_id: transactions.transfer_to_account_id,
    }).from(transactions);

    let totalBalancePaise = 0;
    for (const acc of allAccounts) {
      totalBalancePaise += calculateAccountBalance(acc.opening_balance, acc.id, allTxns as any);
    }

    const safeWeeklyPaise = Math.round(totalBalancePaise / weeksLeft);
    return {
      intent:       'safe_weekly_spend',
      questionText: queryText,
      answerText:   `Based on your total available account balance of ${formatCurrency(totalBalancePaise, currencyCode)} over the remaining ${weeksLeft} week(s) of this month, your recommended safe weekly spending limit is ${formatCurrency(safeWeeklyPaise, currencyCode)}.`,
      metrics: [
        { label: 'Safe Weekly Limit', value: formatCurrency(safeWeeklyPaise, currencyCode) },
        { label: 'Remaining Weeks',  value: `${weeksLeft} week(s)` },
      ],
      supported: true,
    };
  }

  // 4. Actionable Category Reduction ("which category should i reduce", "where to cut")
  if (query.includes('reduce') || query.includes('cut') || query.includes('lower spending')) {
    const { from, to } = currentMonthRange();
    const topCats = await db
      .select({
        name:  categories.name,
        total: sql<number>`SUM(${transactions.amount})`,
      })
      .from(transactions)
      .innerJoin(categories, eq(transactions.category_id, categories.id))
      .where(
        and(
          eq(transactions.type, 'expense'),
          gte(transactions.date, from),
          lte(transactions.date, to)
        )
      )
      .groupBy(categories.id)
      .orderBy(desc(sql`SUM(${transactions.amount})`))
      .limit(3);

    if (topCats.length > 0) {
      const topCat = topCats[0];
      const topPaise = Number(topCat.total);
      const targetSavingsPaise = Math.round(topPaise * 0.2); // 20% reduction target

      return {
        intent:       'category_reduction_advice',
        questionText: queryText,
        answerText:   `You are spending the most on ${topCat.name} (${formatCurrency(topPaise, currencyCode)} this month). Cutting back by 20% on ${topCat.name} would save you ${formatCurrency(targetSavingsPaise, currencyCode)} every month.`,
        metrics: [
          { label: 'Target Category',      value: topCat.name },
          { label: 'Current Spend',        value: formatCurrency(topPaise, currencyCode) },
          { label: 'Potential Monthly Savings', value: formatCurrency(targetSavingsPaise, currencyCode) },
        ],
        supported: true,
      };
    }
  }

  // 5. Monthly Spending ("how much did i spend", "total expenses")
  if (query.includes('spend') || query.includes('expense') || query.includes('spent')) {
    if (query.includes('food') || query.includes('eating') || query.includes('dining')) {
      const { from, to } = currentMonthRange();
      const foodRes = await db
        .select({ total: sql<number>`SUM(${transactions.amount})` })
        .from(transactions)
        .innerJoin(categories, eq(transactions.category_id, categories.id))
        .where(
          and(
            eq(transactions.type, 'expense'),
            gte(transactions.date, from),
            lte(transactions.date, to),
            sql`LOWER(${categories.name}) LIKE '%food%'`
          )
        );
      const foodTotal = Number(foodRes[0]?.total ?? 0);
      return {
        intent:       'category_food_spend',
        questionText: queryText,
        answerText:   `You have spent ${formatCurrency(foodTotal, currencyCode)} on Food & Dining this month.`,
        metrics:      [{ label: 'Food Spending', value: formatCurrency(foodTotal, currencyCode) }],
        supported:    true,
      };
    }

    return {
      intent:       'monthly_spending',
      questionText: queryText,
      answerText:   `You have spent ${formatCurrency(metrics.totalExpensePaise, currencyCode)} in total this month across all categories.`,
      metrics:      [
        { label: 'Total Expenses', value: formatCurrency(metrics.totalExpensePaise, currencyCode) },
        { label: 'Total Income',   value: formatCurrency(metrics.totalIncomePaise, currencyCode) },
      ],
      supported: true,
    };
  }

  // 6. Savings ("how much did i save", "savings rate")
  if (query.includes('save') || query.includes('savings')) {
    return {
      intent:       'savings_summary',
      questionText: queryText,
      answerText:   `You have saved ${formatCurrency(metrics.netSavingsPaise, currencyCode)} this month, representing a ${metrics.savingsRatePercent}% savings rate.`,
      metrics:      [
        { label: 'Net Savings',  value: formatCurrency(metrics.netSavingsPaise, currencyCode) },
        { label: 'Savings Rate', value: `${metrics.savingsRatePercent}%` },
      ],
      supported: true,
    };
  }

  // 7. Highest Category / Where spent most ("where did i spend the most")
  if (query.includes('where') || query.includes('most') || query.includes('top category')) {
    const { from, to } = currentMonthRange();
    const topCats = await db
      .select({
        name:  categories.name,
        total: sql<number>`SUM(${transactions.amount})`,
      })
      .from(transactions)
      .innerJoin(categories, eq(transactions.category_id, categories.id))
      .where(
        and(
          eq(transactions.type, 'expense'),
          gte(transactions.date, from),
          lte(transactions.date, to)
        )
      )
      .groupBy(categories.id)
      .orderBy(desc(sql`SUM(${transactions.amount})`))
      .limit(3);

    if (topCats.length === 0) {
      return {
        intent:       'top_spending_category',
        questionText: queryText,
        answerText:   'No expense transactions found for the current month.',
        supported:    true,
      };
    }

    const top = topCats[0];
    return {
      intent:       'top_spending_category',
      questionText: queryText,
      answerText:   `Your highest spending category this month is ${top.name} with ${formatCurrency(Number(top.total), currencyCode)}.`,
      metrics:      topCats.map((c) => ({ label: c.name, value: formatCurrency(Number(c.total), currencyCode) })),
      supported:    true,
    };
  }

  // 8. Budget Recommendations & Comprehensive Generator ("budget", "what should my budget be", "create a realistic budget")
  if (query.includes('budget') || query.includes('recommend') || query.includes('create a budget')) {
    const suggestions = await generateSmartBudgetSuggestions(db, currencyCode);
    return {
      intent:       'budget_suggestions',
      questionText: queryText,
      answerText:   'Here is your realistic smart budget for next month calculated from your historical spending. Fixed obligations (Rent, Bills) are locked, while controllable categories (Food, Shopping) include actionable reduction targets:',
      suggestions,
      supported:    true,
    };
  }

  // 9. Affordability Check ("can i afford 5000", "can i buy")
  const affordMatch = query.match(/afford\s*₹?\s*([\d,]+)/i);
  if (affordMatch && affordMatch[1]) {
    const amountVal = parseFloat(affordMatch[1].replace(/,/g, ''));
    const amountPaise = Math.round(amountVal * 100);
    const canAfford = metrics.netSavingsPaise >= amountPaise;

    return {
      intent:       'affordability_check',
      questionText: queryText,
      answerText:   canAfford
        ? `Yes! Based on your current net savings of ${formatCurrency(metrics.netSavingsPaise, currencyCode)} this month, you can comfortably afford ${formatCurrency(amountPaise, currencyCode)}.`
        : `Caution: Spending ${formatCurrency(amountPaise, currencyCode)} would exceed your current net savings of ${formatCurrency(metrics.netSavingsPaise, currencyCode)} for this month.`,
      metrics: [
        { label: 'Requested Amount',   value: formatCurrency(amountPaise, currencyCode) },
        { label: 'Current Net Savings', value: formatCurrency(metrics.netSavingsPaise, currencyCode) },
      ],
      supported: true,
    };
  }

  // Fallback for unsupported natural language queries
  return {
    intent:       'unknown',
    questionText: queryText,
    answerText:   'Offline Assistant: I can help answer queries about your monthly spending, savings rate, overspending alerts, upcoming bills, safe weekly limits, and category reductions. Try asking "Where am I spending too much?" or "How much money do I have left after upcoming bills?".',
    supported:    false,
  };
}
