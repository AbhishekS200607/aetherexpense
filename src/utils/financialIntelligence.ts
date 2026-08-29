/**
 * AetherExpense — Local Financial Intelligence Engine
 *
 * 100% Offline Local Financial Intelligence Engine.
 * Analyzes SQLite financial history using Drizzle ORM queries and SQL aggregations.
 * Zero external API calls (0 fetch/axios/cloud/LLM requests). All money values stored in paise (minor units).
 */

import { eq, and, gte, lte, sql, desc, count } from 'drizzle-orm';
import type { DrizzleDB } from '@/database/client';
import { transactions, categories, budgets, accounts } from '@/database/schema';
import { currentMonthRange, todayISO, getMonthRange } from '@/utils/dates';
import { formatCurrency } from '@/utils/currency';

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

export async function parseNaturalLanguageQuery(
  db: DrizzleDB,
  queryText: string,
  currencyCode = 'INR'
): Promise<AssistantAnswer> {
  const query = queryText.toLowerCase().trim();
  const metrics = await getMonthlyMetrics(db);

  // Intent 1: Monthly Spending ("how much did i spend", "total expenses")
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

  // Intent 2: Savings ("how much did i save", "savings rate")
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

  // Intent 3: Highest Category / Where spent most ("where did i spend the most")
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

  // Intent 4: Budget Recommendations ("budget", "what should my budget be")
  if (query.includes('budget') || query.includes('recommend')) {
    const suggestions = await generateSmartBudgetSuggestions(db, currencyCode);
    return {
      intent:       'budget_suggestions',
      questionText: queryText,
      answerText:   'Here are your personalized smart budget recommendations calculated from your 3-month historical spending:',
      suggestions,
      supported:    true,
    };
  }

  // Intent 5: Affordability Check ("can i afford 5000", "can i buy")
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
        { label: 'Requested Amount', value: formatCurrency(amountPaise, currencyCode) },
        { label: 'Current Net Savings', value: formatCurrency(metrics.netSavingsPaise, currencyCode) },
      ],
      supported: true,
    };
  }

  // Fallback for unsupported natural language queries
  return {
    intent:       'unknown',
    questionText: queryText,
    answerText:   'Offline Assistant: I can help answer queries about your monthly spending, savings rate, top categories, budget recommendations, and affordability. Try asking "How much did I save this month?" or "What should my budget be?".',
    supported:    false,
  };
}
