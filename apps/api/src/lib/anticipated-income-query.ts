// Cross-feature shared query. Lives in lib/ so the investments feature can
// import it without crossing the features/ boundary restriction. Pattern
// mirrors queryDashboardUserConfig in lib/user-config-query.ts.
import Decimal from 'decimal.js';
import { and, eq, inArray } from 'drizzle-orm';
import { anticipatedBudget, anticipatedBudgetMonths } from '@/db/schema';
import { db } from '@/db';
import { MONTHS_IN_YEAR } from '@finance/shared/constants';

export interface ResolvedMonthlyIncome {
  month: number;
  amount: number;
}

export interface MonthlyIncomeResult {
  months: ResolvedMonthlyIncome[];
  hasEntries: boolean;
}

// Resolves the sum of all income entries' monthly amounts for a given year,
// applying per-month overrides where present (override > monthlyAmount default).
// `hasEntries` is true when at least one anticipated budget income entry exists
// for the year — regardless of whether the resolved amounts are zero.
// Called by investments.service to compute monthly contribution targets.
export async function resolveMonthlyIncome(
  userId: string,
  year: number
): Promise<MonthlyIncomeResult> {
  const incomeEntries = await db
    .select({
      id: anticipatedBudget.id,
      monthlyAmount: anticipatedBudget.monthlyAmount,
    })
    .from(anticipatedBudget)
    .where(
      and(
        eq(anticipatedBudget.userId, userId),
        eq(anticipatedBudget.effectiveYear, year),
        eq(anticipatedBudget.isIncome, true)
      )
    );

  if (incomeEntries.length === 0) {
    return {
      months: Array.from({ length: MONTHS_IN_YEAR }, (_, i) => ({
        month: i + 1,
        amount: 0,
      })),
      hasEntries: false,
    };
  }

  const entryIds = incomeEntries.map((e) => e.id);
  const overrides = await db
    .select({
      anticipatedBudgetId: anticipatedBudgetMonths.anticipatedBudgetId,
      month: anticipatedBudgetMonths.month,
      amount: anticipatedBudgetMonths.amount,
    })
    .from(anticipatedBudgetMonths)
    .where(inArray(anticipatedBudgetMonths.anticipatedBudgetId, entryIds));

  const overridesByEntry = new Map<string, { month: number; amount: string }[]>();
  for (const o of overrides) {
    const list = overridesByEntry.get(o.anticipatedBudgetId) ?? [];
    list.push({ month: o.month, amount: o.amount });
    overridesByEntry.set(o.anticipatedBudgetId, list);
  }

  const totals = new Array<Decimal>(MONTHS_IN_YEAR).fill(new Decimal(0));

  for (const entry of incomeEntries) {
    const entryOverrides = overridesByEntry.get(entry.id) ?? [];
    const overrideMap = new Map(entryOverrides.map((o) => [o.month, o.amount]));
    const defaultAmount =
      entry.monthlyAmount !== null ? new Decimal(entry.monthlyAmount) : new Decimal(0);

    for (let i = 0; i < MONTHS_IN_YEAR; i++) {
      const month = i + 1;
      const override = overrideMap.get(month);
      const monthAmount =
        override !== undefined ? new Decimal(override) : defaultAmount;
      totals[i] = (totals[i] ?? new Decimal(0)).plus(monthAmount);
    }
  }

  return {
    months: totals.map((total, i) => ({ month: i + 1, amount: total.toNumber() })),
    hasEntries: true,
  };
}
