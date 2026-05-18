import { and, count, desc, eq, gte, ilike, inArray, lt, lte, sql } from 'drizzle-orm';
import {
  accounts,
  contributionRecords,
  investmentTransactions,
} from '@/db/schema';
import { db } from '@/db';
import type {
  InvestmentTransactionFilters,
  UpsertContributionRoomInput,
} from '@finance/shared/schemas/investments';
import { INVESTMENT_ACCOUNT_TYPES } from '@finance/shared/constants';

export const REGISTERED_ACCOUNT_TYPES = ['tfsa', 'rrsp', 'fhsa'] as const;
export type RegisteredAccountType = (typeof REGISTERED_ACCOUNT_TYPES)[number];

// Single named constant for the TFSA type, used for the carry-forward estimate branch.
export const TFSA_TYPE = 'tfsa' as const;

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
  // Drizzle returns text columns as string. The service layer narrows this to
  // InvestmentTransactionSource at the boundary where it maps to the response type.
  source: string;
}

export interface TransactionAggregatesDbRow {
  dividends: string;
  fees: string;
  netDeposits: string;
}

export interface RegisteredAccountRow {
  id: string;
  name: string;
  // Narrowed at the query boundary: the WHERE inArray clause guarantees this is
  // always a registered type — the cast in queryRegisteredAccounts is the single
  // point where the DB's string type is widened to the known union.
  type: RegisteredAccountType;
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
        source: investmentTransactions.source,
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

export async function queryTransactionAggregates(
  userId: string,
  filters: InvestmentTransactionFilters
): Promise<TransactionAggregatesDbRow> {
  const { accountId, action, symbol, startDate, endDate } = filters;

  const where = and(
    eq(accounts.userId, userId),
    accountId !== undefined ? eq(investmentTransactions.accountId, accountId) : undefined,
    action !== undefined ? eq(investmentTransactions.action, action) : undefined,
    symbol !== undefined ? ilike(investmentTransactions.symbol, symbol) : undefined,
    startDate !== undefined ? gte(investmentTransactions.date, startDate) : undefined,
    endDate !== undefined ? lte(investmentTransactions.date, endDate) : undefined,
  );

  const [row] = await db
    .select({
      dividends: sql<string>`CAST(COALESCE(SUM(
        CASE WHEN ${investmentTransactions.action} = 'dividend'
        THEN ${investmentTransactions.amount}::numeric ELSE 0 END
      ), 0) AS text)`,
      fees: sql<string>`CAST(COALESCE(SUM(
        CASE WHEN ${investmentTransactions.action} = 'fee'
        THEN -${investmentTransactions.amount}::numeric ELSE 0 END
      ), 0) AS text)`,
      netDeposits: sql<string>`CAST(COALESCE(SUM(
        CASE WHEN ${investmentTransactions.action} IN ('deposit', 'withdrawal')
        THEN ${investmentTransactions.amount}::numeric ELSE 0 END
      ), 0) AS text)`,
    })
    .from(investmentTransactions)
    .innerJoin(accounts, eq(investmentTransactions.accountId, accounts.id))
    .where(where);

  return row ?? { dividends: '0', fees: '0', netDeposits: '0' };
}

export async function queryRegisteredAccounts(
  userId: string
): Promise<RegisteredAccountRow[]> {
  const rows = await db
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

  // The WHERE inArray clause guarantees every returned row has a RegisteredAccountType.
  // Drizzle cannot narrow text columns from WHERE predicates, so we cast once here.
  return rows as RegisteredAccountRow[];
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

export async function queryAccountOwnerAndType(
  accountId: string
): Promise<{ userId: string; type: string; name: string } | undefined> {
  const [row] = await db
    .select({ userId: accounts.userId, type: accounts.type, name: accounts.name })
    .from(accounts)
    .where(eq(accounts.id, accountId));
  return row;
}

export interface MonthlyBreakdownDbRow {
  month: number;
  contributed: string;
  deployed: string;
}

export async function queryInvestmentAccountIds(userId: string): Promise<string[]> {
  const rows = await db
    .select({ id: accounts.id })
    .from(accounts)
    .where(
      and(
        eq(accounts.userId, userId),
        inArray(accounts.type, [...INVESTMENT_ACCOUNT_TYPES]),
      )
    );
  return rows.map((r) => r.id);
}

export async function queryMonthlyBreakdownRaw(
  accountIds: string[],
  year: number
): Promise<MonthlyBreakdownDbRow[]> {
  if (accountIds.length === 0) return [];

  const startDate = `${year}-01-01`;
  const endDate = `${year + 1}-01-01`;

  return db
    .select({
      month: sql<number>`EXTRACT(MONTH FROM ${investmentTransactions.date})::int`,
      contributed: sql<string>`CAST(COALESCE(SUM(
        CASE WHEN ${investmentTransactions.action} = 'deposit'
        THEN ${investmentTransactions.amount}::numeric ELSE 0 END
      ), 0) AS text)`,
      deployed: sql<string>`CAST(COALESCE(SUM(
        CASE WHEN ${investmentTransactions.action} IN ('buy', 'sell')
        THEN ${investmentTransactions.amount}::numeric ELSE 0 END
      ), 0) AS text)`,
    })
    .from(investmentTransactions)
    .where(
      and(
        inArray(investmentTransactions.accountId, accountIds),
        gte(investmentTransactions.date, startDate),
        lt(investmentTransactions.date, endDate),
        inArray(investmentTransactions.action, ['deposit', 'buy', 'sell']),
      )
    )
    .groupBy(sql`EXTRACT(MONTH FROM ${investmentTransactions.date})`);
}

export async function upsertContributionRoomRecord(
  accountId: string,
  year: number,
  body: UpsertContributionRoomInput
): Promise<void> {
  const updateSet = {
    ...(body.annualLimit !== undefined ? { annualLimit: String(body.annualLimit) } : {}),
    ...(body.roomCarried !== undefined ? { roomCarried: String(body.roomCarried) } : {}),
    ...(body.roomCarriedConfirmed !== undefined
      ? { roomCarriedConfirmed: body.roomCarriedConfirmed }
      : {}),
  };

  const insertQuery = db.insert(contributionRecords).values({
    accountId,
    taxYear: year,
    annualLimit: body.annualLimit !== undefined ? String(body.annualLimit) : undefined,
    roomCarried: body.roomCarried !== undefined ? String(body.roomCarried) : undefined,
    roomCarriedConfirmed: body.roomCarriedConfirmed ?? false,
  });

  if (Object.keys(updateSet).length > 0) {
    await insertQuery.onConflictDoUpdate({
      target: [contributionRecords.accountId, contributionRecords.taxYear],
      set: updateSet,
    });
  } else {
    await insertQuery.onConflictDoNothing();
  }
}
