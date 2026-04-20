import { alias } from 'drizzle-orm/pg-core';
import { and, eq, gte, lt, sql } from 'drizzle-orm';
import { accounts, categories, transactions } from '@/db/schema';
import { db } from '@/db';
import Decimal from 'decimal.js';
import type {
  ExpenseCategoryRow,
  ExpenseDashboardResponse,
} from '@finance/shared/types/dashboard';
import { NEED_WANT_OPTIONS, MONTHS_IN_YEAR } from '@finance/shared/constants';

const categoryAlias = alias(categories, 'cat');
const subcategoryAlias = alias(categories, 'sub');

interface ExpenseNeedWantRow {
  month: number;
  needWant: string | null;
  total: string;
}

const [NEED, WANT] = NEED_WANT_OPTIONS; // 'Need', 'Want'

function yearDateRange(year: number): { startDate: string; endDate: string } {
  return { startDate: `${year}-01-01`, endDate: `${year + 1}-01-01` };
}

export async function queryMonthlyExpenses(
  userId: string,
  year: number
): Promise<ExpenseNeedWantRow[]> {
  const { startDate, endDate } = yearDateRange(year);

  const monthExpr = sql<number>`EXTRACT(MONTH FROM ${transactions.date})::int`;

  const rows = await db
    .select({
      month: monthExpr.as('month'),
      needWant: transactions.needWant,
      total: sql<string>`CAST(-SUM(${transactions.amount}) AS text)`.as('total'),
    })
    .from(transactions)
    .innerJoin(accounts, eq(transactions.accountId, accounts.id))
    .where(
      and(
        eq(accounts.userId, userId),
        eq(transactions.isIncome, false),
        eq(transactions.isTransfer, false),
        gte(transactions.date, startDate),
        lt(transactions.date, endDate)
      )
    )
    .groupBy(monthExpr, transactions.needWant);

  return rows;
}

export function buildExpensesResponse(
  year: number,
  rows: ExpenseNeedWantRow[]
): ExpenseDashboardResponse {
  const buckets = new Map<
    number,
    { need: Decimal; want: Decimal; other: Decimal }
  >();
  for (let m = 1; m <= MONTHS_IN_YEAR; m++) {
    buckets.set(m, {
      need: new Decimal(0),
      want: new Decimal(0),
      other: new Decimal(0),
    });
  }

  for (const row of rows) {
    const bucket = buckets.get(row.month);
    if (!bucket) continue;
    const amount = new Decimal(row.total);
    if (row.needWant === NEED) {
      bucket.need = bucket.need.plus(amount);
    } else if (row.needWant === WANT) {
      bucket.want = bucket.want.plus(amount);
    } else {
      bucket.other = bucket.other.plus(amount);
    }
  }

  let annualDecimal = new Decimal(0);
  const months = Array.from(buckets.entries()).map(
    ([month, { need, want, other }]) => {
      const total = need.plus(want).plus(other);
      annualDecimal = annualDecimal.plus(total);
      return {
        month,
        need: need.toNumber(),
        want: want.toNumber(),
        other: other.toNumber(),
        total: total.toNumber(),
        rebalancingAdjustment: 0,
      };
    }
  );

  return { year, months, annualTotal: annualDecimal.toNumber() };
}

export async function queryExpensesByCategory(
  userId: string,
  year: number
): Promise<ExpenseCategoryRow[]> {
  const { startDate, endDate } = yearDateRange(year);
  const monthExpr = sql<number>`EXTRACT(MONTH FROM ${transactions.date})::int`;

  const rows = await db
    .select({
      month: monthExpr.as('month'),
      category: categoryAlias.name,
      subcategory: subcategoryAlias.name,
      total: sql<string>`CAST(-SUM(${transactions.amount}) AS text)`.as('total'),
    })
    .from(transactions)
    .innerJoin(accounts, eq(transactions.accountId, accounts.id))
    .leftJoin(categoryAlias, eq(transactions.categoryId, categoryAlias.id))
    .leftJoin(
      subcategoryAlias,
      eq(transactions.subcategoryId, subcategoryAlias.id)
    )
    .where(
      and(
        eq(accounts.userId, userId),
        eq(transactions.isIncome, false),
        eq(transactions.isTransfer, false),
        gte(transactions.date, startDate),
        lt(transactions.date, endDate)
      )
    )
    .groupBy(monthExpr, categoryAlias.name, subcategoryAlias.name);

  return rows.map((r) => ({
    month: r.month,
    category: r.category,
    subcategory: r.subcategory,
    total: new Decimal(r.total).toNumber(),
    rebalancingAdjustment: null,
  }));
}
