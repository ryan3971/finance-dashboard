import { and, eq, gte, isNull, lt, sql } from 'drizzle-orm';
import { accounts, transactions } from '@/db/schema';
import { db } from '@/db';
import Decimal from 'decimal.js';
import type {
  IncomeDashboardResponse,
  IncomeMonthAllocation,
} from '@finance/shared';

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
        isNull(transactions.needWant),
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
  config: IncomePercentageConfig
): IncomeDashboardResponse {
  const { needsPercentage, wantsPercentage, investmentsPercentage } = config;
  const percentages: AllocationPercentages | null =
    needsPercentage !== null &&
    wantsPercentage !== null &&
    investmentsPercentage !== null
      ? { needsPercentage, wantsPercentage, investmentsPercentage }
      : null;

  const rowMap = new Map<number, string>(rows.map((r) => [r.month, r.total]));

  const months = Array.from({ length: 12 }, (_, i) => {
    const month = i + 1;
    const amount = new Decimal(rowMap.get(month) ?? '0.00');

    let allocation: IncomeMonthAllocation | null = null;

    if (percentages !== null) {
      if (amount.isZero()) {
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

    return { month, total: amount.toNumber(), allocation };
  });

  return { year, months };
}
