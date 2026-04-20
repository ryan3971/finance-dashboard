import { and, eq, gte, lt, sql } from 'drizzle-orm';
import { accounts, transactions } from '@/db/schema';
import { db } from '@/db';
import Decimal from 'decimal.js';
import type {
  IncomeDashboardResponse,
  IncomeMonthAllocation,
} from '@finance/shared/types/dashboard';
import { MONTHS_IN_YEAR } from '@finance/shared/constants';
import type { RebalancingAdjustments } from '@/pipelines/rebalancing/rebalancing-adjustments';

export interface IncomeRow {
  month: number;
  total: string;
}

interface AllocationPercentages {
  needsPercentage: number;
  wantsPercentage: number;
  investmentsPercentage: number;
}

export interface IncomePercentageConfig {
  needsPercentage: number | null;
  wantsPercentage: number | null;
  investmentsPercentage: number | null;
}

export async function queryMonthlyIncome(
  userId: string,
  year: number
): Promise<IncomeRow[]> {
  const startDate = `${year}-01-01`;
  const endDate = `${year + 1}-01-01`;

  const monthExpr = sql<number>`EXTRACT(MONTH FROM ${transactions.date})::int`;

  const rows = await db
    .select({
      month: monthExpr.as('month'),
      total: sql<string>`CAST(SUM(${transactions.amount}) AS text)`.as('total'),
    })
    .from(transactions)
    .innerJoin(accounts, eq(transactions.accountId, accounts.id))
    .where(
      and(
        eq(accounts.userId, userId),
        eq(transactions.isIncome, true),
        eq(transactions.isTransfer, false),
        gte(transactions.date, startDate),
        lt(transactions.date, endDate)
      )
    )
    .groupBy(monthExpr);

  return rows;
}

export function buildIncomeResponse(
  year: number,
  rows: IncomeRow[],
  config: IncomePercentageConfig,
  adjustments: RebalancingAdjustments
): IncomeDashboardResponse {
  const { needsPercentage, wantsPercentage, investmentsPercentage } = config;
  const percentages: AllocationPercentages | null =
    needsPercentage !== null &&
    wantsPercentage !== null &&
    investmentsPercentage !== null
      ? { needsPercentage, wantsPercentage, investmentsPercentage }
      : null;

  const rowMap = new Map<number, string>(rows.map((r) => [r.month, r.total]));

  const months = Array.from({ length: MONTHS_IN_YEAR }, (_, i) => {
    const month = i + 1;
    const rawAmount = new Decimal(rowMap.get(month) ?? '0.00');
    // Subtract rebalancing offset exclusions: offset transactions from resolved
    // groups are not real income and are removed from the reported total.
    const offsetExclusion =
      adjustments.incomeByMonth.get(month) ?? new Decimal(0);
    const amount = rawAmount.minus(offsetExclusion);
    const rebalancingAdjustment = offsetExclusion.toNumber();

    let allocation: IncomeMonthAllocation | null = null;

    if (percentages !== null) {
      if (amount.lte(0)) {
        allocation = { needs: 0, wants: 0, investments: 0 };
      } else {
        const needs = amount
          .mul(percentages.needsPercentage)
          .div(100)
          .toDecimalPlaces(2);
        const wants = amount
          .mul(percentages.wantsPercentage)
          .div(100)
          .toDecimalPlaces(2);
        const investments = amount.minus(needs).minus(wants);
        allocation = {
          needs: needs.toNumber(),
          wants: wants.toNumber(),
          investments: investments.toNumber(),
        };
      }
    }

    return {
      month,
      total: amount.toNumber(),
      allocation,
      rebalancingAdjustment,
    };
  });

  return { year, months };
}
