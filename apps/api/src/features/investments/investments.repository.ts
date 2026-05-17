import { and, count, desc, eq, gte, ilike, inArray, lt, lte, sql } from 'drizzle-orm';
import {
  accounts,
  contributionRecords,
  investmentTransactions,
} from '@/db/schema';
import { db } from '@/db';
import type { InvestmentTransactionFilters } from '@finance/shared/schemas/investments';

export const REGISTERED_ACCOUNT_TYPES = ['tfsa', 'rrsp', 'fhsa'] as const;
export type RegisteredAccountType = (typeof REGISTERED_ACCOUNT_TYPES)[number];

export interface InvestmentTransactionDbRow {
  id: string;
  accountId: string;
  accountName: string;
  date: string;
  action: string;
  rawAction: string;
  symbol: string | null;
  description: string | null;
  quantity: string | null;
  price: string | null;
  grossAmount: string | null;
  commission: string | null;
  amount: string;
  currency: string;
  activityType: string | null;
  note: string | null;
}

export interface ActivitySummaryDbRow {
  dividendsReceived: string;
  feesPaid: string;
  totalContributions: string;
  totalWithdrawals: string;
}

export interface RegisteredAccountRow {
  id: string;
  name: string;
  type: string;
}

export interface ContributionRecordDbRow {
  accountId: string;
  annualLimit: string | null;
  roomCarried: string | null;
  roomCarriedConfirmed: boolean;
}

export interface ContributionAggRow {
  accountId: string;
  contributions: string;
  withdrawals: string;
}

export async function queryPaginatedTransactions(
  userId: string,
  filters: InvestmentTransactionFilters
): Promise<{ rows: InvestmentTransactionDbRow[]; total: number }> {
  const { accountId, action, symbol, startDate, endDate, page, pageSize } = filters;

  const where = and(
    eq(accounts.userId, userId),
    accountId !== undefined ? eq(investmentTransactions.accountId, accountId) : undefined,
    action !== undefined ? eq(investmentTransactions.action, action) : undefined,
    symbol !== undefined ? ilike(investmentTransactions.symbol, symbol) : undefined,
    startDate !== undefined ? gte(investmentTransactions.date, startDate) : undefined,
    endDate !== undefined ? lte(investmentTransactions.date, endDate) : undefined,
  );

  const [rows, [countRow]] = await Promise.all([
    db
      .select({
        id: investmentTransactions.id,
        accountId: investmentTransactions.accountId,
        accountName: accounts.name,
        date: investmentTransactions.date,
        action: investmentTransactions.action,
        rawAction: investmentTransactions.rawAction,
        symbol: investmentTransactions.symbol,
        description: investmentTransactions.description,
        quantity: investmentTransactions.quantity,
        price: investmentTransactions.price,
        grossAmount: investmentTransactions.grossAmount,
        commission: investmentTransactions.commission,
        amount: investmentTransactions.amount,
        currency: investmentTransactions.currency,
        activityType: investmentTransactions.activityType,
        note: investmentTransactions.note,
      })
      .from(investmentTransactions)
      .innerJoin(accounts, eq(investmentTransactions.accountId, accounts.id))
      .where(where)
      .orderBy(desc(investmentTransactions.date), desc(investmentTransactions.createdAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize),

    db
      .select({ total: count() })
      .from(investmentTransactions)
      .innerJoin(accounts, eq(investmentTransactions.accountId, accounts.id))
      .where(where),
  ]);

  return { rows, total: countRow?.total ?? 0 };
}

export async function queryActivitySummary(
  userId: string,
  year: number,
  accountId?: string
): Promise<ActivitySummaryDbRow> {
  const startDate = `${year}-01-01`;
  const endDate = `${year + 1}-01-01`;

  const [row] = await db
    .select({
      dividendsReceived: sql<string>`CAST(COALESCE(SUM(
        CASE WHEN ${investmentTransactions.action} = 'dividend'
        THEN ${investmentTransactions.amount}::numeric ELSE 0 END
      ), 0) AS text)`,
      feesPaid: sql<string>`CAST(COALESCE(SUM(
        CASE WHEN ${investmentTransactions.action} = 'fee'
        THEN -${investmentTransactions.amount}::numeric ELSE 0 END
      ), 0) AS text)`,
      totalContributions: sql<string>`CAST(COALESCE(SUM(
        CASE WHEN ${investmentTransactions.action} = 'deposit'
        THEN ${investmentTransactions.amount}::numeric ELSE 0 END
      ), 0) AS text)`,
      totalWithdrawals: sql<string>`CAST(COALESCE(SUM(
        CASE WHEN ${investmentTransactions.action} = 'withdrawal'
        THEN -${investmentTransactions.amount}::numeric ELSE 0 END
      ), 0) AS text)`,
    })
    .from(investmentTransactions)
    .innerJoin(accounts, eq(investmentTransactions.accountId, accounts.id))
    .where(
      and(
        eq(accounts.userId, userId),
        gte(investmentTransactions.date, startDate),
        lt(investmentTransactions.date, endDate),
        accountId !== undefined
          ? eq(investmentTransactions.accountId, accountId)
          : undefined,
      )
    );

  return (
    row ?? {
      dividendsReceived: '0',
      feesPaid: '0',
      totalContributions: '0',
      totalWithdrawals: '0',
    }
  );
}

export async function queryRegisteredAccounts(
  userId: string
): Promise<RegisteredAccountRow[]> {
  return db
    .select({
      id: accounts.id,
      name: accounts.name,
      type: accounts.type,
    })
    .from(accounts)
    .where(
      and(
        eq(accounts.userId, userId),
        inArray(accounts.type, [...REGISTERED_ACCOUNT_TYPES]),
      )
    );
}

export async function queryContributionRecords(
  accountIds: string[],
  year: number
): Promise<ContributionRecordDbRow[]> {
  if (accountIds.length === 0) return [];

  return db
    .select({
      accountId: contributionRecords.accountId,
      annualLimit: contributionRecords.annualLimit,
      roomCarried: contributionRecords.roomCarried,
      roomCarriedConfirmed: contributionRecords.roomCarriedConfirmed,
    })
    .from(contributionRecords)
    .where(
      and(
        inArray(contributionRecords.accountId, accountIds),
        eq(contributionRecords.taxYear, year),
      )
    );
}

export async function queryContributionAggregates(
  accountIds: string[],
  year: number
): Promise<ContributionAggRow[]> {
  if (accountIds.length === 0) return [];

  const startDate = `${year}-01-01`;
  const endDate = `${year + 1}-01-01`;

  return db
    .select({
      accountId: investmentTransactions.accountId,
      contributions: sql<string>`CAST(COALESCE(SUM(
        CASE WHEN ${investmentTransactions.action} = 'deposit'
        THEN ${investmentTransactions.amount}::numeric ELSE 0 END
      ), 0) AS text)`,
      withdrawals: sql<string>`CAST(COALESCE(SUM(
        CASE WHEN ${investmentTransactions.action} = 'withdrawal'
        THEN -${investmentTransactions.amount}::numeric ELSE 0 END
      ), 0) AS text)`,
    })
    .from(investmentTransactions)
    .where(
      and(
        inArray(investmentTransactions.accountId, accountIds),
        gte(investmentTransactions.date, startDate),
        lt(investmentTransactions.date, endDate),
      )
    )
    .groupBy(investmentTransactions.accountId);
}
