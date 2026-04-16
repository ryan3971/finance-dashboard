import { and, eq, gte, lt, sql } from 'drizzle-orm';
import {
  accounts,
  anticipatedBudget,
  anticipatedBudgetMonths,
  transactions,
} from '@/db/schema';
import { db } from '@/db';
import { MONTHS_IN_YEAR } from '@finance/shared/constants';

export interface AccountBalanceRow {
  id: string;
  name: string;
  type: string;
  institution: string;
  currency: string;
  isCredit: boolean;
  balance: string;
}

export interface ExpenseNeedWantRow {
  needWant: string | null;
  total: string;
}

export interface AnticipatedRow {
  isIncome: boolean;
  needWant: string | null;
  monthlyAmount: string | null;
  overrideAmount: string | null;
}

function monthDateRange(
  year: number,
  month: number
): { startDate: string; endDate: string } {
  const mm = String(month).padStart(2, '0');
  const startDate = `${year}-${mm}-01`;
  const nextMonth = month === MONTHS_IN_YEAR ? 1 : month + 1;
  const nextYear = month === MONTHS_IN_YEAR ? year + 1 : year;
  const nextMm = String(nextMonth).padStart(2, '0');
  const endDate = `${nextYear}-${nextMm}-01`;
  return { startDate, endDate };
}

export async function queryAccountBalances(
  userId: string
): Promise<AccountBalanceRow[]> {
  return db
    .select({
      id: accounts.id,
      name: accounts.name,
      type: accounts.type,
      institution: accounts.institution,
      currency: accounts.currency,
      isCredit: accounts.isCredit,
      // Amounts are signed: positive = income, negative = expense.
      // Non-credit: sum signed amounts directly.
      // Credit: invert — a negative charge increases debt, a positive payment reduces it.
      balance: sql<string>`CAST(COALESCE(SUM(
        CASE
          WHEN ${accounts.isCredit} = false THEN  ${transactions.amount}
          WHEN ${accounts.isCredit} = true  THEN -${transactions.amount}
          ELSE 0
        END
      ), 0) AS text)`.as('balance'),
    })
    .from(accounts)
    .leftJoin(transactions, eq(transactions.accountId, accounts.id))
    .where(and(eq(accounts.userId, userId), eq(accounts.isActive, true)))
    .groupBy(
      accounts.id,
      accounts.name,
      accounts.type,
      accounts.institution,
      accounts.currency,
      accounts.isCredit
    );
}

export async function queryCurrentMonthIncome(
  userId: string,
  year: number,
  month: number
): Promise<string> {
  const { startDate, endDate } = monthDateRange(year, month);

  const [row] = await db
    .select({
      total:
        sql<string>`CAST(COALESCE(SUM(${transactions.amount}), 0) AS text)`.as(
          'total'
        ),
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
    );

  return row?.total ?? '0';
}

export async function queryCurrentMonthExpenses(
  userId: string,
  year: number,
  month: number
): Promise<ExpenseNeedWantRow[]> {
  const { startDate, endDate } = monthDateRange(year, month);

  return db
    .select({
      needWant: transactions.needWant,
      // Expense amounts are stored as negative values (convention). Negate so
      // the service receives positive totals it can accumulate directly.
      total:
        sql<string>`CAST(COALESCE(SUM(-${transactions.amount}), 0) AS text)`.as(
          'total'
        ),
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
    .groupBy(transactions.needWant);
}

export async function queryAnticipatedForMonth(
  userId: string,
  year: number,
  month: number
): Promise<AnticipatedRow[]> {
  return db
    .select({
      isIncome: anticipatedBudget.isIncome,
      needWant: anticipatedBudget.needWant,
      monthlyAmount: anticipatedBudget.monthlyAmount,
      overrideAmount: anticipatedBudgetMonths.amount,
    })
    .from(anticipatedBudget)
    .leftJoin(
      anticipatedBudgetMonths,
      and(
        eq(anticipatedBudgetMonths.anticipatedBudgetId, anticipatedBudget.id),
        eq(anticipatedBudgetMonths.month, month)
      )
    )
    .where(
      and(
        eq(anticipatedBudget.userId, userId),
        eq(anticipatedBudget.effectiveYear, year)
      )
    );
}
