import { and, eq, gte, isNull, lt, sql } from 'drizzle-orm';
import type { Column } from 'drizzle-orm';
import { accounts, investmentTransactions, transactions } from '@/db/schema';
import { db } from '@/db';
import Decimal from 'decimal.js';
import { INVESTMENT_ACTION } from '@/lib/constants';
import { NEED_WANT_OPTIONS, MONTHS_IN_YEAR } from '@finance/shared/constants';
import type {
  YtdDashboardResponse,
  YtdMonth,
} from '@finance/shared/types/dashboard';

interface IncomeRow {
  month: number;
  total: string;
}

interface ExpenseNeedWantRow {
  month: number;
  needWant: string | null;
  total: string;
}

interface ContributionRow {
  month: number;
  total: string;
}

const [NEED, WANT] = NEED_WANT_OPTIONS;

function yearDateRange(year: number): { startDate: string; endDate: string } {
  return { startDate: `${year}-01-01`, endDate: `${year + 1}-01-01` };
}

const monthOf = (col: Column) => sql<number>`EXTRACT(MONTH FROM ${col})::int`;

export async function queryYtdMonthlyIncome(
  userId: string,
  year: number
): Promise<IncomeRow[]> {
  const { startDate, endDate } = yearDateRange(year);
  const monthExpr = monthOf(transactions.date);

  return db
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
}

export async function queryYtdMonthlyExpenses(
  userId: string,
  year: number
): Promise<ExpenseNeedWantRow[]> {
  const { startDate, endDate } = yearDateRange(year);
  const monthExpr = monthOf(transactions.date);

  return db
    .select({
      month: monthExpr.as('month'),
      needWant: transactions.needWant,
      total: sql<string>`CAST(SUM(${transactions.amount}) AS text)`.as('total'),
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
}

export async function queryYtdMonthlyInvestmentContributions(
  userId: string,
  year: number
): Promise<ContributionRow[]> {
  const { startDate, endDate } = yearDateRange(year);
  const monthExpr = monthOf(investmentTransactions.date);

  return db
    .select({
      month: monthExpr.as('month'),
      total:
        sql<string>`CAST(SUM(${investmentTransactions.amount}) AS text)`.as(
          'total'
        ),
    })
    .from(investmentTransactions)
    .innerJoin(accounts, eq(investmentTransactions.accountId, accounts.id))
    .where(
      and(
        eq(accounts.userId, userId),
        eq(investmentTransactions.action, INVESTMENT_ACTION.DEPOSIT),
        gte(investmentTransactions.date, startDate),
        lt(investmentTransactions.date, endDate)
      )
    )
    .groupBy(monthExpr);
}

export interface YtdConfig {
  needsPercentage: number | null;
  wantsPercentage: number | null;
}

export function buildYtdResponse(
  year: number,
  incomeRows: IncomeRow[],
  expenseRows: ExpenseNeedWantRow[],
  contributionRows: ContributionRow[],
  today: Date,
  config: YtdConfig
): YtdDashboardResponse {
  const currentYear = today.getFullYear();
  const currentMonth = today.getMonth() + 1;

  const incomeMap = new Map<number, string>(
    incomeRows.map((r) => [r.month, r.total])
  );
  const contributionMap = new Map<number, string>(
    contributionRows.map((r) => [r.month, r.total])
  );

  // Build expense buckets per month
  const expenseBuckets = new Map<
    number,
    { need: Decimal; want: Decimal; total: Decimal }
  >();
  for (let m = 1; m <= MONTHS_IN_YEAR; m++) {
    expenseBuckets.set(m, {
      need: new Decimal(0),
      want: new Decimal(0),
      total: new Decimal(0),
    });
  }
  for (const row of expenseRows) {
    const bucket = expenseBuckets.get(row.month);
    if (!bucket) continue;
    const amount = new Decimal(row.total);
    bucket.total = bucket.total.plus(amount);
    if (row.needWant === NEED) {
      bucket.need = bucket.need.plus(amount);
    } else if (row.needWant === WANT) {
      bucket.want = bucket.want.plus(amount);
    }
  }

  const months: YtdMonth[] = [];
  for (let m = 1; m <= MONTHS_IN_YEAR; m++) {
    const isFuture =
      year > currentYear || (year === currentYear && m > currentMonth);

    if (isFuture) {
      months.push({
        month: m,
        spendingIncome: null,
        expenses: null,
        netSpendingIncome: null,
        wants: null,
        needs: null,
      });
      continue;
    }

    const income = new Decimal(incomeMap.get(m) ?? '0');
    const contributions = new Decimal(contributionMap.get(m) ?? '0');
    const spendingIncome = income.minus(contributions); // TODO: may need to change this to add, depending on how contributions are stored (+ or -)

    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const bucket = expenseBuckets.get(m)!; // always present — pre-initialized for months 1–12 above
    const netSpendingIncome = spendingIncome.minus(bucket.total.abs());

    let wants: Decimal;
    let needs: Decimal;
    if (config.wantsPercentage !== null && config.needsPercentage !== null) {
      wants = spendingIncome.mul(config.wantsPercentage).div(100).minus(bucket.want.abs());
      needs = spendingIncome.mul(config.needsPercentage).div(100).minus(bucket.need.abs());
    } else {
      wants = bucket.want;
      needs = bucket.need;
    }

    months.push({
      month: m,
      spendingIncome: spendingIncome.toNumber(),
      expenses: bucket.total.toNumber(),
      netSpendingIncome: netSpendingIncome.toNumber(),
      wants: wants.toNumber(),
      needs: needs.toNumber(),
    });
  }

  return { year, months };
}
